/**
 * Improvio Change Request Routes
 * Change Requests and document review workflow.
 *
 * Lifecycle: Draft → In Review → (Changes Requested ↔ In Review) → Approved → Merged
 *
 * Key rules:
 * - All assigned reviewers must approve for a step to complete
 * - Any document modification after an approval resets ALL approvals
 * - Document is locked (no edits) while In Review
 * - Author can only edit after Request Changes
 */

import { Router } from 'express';
import path from 'node:path';
import { authMiddleware } from '../middleware/auth.js';
import * as db from '../db/queries.js';
import { gitEngine } from '../git/engine.js';
import { ConfigLoader } from '../config/loader.js';
import { RoleResolver } from '../config/role-resolver.js';
import { WorkflowEngine } from '../config/workflow-engine.js';
import { ManualIdentityProvider } from '../identity/manual.js';
import { loadGovernanceConfig } from '../config/governance.js';

const router = Router();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage/companies';

function getRepoDir(companyId: string): string {
  return path.resolve(STORAGE_PATH, companyId);
}

function resolveWorkflowForCategory(companyId: string, category: string, submitterEmail: string, submitterName: string) {
  const repoDir = getRepoDir(companyId);
  const configLoader = new ConfigLoader(repoDir);
  const identityProvider = new ManualIdentityProvider(companyId);
  const roleResolver = new RoleResolver(identityProvider);
  const workflowEngine = new WorkflowEngine(configLoader, roleResolver);

  const samplePath = `${category}/sample.md`;
  const submitter = {
    email: submitterEmail,
    name: submitterName,
    department: '',
    title: '',
    is_active: true,
    out_of_office: false,
  };

  return workflowEngine.resolveWorkflow(samplePath, submitter);
}

/**
 * POST /api/change-requests
 * Submit a Change Request for review.
 * Records the draft branch HEAD SHA for approval tracking.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const { title, description, branch_name, category, document_path } = req.body;

    if (!title || !branch_name || !category) {
      res.status(400).json({ error: 'title, branch_name, and category are required' });
      return;
    }

    // Check for active CRs on this document
    if (document_path) {
      const activeCRs = db.getActiveChangeRequestsForDocument(companyId, document_path);
      if (activeCRs.length > 0) {
        const existing = activeCRs[0];
        // If changes were requested, resubmit the existing CR instead of blocking
        if (existing.status === 'changes_requested') {
          db.dismissApprovals(existing.id, 'Document resubmitted after changes');
          db.updateChangeRequestStatus(existing.id, 'in_review', existing.current_step);
          res.status(201).json({ change_request: db.getChangeRequest(existing.id) });
          return;
        }
        res.status(409).json({
          error: `This document already has an active Change Request: "${existing.title}" (${existing.status})`,
          change_request_id: existing.id,
        });
        return;
      }
    }

    const cr = db.createChangeRequest(
      companyId,
      title,
      description,
      branch_name,
      category,
      req.user!.email,
      req.user!.name,
      document_path,
    );

    // Record the branch HEAD SHA and move to in_review
    const repoDir = getRepoDir(companyId);
    try {
      const headSha = await gitEngine.getBranchHeadSha(repoDir, branch_name);
      db.updateChangeRequestReviewSha(cr.id, headSha);
    } catch {
      // Branch SHA not available - continue anyway
    }

    db.updateChangeRequestStatus(cr.id, 'in_review', 0);

    res.status(201).json({ change_request: db.getChangeRequest(cr.id) });
  } catch (err) {
    console.error('Failed to create change request:', err);
    res.status(500).json({ error: 'Failed to submit change request' });
  }
});

/**
 * GET /api/change-requests
 * List change requests
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;

    const requests = db.listChangeRequests(companyId, { status, category });

    res.json({ change_requests: requests });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list change requests' });
  }
});

/**
 * GET /api/change-requests/my-reviews
 * Split pending CRs into "your_turn" and "their_turn" based on current workflow step.
 * Must be before /:crid to avoid matching as an ID.
 */
