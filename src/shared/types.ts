/**
 * git4docs Shared Types
 * Used by both server and client.
 */

// ============================================================
// IDENTITY & ROLES
// ============================================================

export interface IdentityUser {
  email: string;
  name: string;
  department: string;
  title: string;
  location?: string;
  cost_center?: string;
  reports_to?: string;
  is_active: boolean;
  out_of_office?: boolean;
}

export type PlatformRole = 'owner' | 'admin';
export type DocumentRole = 'approver' | 'editor' | 'viewer' | 'none';

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  company_id: string;
  role: PlatformRole;
  email_verified?: number;
  created_at: string;
}

// ============================================================
// MATCH RULES (used in YAML config)
// ============================================================

export interface MatchRule {
  department?: string;
  title?: string | TitleMatch;
  location?: string;
  cost_center?: string;
  relationship?: string;
  any_of?: MatchRule[];
  all?: boolean;
}

export interface TitleMatch {
  includes?: string;
  any_of?: Array<{ includes: string }>;
}

// ============================================================
// YAML CONFIG TYPES
// ============================================================

export interface CompanyConfig {
  company: {
    name: string;
    industry: string;
  };
  identity: {
    provider: 'azure_ad' | 'okta' | 'google' | 'manual';
    sync_interval: string;
    attributes: string[];
  };
  system_governance: {
    description: string;
    steps: WorkflowStep[];
  };
}

export type CategoryColor = 'purple' | 'blue' | 'green' | 'amber' | 'red' | 'indigo' | 'teal' | 'pink' | 'orange' | 'gray';

export const CATEGORY_COLORS: Record<CategoryColor, { bg: string; text: string }> = {
  purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
  green: { bg: 'bg-green-100', text: 'text-green-700' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
  red: { bg: 'bg-red-100', text: 'text-red-700' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-700' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-700' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export const DEFAULT_CATEGORY_COLORS: Record<string, CategoryColor> = {
  GOV: 'purple',
  POL: 'blue',
  SOP: 'green',
  WI: 'amber',
  FRM: 'teal',
};

export interface CategoryConfig {
  prefix: string;
  name: string;
  description: string;
  color?: CategoryColor;
  workflow: string;
  numbering: 'sequential';
  review_cycle_months: number;
  roles: {
    viewer: { match: MatchRule };
    editor: { match: MatchRule };
    approver: { match: MatchRule };
    creator?: { match: MatchRule };
  };
}

export interface CategoriesConfig {
  categories: CategoryConfig[];
}

export interface WorkflowConfig {
  name: string;
  description: string;
  applies_to: {
    category: string;
  };
  steps: WorkflowStep[];
  on_approve?: {
    notify?: Array<{ match?: MatchRule; role?: string }>;
    training_acknowledgment_required?: boolean;
    effective_date?: 'manual' | 'immediate';
  };
  review_cycle_months?: number;
}

export interface WorkflowStep {
  role?: string;
  match?: MatchRule;
  action: 'submit' | 'review' | 'approve';
  required?: boolean;
  description?: string;
  conditions?: Array<{ field: string; equals: string }>;
  on_unavailable?: {
    fallback?: { match: MatchRule };
    timeout?: string;
    escalate?: { match: MatchRule };
  };
}

// ============================================================
// DOCUMENT TYPES
// ============================================================

export interface DocumentMeta {
  path: string;
  name: string;
  category: string;
  document_id: string;
  last_modified: string;
  last_modified_by: string;
  status: string;
  version_count?: number;
}

export interface Document {
  path: string;
  content: string;
  metadata: DocumentMeta;
}

export interface Version {
  id: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  date: string;
  files_changed?: string[];
}

export interface Redline {
  from_version: string;
  to_version: string;
  changes: RedlineChange[];
}

export interface RedlineChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  hunks: RedlineHunk[];
}

export interface RedlineHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: RedlineLine[];
}

export interface RedlineLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
}

export interface Release {
  tag: string;
  version_id: string;
  effective_date: string;
  released_by: {
    name: string;
    email: string;
  };
  description: string;
  date: string;
}

// ============================================================
// CHANGE REQUESTS
// ============================================================

