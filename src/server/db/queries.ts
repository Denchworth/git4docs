/**
 * git4docs Database Queries
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './schema.js';
import type {
  Company,
  PlatformUser,
  PlatformRole,
  ChangeRequest,
  ApprovalAction,
  IdentityUser,
  ReviewComment,
} from '../../shared/types.js';

// ============================================================
// COMPANIES
// ============================================================

export function createCompany(
  name: string,
  repoPath: string,
  identityProvider: string = 'manual',
): Company {
  const db = getDatabase();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO companies (id, name, repo_path, identity_provider) VALUES (?, ?, ?, ?)`,
  ).run(id, name, repoPath, identityProvider);

  return db.prepare(`SELECT * FROM companies WHERE id = ?`).get(id) as Company;
}

export function getCompany(id: string): Company | undefined {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM companies WHERE id = ?`).get(id) as Company | undefined;
}

export function getCompanyBySlug(slug: string): Company | undefined {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM companies WHERE slug = ?`).get(slug) as Company | undefined;
}

export function setCompanySlug(id: string, slug: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE companies SET slug = ? WHERE id = ?`).run(slug, id);
}

export function listCompanies(): Company[] {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM companies ORDER BY created_at DESC`).all() as Company[];
}

export function updateCompany(id: string, updates: Partial<Pick<Company, 'name' | 'identity_provider' | 'revision_format' | 'revision_start'>>): Company | undefined {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.identity_provider) {
    fields.push('identity_provider = ?');
    values.push(updates.identity_provider);
  }
  if (updates.revision_format !== undefined) {
    fields.push('revision_format = ?');
    values.push(updates.revision_format);
  }
  if (updates.revision_start !== undefined) {
    fields.push('revision_start = ?');
    values.push(updates.revision_start);
  }

  if (fields.length === 0) return getCompany(id);

  values.push(id);
  db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getCompany(id);
}

// ============================================================
// PLATFORM USERS
// ============================================================

export function createPlatformUser(
  email: string,
  name: string,
  companyId: string,
  role: PlatformRole,
  passwordHash?: string,
): PlatformUser {
  const db = getDatabase();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO platform_users (id, email, name, company_id, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, email, name, companyId, role, passwordHash || null);

  return db.prepare(`SELECT id, email, name, company_id, role, created_at FROM platform_users WHERE id = ?`).get(id) as PlatformUser;
}

export function getPlatformUser(id: string): PlatformUser | undefined {
  const db = getDatabase();
  return db.prepare(
    `SELECT id, email, name, company_id, role, created_at FROM platform_users WHERE id = ?`,
  ).get(id) as PlatformUser | undefined;
}

export function getPlatformUserByEmail(email: string): (PlatformUser & { password_hash?: string }) | undefined {
  const db = getDatabase();
  return db.prepare(
    `SELECT * FROM platform_users WHERE email = ?`,
  ).get(email) as (PlatformUser & { password_hash?: string }) | undefined;
}

export function setVerificationToken(userId: string, token: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE platform_users SET verification_token = ? WHERE id = ?`).run(token, userId);
}

export function setInviteToken(userId: string, token: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE platform_users SET invite_token = ? WHERE id = ?`).run(token, userId);
}

export function verifyEmail(token: string): PlatformUser | undefined {
  const db = getDatabase();
  const user = db.prepare(`SELECT * FROM platform_users WHERE verification_token = ?`).get(token) as PlatformUser | undefined;
  if (user) {
    db.prepare(`UPDATE platform_users SET email_verified = 1, verification_token = NULL WHERE id = ?`).run(user.id);
  }
  return user;
}

export function getPlatformUserByInviteToken(token: string): (PlatformUser & { password_hash?: string }) | undefined {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM platform_users WHERE invite_token = ?`).get(token) as (PlatformUser & { password_hash?: string }) | undefined;
}

export function setPasswordAndClearInvite(userId: string, passwordHash: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE platform_users SET password_hash = ?, invite_token = NULL, email_verified = 1 WHERE id = ?`).run(passwordHash, userId);
}

export function setResetToken(userId: string, token: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE platform_users SET reset_token = ? WHERE id = ?`).run(token, userId);
}

export function getPlatformUserByResetToken(token: string): (PlatformUser & { password_hash?: string }) | undefined {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM platform_users WHERE reset_token = ?`).get(token) as (PlatformUser & { password_hash?: string }) | undefined;
}

export function clearResetToken(userId: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE platform_users SET reset_token = NULL WHERE id = ?`).run(userId);
}

export function setPasswordAndClearResetToken(userId: string, passwordHash: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE platform_users SET password_hash = ?, reset_token = NULL WHERE id = ?`).run(passwordHash, userId);
}

export function listPlatformUsers(companyId: string): PlatformUser[] {
  const db = getDatabase();
  return db.prepare(
    `SELECT id, email, name, company_id, role, created_at FROM platform_users WHERE company_id = ? ORDER BY created_at`,
  ).all(companyId) as PlatformUser[];
}

export function deletePlatformUser(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM platform_users WHERE id = ? AND role != 'owner'`).run(id);
  return result.changes > 0;
}

// ============================================================
// CHANGE REQUESTS
// ============================================================

export function createChangeRequest(
  companyId: string,
  title: string,
  description: string | undefined,
  branchName: string,
  category: string,
  submittedByEmail: string,
  submittedByName: string,
  documentPath?: string,
): ChangeRequest {
  const db = getDatabase();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO change_requests (id, company_id, title, description, status, branch_name, category, submitted_by_email, submitted_by_name, document_path)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
  ).run(id, companyId, title, description || null, branchName, category, submittedByEmail, submittedByName, documentPath || null);

  return db.prepare(`SELECT * FROM change_requests WHERE id = ?`).get(id) as ChangeRequest;
}

export function getChangeRequest(id: string): ChangeRequest | undefined {
  const db = getDatabase();
  return db.prepare(`SELECT * FROM change_requests WHERE id = ?`).get(id) as ChangeRequest | undefined;
}

export function listChangeRequests(companyId: string, filters?: { status?: string; category?: string }): ChangeRequest[] {
  const db = getDatabase();
  let query = `SELECT * FROM change_requests WHERE company_id = ?`;
  const params: unknown[] = [companyId];

  if (filters?.status) {
    query += ` AND status = ?`;
    params.push(filters.status);
  }
  if (filters?.category) {
    query += ` AND category = ?`;
    params.push(filters.category);
  }

  query += ` ORDER BY created_at DESC`;
  return db.prepare(query).all(...params) as ChangeRequest[];
}

/**
 * Find active change requests for a specific document.
 * Active means not merged, not rejected.
 */