router.get('/my-reviews', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const email = req.user!.email;

    const pending = db.listChangeRequests(companyId).filter(
      (cr) => cr.status === 'in_review' || cr.status === 'changes_requested',
    );

    const yourTurn: any[] = [];
    const theirTurn: any[] = [];

    for (const cr of pending) {
      // If changes_requested, it's the author's turn
      if (cr.status === 'changes_requested') {
        if (cr.submitted_by_email === email) {
          yourTurn.push(cr);
        } else {
          theirTurn.push(cr);
        }
        continue;
      }

      // For in_review, check if current user is an assigned reviewer for the current step
      let isYourTurn = false;
      try {
        const resolution = await resolveWorkflowForCategory(
          cr.company_id, cr.category, cr.submitted_by_email, cr.submitted_by_name,
        );
        if (resolution && cr.current_step < resolution.steps.length) {
          const currentStep = resolution.steps[cr.current_step];
          isYourTurn = currentStep.assignees.some((a) => a.email === email);

          // Also check if this reviewer has already approved the current SHA
          if (isYourTurn) {
            const activeApprovals = db.getActiveApprovals(cr.id, cr.current_step);
            const alreadyApproved = activeApprovals.some((a) => a.acted_by_email === email);
            if (alreadyApproved) {
              isYourTurn = false; // Already approved, waiting for others
            }
          }
        }
      } catch {
        // If workflow resolution fails, platform users see it as their turn
        if (req.user!.type === 'platform') {
          isYourTurn = true;
        }
      }

      if (isYourTurn) {
        yourTurn.push(cr);
      } else {
        theirTurn.push(cr);
      }
    }

    // All CRs submitted by this user (any status), sorted by most recent first
    const submitted = db.listChangeRequests(companyId)
      .filter((cr) => cr.submitted_by_email === email)
      .sort((a, b) => {
        const dateA = a.submitted_at || a.created_at || '';
        const dateB = b.submitted_at || b.created_at || '';
        return dateB.localeCompare(dateA);
      });

    res.json({ your_turn: yourTurn, their_turn: theirTurn, submitted });
  } catch (err) {
    console.error('Failed to get my reviews:', err);
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

// ============================================================
// ACKNOWLEDGMENTS (must be before /:crid to avoid route collision)
// ============================================================

/**
 * GET /api/change-requests/acknowledgments
 * Get pending acknowledgments for the current user.
 */
router.get('/acknowledgments', authMiddleware, (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const email = req.user!.email;
    const pending = db.getPendingAcknowledgments(companyId, email);
    res.json({ acknowledgments: pending });
  } catch (err) {
    console.error('Failed to get acknowledgments:', err);
    res.status(500).json({ error: 'Failed to get acknowledgments' });
  }
});

/**
 * POST /api/change-requests/acknowledgments/:id/acknowledge
 * Acknowledge a change.
 */