export interface ChangeRequest {
  id: string;
  company_id: string;
  title: string;
  description?: string;
  status: CRStatus;
  branch_name: string;
  category: string;
  document_path?: string;
  current_step: number;
  review_head_sha?: string;
  submitted_by_email: string;
  submitted_by_name: string;
  submitted_at?: string;
  created_at: string;
}

export type CRStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'merged' | 'rejected';

export interface ApprovalAction {
  id: string;
  change_request_id: string;
  acted_by_email: string;
  acted_by_name: string;
  action: 'approve' | 'reject' | 'request_changes' | 'review';
  step_number: number;
  comments?: string;
  commit_sha?: string;
  dismissed: boolean;
  dismissed_reason?: string;
  acted_at: string;
}

export interface ReviewComment {
  id: string;
  change_request_id: string;
  author_email: string;
  author_name: string;
  body: string;
  parent_id?: string;
  resolved: boolean;
  resolved_by_email?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  replies?: ReviewComment[];
}

// ============================================================
// COMPANY
// ============================================================

export type RevisionFormat = 'letter' | 'number' | 'padded';

export interface Company {
  id: string;
  name: string;
  slug?: string;
  repo_path: string;
  identity_provider: string;
  revision_format: RevisionFormat;
  revision_start: number;
  created_at: string;
}

/**
 * Compute a revision label given:
 *   index: 0-based index in oldest-first order (0 = first version ever)
 *   format: 'letter' | 'number' | 'padded'
 *   start: 0 or 1 (only affects number/padded)
 */
export function formatRevision(index: number, format: RevisionFormat, start: number): string {
  if (format === 'letter') {
    // A, B, C, ..., Z, AA, AB, ...
    let label = '';
    let n = index;
    do {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return label;
  }
  const num = index + start;
  if (format === 'padded') {
    return num.toString().padStart(2, '0');
  }
  return num.toString();
}

// ============================================================
// API TYPES
// ============================================================

export interface AuthPayload {
  user_id: string;
  email: string;
  name: string;
  company_id: string;
  role: PlatformRole;
  type: 'platform';
}

export interface SSOPayload {
  email: string;
  name: string;
  company_id: string;
  type: 'document';
  attributes: Record<string, string>;
}

export type AuthToken = AuthPayload | SSOPayload;

// ============================================================
// PDF TEMPLATE TYPES
// ============================================================

export interface PdfTemplateConfig {
  header_html: string;
  footer_html: string;
  page_size: 'letter' | 'a4';
  margins: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  logo_path?: string;
}

export const PDF_MERGE_FIELDS = [
  '{{DOC_ID}}',
  '{{DOC_TITLE}}',
  '{{CATEGORY}}',
  '{{REVISION}}',
  '{{REVISION_DATE}}',
  '{{EFFECTIVE_DATE}}',
  '{{APPROVED_BY}}',
  '{{COMPANY_NAME}}',
  '{{PAGE_NUMBER}}',
  '{{TOTAL_PAGES}}',
] as const;

export const DEFAULT_PDF_TEMPLATE: PdfTemplateConfig = {
  header_html: `<div style="width:100%;font-size:9px;font-family:Arial,sans-serif;border-bottom:1px solid #ccc;padding:4px 0;display:flex;justify-content:space-between;">
  <span>{{COMPANY_NAME}}</span>
  <span>{{DOC_ID}} Rev {{REVISION}}</span>
</div>`,
  footer_html: `<div style="width:100%;font-size:8px;font-family:Arial,sans-serif;border-top:1px solid #ccc;padding:4px 0;display:flex;justify-content:space-between;">
  <span>Effective: {{EFFECTIVE_DATE}}</span>
  <span>Page {{PAGE_NUMBER}} of {{TOTAL_PAGES}}</span>
</div>`,
  page_size: 'letter',
  margins: { top: '80px', bottom: '60px', left: '60px', right: '60px' },
};

export interface ApiError {
  error: string;
  details?: string;
}

export interface SaveVersionRequest {
  message: string;
  paths: string[];
}

export interface CreateDraftRequest {
  document_path: string;
  description?: string;
}

export interface SubmitChangeRequest {
  title: string;
  description?: string;
  draft_id: string;
}