export function getActiveChangeRequestsForDocument(companyId: string, documentPath: string): ChangeRequest[] {
  const db = getDatabase();
  return db.prepare(
    `SELECT * FROM change_requests
     WHERE company_id = ? AND document_path = ? AND status NOT IN ('merged', 'rejected')
     ORDER BY created_at DESC`,
  ).all(companyId, documentPath) as ChangeRequest[];
}

export function updateChangeRequestStatus(id: string, status: string, currentStep?: number): void {
  const db = getDatabase();
  if (currentStep !== undefined) {
    db.prepare(`UPDATE change_requests SET status = ?, current_step = ?, submitted_at = CASE WHEN ? IN ('submitted', 'in_review') AND submitted_at IS NULL THEN CURRENT_TIMESTAMP ELSE submitted_at END WHERE id = ?`)
      .run(status, currentStep, status, id);
  } else {
    db.prepare(`UPDATE change_requests SET status = ?, submitted_at = CASE WHEN ? IN ('submitted', 'in_review') AND submitted_at IS NULL THEN CURRENT_TIMESTAMP ELSE submitted_at END WHERE id = ?`)
      .run(status, status, id);
  }
}

// ============================================================
// APPROVAL ACTIONS
// ============================================================

export function createApprovalAction(
  changeRequestId: string,
  actedByEmail: string,
  actedByName: string,
  action: 'approve' | 'reject' | 'request_changes' | 'review',
  stepNumber: number,
  comments?: string,
  commitSha?: string,
): ApprovalAction {
  const db = getDatabase();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO approval_actions (id, change_request_id, acted_by_email, acted_by_name, action, step_number, comments, commit_sha, dismissed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(id, changeRequestId, actedByEmail, actedByName, action, stepNumber, comments || null, commitSha || null);

  const row = db.prepare(`SELECT * FROM approval_actions WHERE id = ?`).get(id) as Record<string, unknown>;
  return mapApprovalAction(row);
}

export function getApprovalActions(changeRequestId: string): ApprovalAction[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT * FROM approval_actions WHERE change_request_id = ? ORDER BY acted_at`,
  ).all(changeRequestId) as Array<Record<string, unknown>>;
  return rows.map(mapApprovalAction);
}

export function getActiveApprovals(changeRequestId: string, stepNumber?: number): ApprovalAction[] {
  const db = getDatabase();
  let query = `SELECT * FROM approval_actions WHERE change_request_id = ? AND action = 'approve' AND dismissed = 0`;
  const params: unknown[] = [changeRequestId];
  if (stepNumber !== undefined) {
    query += ` AND step_number = ?`;
    params.push(stepNumber);
  }
  query += ` ORDER BY acted_at`;
  const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;
  return rows.map(mapApprovalAction);
}

export function dismissApprovals(changeRequestId: string, reason: string): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE approval_actions SET dismissed = 1, dismissed_reason = ? WHERE change_request_id = ? AND action = 'approve' AND dismissed = 0`,
  ).run(reason, changeRequestId);
}

