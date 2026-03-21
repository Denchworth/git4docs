/**
 * git4docs Working Draft Routes
 * Working Drafts (git branches)
 */

import { Router } from 'express';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { gitEngine } from '../git/engine.js';
import { ConfigLoader } from '../config/loader.js';
import { RoleResolver } from '../config/role-resolver.js';
import { ManualIdentityProvider } from '../identity/manual.js';
import * as db from '../db/queries.js';
import { sanitizeApprovalPolicy } from '../config/governance.js';
import type { IdentityUser } from '../../shared/types.js';

const router = Router();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage/companies';

function getRepoDir(companyId: string): string {
  return path.resolve(STORAGE_PATH, companyId);
}

/**
 * POST /api/drafts
 * Create a Working Draft.
 * Enforces: one active CR per document, edit permission required.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const { document_path, description } = req.body;
    if (!document_path) {
      res.status(400).json({ error: 'document_path is required' });
      return;
    }

    // Check for active Change Requests on this document
    const activeCRs = db.getActiveChangeRequestsForDocument(companyId, document_path);
    if (activeCRs.length > 0) {
      const cr = activeCRs[0];
      res.status(409).json({
        error: `This document already has an active Change Request: "${cr.title}" (${cr.status})`,
        change_request_id: cr.id,
      });
      return;
    }

    // Check edit permission (platform users always can; document users need editor role)
    if (req.user!.type !== 'platform') {
      const category = document_path.split('/')[0];
      const configLoader = new ConfigLoader(repoDir);
      const cat = configLoader.getCategory(category);
      if (cat) {
        const identityProvider = new ManualIdentityProvider(companyId);
        const roleResolver = new RoleResolver(identityProvider);
        const identityUser = await identityProvider.getUser(req.user!.email);
        if (!identityUser || roleResolver.resolveRole(identityUser, cat) === 'none') {
          res.status(403).json({ error: 'You do not have edit permission for this document' });
          return;
        }
        const role = roleResolver.resolveRole(identityUser, cat);
        if (role !== 'editor' && role !== 'approver') {
          res.status(403).json({ error: 'You do not have edit permission for this document' });
          return;
        }
      }
    }

    // Get current revision info for "from RevN" context
    const versions = await gitEngine.getVersionHistory(repoDir, document_path);
    const fromRevision = versions.length;

    // Create a branch name from the doc path
    const sanitized = document_path
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
    const shortId = uuidv4().slice(0, 8);
    const draftName = `draft/${sanitized}-${shortId}`;

    await gitEngine.createDraft(repoDir, draftName);

    // Switch back to main so the default branch stays clean
    await gitEngine.switchToDraft(repoDir, 'main');

    res.status(201).json({
      draft: {
        name: draftName,
        document_path,
        description: description || '',
        created_by: req.user!.email,
        from_revision: fromRevision,
      },
    });
  } catch (err) {
    console.error('Failed to create working draft:', err);
    res.status(500).json({ error: 'Failed to create working draft' });
  }
});

/**
 * GET /api/drafts
 * List active Working Drafts
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const drafts = await gitEngine.listDrafts(repoDir);

    res.json({
      drafts: drafts.map((name) => ({
        name,
      })),
    });
  } catch (err) {
    console.error('Failed to list working drafts:', err);
    res.status(500).json({ error: 'Failed to list working drafts' });
  }
});

/**
 * GET /api/drafts/changes?branch=draft/xxx
 * Get what changed in a draft vs main (redline)
 */
router.get('/changes', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const branch = req.query.branch as string;

    if (!branch) {
      res.status(400).json({ error: 'branch query parameter is required' });
      return;
    }

    const redline = await gitEngine.getDraftChanges(repoDir, branch);
    res.json({ redline });
  } catch (err) {
    console.error('Failed to get draft changes:', err);
    res.status(500).json({ error: 'Failed to get draft changes' });
  }
});

/**
 * GET /api/drafts/document?branch=draft/xxx&path=POL/POL-001.md
 * Read a document from a specific draft branch
 */
router.get('/document', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const branch = req.query.branch as string;
    const docPath = req.query.path as string;

    if (!branch || !docPath) {
      res.status(400).json({ error: 'branch and path query parameters are required' });
      return;
    }

    const content = await gitEngine.getDocumentOnBranch(repoDir, docPath, branch);
    res.json({ path: docPath, content, branch });
  } catch (err) {
    console.error('Failed to get document on branch:', err);
    res.status(404).json({ error: 'Document not found on branch' });
  }
});

/**
 * POST /api/drafts/save-version
 * Write content + commit on a specific draft branch (atomic operation)
 */
router.post('/save-version', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const { branch, path: docPath, message, content } = req.body;

    if (!branch || !docPath || !message) {
      res.status(400).json({ error: 'branch, path, and message are required' });
      return;
    }

    // Document locking: prevent edits while the document is In Review
    const activeCRs = db.getActiveChangeRequestsForDocument(companyId, docPath);
    const lockedCR = activeCRs.find((cr) => cr.status === 'in_review');
    if (lockedCR) {
      res.status(423).json({
        error: 'Document is locked — it is currently In Review. Edits are not allowed until a reviewer requests changes.',
        change_request_id: lockedCR.id,
      });
      return;
    }

    // For GOV-001, only allow changes to the approval rules table
    let finalContent = content;
    if (content && docPath.includes('GOV-001')) {
      try {
        const original = await gitEngine.getDocument(repoDir, docPath);
        finalContent = sanitizeApprovalPolicy(content, original);
      } catch {
        // New document — no original to protect
      }
    }

    const version = await gitEngine.saveVersionOnBranch({
      repoDir,
      paths: [docPath],
      message,
      author: { name: req.user!.name, email: req.user!.email },
      branch,
      content: finalContent,
      docPath,
    });

    res.status(201).json({ version });
  } catch (err) {
    console.error('Failed to save version on branch:', err);
    res.status(500).json({ error: 'Failed to save version on branch' });
  }
});

/**
 * DELETE /api/drafts/:name(*)
 * Discard a Working Draft
 */
router.delete('/{*name}', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const draftName = Array.isArray(req.params.name) ? req.params.name.join('/') : String(req.params.name);

    await gitEngine.discardDraft(repoDir, draftName);

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to discard working draft:', err);
    res.status(500).json({ error: 'Failed to discard working draft' });
  }
});

export default router;