router.post('/acknowledgments/:id/acknowledge', authMiddleware, (req, res) => {
  try {
    const success = db.acknowledgeChange(String(req.params.id), req.user!.email);
    if (!success) {
      res.status(404).json({ error: 'Acknowledgment not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to acknowledge:', err);
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
});

/**
 * GET /api/change-requests/:crid
 * Change Request details with workflow info, comments, and reviewer status.
 */
router.get('/:crid', authMiddleware, async (req, res) => {
  try {
    const crid = String(req.params.crid);
    const cr = db.getChangeRequest(crid);
    if (!cr) {
      res.status(404).json({ error: 'Change request not found' });
      return;
    }

    const actions = db.getApprovalActions(cr.id);
    const comments = db.getReviewComments(cr.id);

    // Build threaded comments
    const topLevel = comments.filter((c) => !c.parent_id);
    const replies = comments.filter((c) => c.parent_id);
    const threaded = topLevel.map((c) => ({
      ...c,
      resolved: !!(c.resolved as unknown),
      replies: replies.filter((r) => r.parent_id === c.id),
    }));

    // Get redline — from draft branch if still exists, or from merge commit for completed CRs
    let redline = null;
    try {
      const repoDir = getRepoDir(cr.company_id);
      const drafts = await gitEngine.listDrafts(repoDir);
      if (drafts.includes(cr.branch_name)) {
        redline = await gitEngine.getDraftChanges(repoDir, cr.branch_name);
      } else if (cr.status === 'merged' && cr.document_path) {
        // For merged CRs, compare the latest version against the one before it
        const history = await gitEngine.getVersionHistory(repoDir, cr.document_path);
        if (history.length >= 2) {
          redline = await gitEngine.getRedline(repoDir, history[1].id, history[0].id, cr.document_path);
        } else if (history.length === 1) {
          // New document — show entire content as additions
          const content = await gitEngine.getDocument(repoDir, cr.document_path);
          const lines = content.split('\n');
          redline = {
            from_version: 'none',
            to_version: history[0].id,
            changes: [{
              path: cr.document_path,
              type: 'added',
              hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, lines: lines.map(l => '+' + l) }],
            }],
          };
        }
      }
    } catch {
      // Redline not available
    }

    // Build workflow info from actual approval state, not YAML config
    let workflowInfo = null;
    let reviewerStatus: any[] = [];

    workflowInfo = {
      name: 'Approval',
      total_steps: 1,
      steps: [{
        description: 'Approval',
        action: 'approve',
        stepNumber: 0,
        assignees: [],
      }],
    };

    // Build reviewer status from actual approval_actions
    const activeApprovals = db.getActiveApprovals(cr.id, cr.current_step);
    const allActions = actions.filter((a) => !a.dismissed);

    // Collect all unique reviewers who have acted on this CR
    const reviewerMap = new Map<string, { email: string; name: string; status: string; approved_at?: string; commit_sha?: string }>();

    // Add approvers
    for (const approval of activeApprovals) {
      reviewerMap.set(approval.acted_by_email, {
        email: approval.acted_by_email,
        name: approval.acted_by_name,
        status: 'approved',
        approved_at: approval.acted_at,
        commit_sha: approval.commit_sha,
      });
    }

    // Add anyone who performed other actions (request_changes, review) but hasn't approved
    for (const action of allActions) {
      if (!reviewerMap.has(action.acted_by_email) && action.acted_by_email !== cr.submitted_by_email) {
        reviewerMap.set(action.acted_by_email, {
          email: action.acted_by_email,
          name: action.acted_by_name,
          status: 'pending',
        });
      }
    }

    reviewerStatus = Array.from(reviewerMap.values());

    // Count unresolved comments
    const unresolvedCount = db.getUnresolvedCommentCount(cr.id);

    res.json({
      change_request: cr,
      approval_actions: actions,
      comments: threaded,
      unresolved_comment_count: unresolvedCount,
      redline,
      workflow: workflowInfo,
      reviewer_status: reviewerStatus,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get change request' });
  }
});

/**
 * POST /api/change-requests/:crid/approve
 * Approve current step. Approval is tied to the current review_head_sha.
 * When ALL assigned reviewers have approved, advance to next step or merge.
 */
router.post('/:crid/approve', authMiddleware, async (req, res) => {
  try {
    // Must verify email before approving
    if (req.user!.type === 'platform') {
      const pu = db.getPlatformUserByEmail(req.user!.email);
      if (pu && !pu.email_verified) {
        res.status(403).json({ error: 'Please verify your email before approving changes.' });
        return;
      }
    }

    const crid = String(req.params.crid);
    const cr = db.getChangeRequest(crid);
    if (!cr) {
      res.status(404).json({ error: 'Change request not found' });
      return;
    }

    if (cr.status !== 'in_review') {
      res.status(400).json({ error: 'Change request is not in review' });
      return;
    }

    // Check if this reviewer already approved with non-dismissed approval
    const existingApprovals = db.getActiveApprovals(cr.id, cr.current_step);
    if (existingApprovals.some((a) => a.acted_by_email === req.user!.email)) {
      res.status(400).json({ error: 'You have already approved this version' });
      return;
    }

    const { comments } = req.body;

    // Record approval tied to current review SHA
    db.createApprovalAction(
      cr.id,
      req.user!.email,
      req.user!.name,
      'approve',
      cr.current_step,
      comments,
      cr.review_head_sha || undefined,
    );

    // Auto-resolve any unresolved comments by this approver — approval implies satisfaction
    const allComments = db.getReviewComments(cr.id);
    for (const c of allComments) {
      if (!c.resolved && c.author_email === req.user!.email) {
        db.resolveReviewComment(c.id, req.user!.email, req.user!.name);
      }
    }

    // Single-step approval: any approval on this CR merges immediately
    const updatedApprovals = db.getActiveApprovals(cr.id, cr.current_step);
    const totalSteps = 1;
    const allApproved = updatedApprovals.length > 0;

    if (allApproved) {
      const nextStep = cr.current_step + 1;
      const repoDir = getRepoDir(cr.company_id);

      if (nextStep >= totalSteps) {
        // All steps complete — merge the draft into main
        try {
          // Determine if this is a new document or a revision
          let commitPrefix = 'Updated';
          if (cr.document_path) {
            try {
              await gitEngine.getDocument(repoDir, cr.document_path);
            } catch {
              commitPrefix = 'Created';
            }
          }

          const mergeResult = await gitEngine.mergeDraft(
            repoDir,
            cr.branch_name,
            { name: req.user!.name, email: req.user!.email },
            `${commitPrefix}: ${cr.title}`,
          );
          db.updateChangeRequestStatus(cr.id, 'merged', nextStep);

          // PDF generation disabled for now — kept for future use
          // const changedMdFiles = (mergeResult.files_changed || []).filter(
          //   (f) => f.endsWith('.md') && !f.startsWith('.git4docs/'),
          // );
          // for (const docPath of changedMdFiles) {
          //   try {
          //     await generateAndCommitPdf({
          //       repoDir,
          //       companyId: cr.company_id,
          //       docPath,
          //       approvedBy: req.user!.name,
          //       author: { name: req.user!.name, email: req.user!.email },
          //     });
          //   } catch (pdfErr) {
          //     console.error(`PDF generation failed for ${docPath}:`, pdfErr);
          //   }
          // }

          // Create acknowledgment records based on governance rules
          if (cr.document_path) {
            try {
              const gov = await loadGovernanceConfig(repoDir);
              if (gov && gov.acknowledgment_rules.length > 0) {
                const category = cr.category;
                const rule = gov.acknowledgment_rules.find(r => r.document_type.toUpperCase() === category.toUpperCase())
                  || gov.acknowledgment_rules.find(r => r.document_type.toLowerCase() === 'all');

                if (rule) {
                  let emails: string[] = [];
                  const ackBy = rule.acknowledge_by.trim();

                  if (ackBy.toLowerCase() === 'all') {
                    // All editors + all identity users
                    const identityUsers = db.listManualIdentityUsers(cr.company_id);
                    emails = identityUsers.map(u => u.email);
                  } else if (ackBy.toLowerCase() === 'all editors') {
                    // Editors for this category from GOV-003
                    const editors = gov.editors.filter(e =>
                      e.document_types.toLowerCase() === 'all' ||
                      e.document_types.toUpperCase().split(',').map(t => t.trim()).includes(category.toUpperCase())
                    );
                    emails = editors.map(e => e.email);
                  } else {
                    // Comma-separated email list
                    emails = ackBy.split(',').map(e => e.trim()).filter(Boolean);
                  }

                  // Don't require acknowledgment from the submitter or anyone who approved
                  const allApprovalActions = db.getApprovalActions(cr.id);
                  const approverEmails = new Set(allApprovalActions.filter(a => a.action === 'approve').map(a => a.acted_by_email));
                  approverEmails.add(req.user!.email);
                  emails = emails.filter(e => e !== cr.submitted_by_email && !approverEmails.has(e));

                  for (const email of emails) {
                    const identityUser = db.getManualIdentityUser(cr.company_id, email);
                    db.createAcknowledgment(
                      cr.company_id, cr.id, cr.document_path,
                      email, identityUser?.name || email,
                    );
                  }
                }
              }
            } catch (ackErr) {
              console.error('Failed to create acknowledgments:', ackErr);
            }
          }
        } catch (mergeErr) {
          console.error('Merge failed:', mergeErr);
          db.updateChangeRequestStatus(cr.id, 'approved', nextStep);
        }
      } else {
        // More steps remain
        db.updateChangeRequestStatus(cr.id, 'in_review', nextStep);
      }
    }
    // If not all approved yet, status stays as 'in_review' at same step

    res.json({ success: true, change_request: db.getChangeRequest(cr.id) });
  } catch (err) {
    console.error('Failed to approve change request:', err);
    res.status(500).json({ error: 'Failed to approve change request' });
  }
});

/**
 * POST /api/change-requests/:crid/request-changes
 * Send the document back to the author for changes.
 * Transitions: In Review → Changes Requested.
 * Does NOT dismiss existing approvals — those reset only when the author pushes new changes.
 */
router.post('/:crid/request-changes', authMiddleware, (req, res) => {
  try {
    const crid = String(req.params.crid);
    const cr = db.getChangeRequest(crid);
    if (!cr) {
      res.status(404).json({ error: 'Change request not found' });
      return;
    }

    if (cr.status !== 'in_review') {
      res.status(400).json({ error: 'Change request is not in review' });
      return;
    }

    const { comments } = req.body;
    if (!comments) {
      res.status(400).json({ error: 'Comments are required when requesting changes' });
      return;
    }

    db.createApprovalAction(
      cr.id,
      req.user!.email,
      req.user!.name,
      'request_changes',
      cr.current_step,
      comments,
      cr.review_head_sha || undefined,
    );

    db.updateChangeRequestStatus(cr.id, 'changes_requested');

    res.json({ success: true, change_request: db.getChangeRequest(cr.id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to request changes' });
  }
});

/**
 * POST /api/change-requests/:crid/resubmit
 * Author resubmits after making changes.
 * CRITICAL: Dismisses ALL previous approvals because the document has changed.
 */
router.post('/:crid/resubmit', authMiddleware, async (req, res) => {
  try {
    const crid = String(req.params.crid);
    const cr = db.getChangeRequest(crid);
    if (!cr) {
      res.status(404).json({ error: 'Change request not found' });
      return;
    }

    if (cr.status !== 'changes_requested') {
      res.status(400).json({ error: 'Change request is not in Changes Requested state' });
      return;
    }

    // Only the author can resubmit
    if (cr.submitted_by_email !== req.user!.email) {
      res.status(403).json({ error: 'Only the author can resubmit' });
      return;
    }

    // Get the new branch HEAD SHA
    const repoDir = getRepoDir(cr.company_id);
    let newSha: string | undefined;
    try {
      newSha = await gitEngine.getBranchHeadSha(repoDir, cr.branch_name);
    } catch {
      // Continue without SHA
    }

    // Dismiss ALL previous approvals — document has changed
    if (newSha !== cr.review_head_sha) {
      db.dismissApprovals(cr.id, 'Document was modified after review');
    }

    // Update the review SHA and move back to in_review
    if (newSha) {
      db.updateChangeRequestReviewSha(cr.id, newSha);
    }
    db.updateChangeRequestStatus(cr.id, 'in_review', cr.current_step);

    res.json({ success: true, change_request: db.getChangeRequest(cr.id) });
  } catch (err) {
    console.error('Failed to resubmit:', err);
    res.status(500).json({ error: 'Failed to resubmit change request' });
  }
});

/**
 * POST /api/change-requests/:crid/reject
 * Hard reject (permanently close the CR).
 */
router.post('/:crid/reject', authMiddleware, (req, res) => {
  try {
    // Must verify email before rejecting
    if (req.user!.type === 'platform') {
      const pu = db.getPlatformUserByEmail(req.user!.email);
      if (pu && !pu.email_verified) {
        res.status(403).json({ error: 'Please verify your email before rejecting changes.' });
        return;
      }
    }

    const crid = String(req.params.crid);
    const cr = db.getChangeRequest(crid);
    if (!cr) {
      res.status(404).json({ error: 'Change request not found' });
      return;
    }

    const { comments } = req.body;
    if (!comments) {
      res.status(400).json({ error: 'Comments are required when rejecting' });
      return;
    }

    db.createApprovalAction(
      cr.id,
      req.user!.email,
      req.user!.name,
      'reject',
      cr.current_step,
      comments,
      cr.review_head_sha || undefined,
    );

    db.updateChangeRequestStatus(cr.id, 'rejected');

    res.json({ success: true, change_request: db.getChangeRequest(cr.id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject change request' });
  }
});

/**
 * POST /api/change-requests/:crid/comments
 * Add a comment or reply to the change request.
 */
router.post('/:crid/comments', authMiddleware, (req, res) => {
  try {
    const crid = String(req.params.crid);
    const cr = db.getChangeRequest(crid);
    if (!cr) {
      res.status(404).json({ error: 'Change request not found' });
      return;
    }

    const { body, parent_id } = req.body;
    if (!body || !body.trim()) {
      res.status(400).json({ error: 'Comment body is required' });
      return;
    }

    const comment = db.createReviewComment(
      cr.id,
      req.user!.email,
      req.user!.name,
      body.trim(),
      parent_id,
    );

    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * POST /api/change-requests/:crid/comments/:commentId/resolve
 * Mark a comment thread as resolved.
 */
router.post('/:crid/comments/:commentId/resolve', authMiddleware, (req, res) => {
  try {
    const commentId = String(req.params.commentId);
    db.resolveReviewComment(commentId, req.user!.email, req.user!.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve comment' });
  }
});

/**
 * POST /api/change-requests/:crid/comments/:commentId/unresolve
 * Re-open a resolved comment thread.
 */
router.post('/:crid/comments/:commentId/unresolve', authMiddleware, (req, res) => {
  try {
    const commentId = String(req.params.commentId);
    db.unresolveReviewComment(commentId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unresolve comment' });
  }
});

export default router;