export function updateChangeRequestReviewSha(id: string, sha: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE change_requests SET review_head_sha = ? WHERE id = ?`).run(sha, id);
}

function mapApprovalAction(row: Record<string, unknown>): ApprovalAction {
  return {
    id: row.id as string,
    change_request_id: row.change_request_id as string,
    acted_by_email: row.acted_by_email as string,
    acted_by_name: row.acted_by_name as string,
    action: row.action as ApprovalAction['action'],
    step_number: row.step_number as number,
    comments: (row.comments as string) || undefined,
    commit_sha: (row.commit_sha as string) || undefined,
    dismissed: row.dismissed === 1,
    dismissed_reason: (row.dismissed_reason as string) || undefined,
    acted_at: row.acted_at as string,
  };
}

// ============================================================
// REVIEW COMMENTS
// ============================================================

export function createReviewComment(
  changeRequestId: string,
  authorEmail: string,
  authorName: string,
  body: string,
  parentId?: string,
): ReviewComment {
  const db = getDatabase();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO review_comments (id, change_request_id, author_email, author_name, body, parent_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, changeRequestId, authorEmail, authorName, body, parentId || null);
  return db.prepare(`SELECT * FROM review_comments WHERE id = ?`).get(id) as ReviewComment;
}

export function getReviewComments(changeRequestId: string): ReviewComment[] {
  const db = getDatabase();
  return db.prepare(
    `SELECT * FROM review_comments WHERE change_request_id = ? ORDER BY created_at`,
  ).all(changeRequestId) as ReviewComment[];
}

export function resolveReviewComment(
  commentId: string,
  resolvedByEmail: string,
  resolvedByName: string,
): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE review_comments SET resolved = 1, resolved_by_email = ?, resolved_by_name = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(resolvedByEmail, resolvedByName, commentId);
}

export function unresolveReviewComment(commentId: string): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE review_comments SET resolved = 0, resolved_by_email = NULL, resolved_by_name = NULL, resolved_at = NULL WHERE id = ?`,
  ).run(commentId);
}

export function getUnresolvedCommentCount(changeRequestId: string): number {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM review_comments WHERE change_request_id = ? AND resolved = 0 AND parent_id IS NULL`,
  ).get(changeRequestId) as { count: number };
  return row.count;
}

// ============================================================
// AUDIT LOG
// ============================================================


// ============================================================
// ACKNOWLEDGMENTS
// ============================================================

export interface Acknowledgment {
  id: string;
  company_id: string;
  change_request_id: string;
  document_path: string;
  user_email: string;
  user_name: string;
  acknowledged_at: string | null;
  created_at: string;
}

export function createAcknowledgment(
  companyId: string, changeRequestId: string, documentPath: string,
  userEmail: string, userName: string,
): void {
  const db = getDatabase();
  const id = uuidv4();
  db.prepare(
    `INSERT OR IGNORE INTO acknowledgments (id, company_id, change_request_id, document_path, user_email, user_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, companyId, changeRequestId, documentPath, userEmail, userName);
}

export function getPendingAcknowledgments(companyId: string, userEmail: string): (Acknowledgment & { cr_title?: string })[] {
  const db = getDatabase();
  return db.prepare(
    `SELECT a.*, cr.title as cr_title FROM acknowledgments a
     JOIN change_requests cr ON a.change_request_id = cr.id
     WHERE a.company_id = ? AND a.user_email = ? AND a.acknowledged_at IS NULL
     ORDER BY a.created_at DESC`,
  ).all(companyId, userEmail) as (Acknowledgment & { cr_title?: string })[];
}

export function acknowledgeChange(id: string, userEmail: string): boolean {
  const db = getDatabase();
  const result = db.prepare(
    `UPDATE acknowledgments SET acknowledged_at = CURRENT_TIMESTAMP WHERE id = ? AND user_email = ?`,
  ).run(id, userEmail);
  return result.changes > 0;
}

export function logAuditEvent(
  companyId: string,
  actorEmail: string,
  actorName: string | null,
  action: string,
  resource?: string,
  details?: Record<string, unknown>,
): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO audit_log (company_id, actor_email, actor_name, action, resource, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(companyId, actorEmail, actorName, action, resource || null, details ? JSON.stringify(details) : null);
}

export function getAuditLog(companyId: string, limit: number = 100, offset: number = 0) {
  const db = getDatabase();
  return db.prepare(
    `SELECT * FROM audit_log WHERE company_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  ).all(companyId, limit, offset);
}

// ============================================================
// USAGE EVENTS
// ============================================================

export function logUsageEvent(
  companyId: string,
  actorEmail: string | null,
  eventType: string,
  metadata?: Record<string, unknown>,
): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO usage_events (company_id, actor_email, event_type, metadata)
     VALUES (?, ?, ?, ?)`,
  ).run(companyId, actorEmail, eventType, metadata ? JSON.stringify(metadata) : null);
}

// ============================================================
// MANUAL IDENTITY USERS
// ============================================================

export function createManualIdentityUser(
  companyId: string,
  user: Omit<IdentityUser, 'is_active' | 'out_of_office'>,
): IdentityUser {
  const db = getDatabase();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO manual_identity_users (id, company_id, email, name, department, title, location, cost_center, reports_to)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, companyId, user.email, user.name,
    user.department || '', user.title || '',
    user.location || '', user.cost_center || '',
    user.reports_to || '',
  );

  return getManualIdentityUser(companyId, user.email)!;
}

export function getManualIdentityUser(companyId: string, email: string): IdentityUser | undefined {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT * FROM manual_identity_users WHERE company_id = ? AND email = ?`,
  ).get(companyId, email) as Record<string, unknown> | undefined;

  if (!row) return undefined;

  return {
    email: row.email as string,
    name: row.name as string,
    department: row.department as string,
    title: row.title as string,
    location: (row.location as string) || undefined,
    cost_center: (row.cost_center as string) || undefined,
    reports_to: (row.reports_to as string) || undefined,
    is_active: row.is_active === 1,
    out_of_office: row.out_of_office === 1,
  };
}

export function listManualIdentityUsers(companyId: string): IdentityUser[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT * FROM manual_identity_users WHERE company_id = ? ORDER BY name`,
  ).all(companyId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    email: row.email as string,
    name: row.name as string,
    department: row.department as string,
    title: row.title as string,
    location: (row.location as string) || undefined,
    cost_center: (row.cost_center as string) || undefined,
    reports_to: (row.reports_to as string) || undefined,
    is_active: row.is_active === 1,
    out_of_office: row.out_of_office === 1,
  }));
}

export function updateManualIdentityUser(
  companyId: string,
  email: string,
  updates: Partial<IdentityUser>,
): IdentityUser | undefined {
  const db = getDatabase();
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'email') continue; // Can't change email (it's the identifier)
    if (key === 'is_active') {
      fields.push('is_active = ?');
      values.push(value ? 1 : 0);
    } else if (key === 'out_of_office') {
      fields.push('out_of_office = ?');
      values.push(value ? 1 : 0);
    } else {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getManualIdentityUser(companyId, email);

  values.push(companyId, email);
  db.prepare(
    `UPDATE manual_identity_users SET ${fields.join(', ')} WHERE company_id = ? AND email = ?`,
  ).run(...values);

  return getManualIdentityUser(companyId, email);
}

export function deleteManualIdentityUser(companyId: string, email: string): boolean {
  const db = getDatabase();
  const result = db.prepare(
    `DELETE FROM manual_identity_users WHERE company_id = ? AND email = ?`,
  ).run(companyId, email);
  return result.changes > 0;
}

