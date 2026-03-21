/**
 * git4docs API Client
 * All communication with the backend goes through here.
 */

const API_BASE = '/api';

let authToken: string | null = localStorage.getItem('git4docs_token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('git4docs_token', token);
  } else {
    localStorage.removeItem('git4docs_token');
  }
}

export function getToken(): string | null {
  return authToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Authentication required');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data as T;
}

// ============================================================
// AUTH
// ============================================================

export async function login(email: string, password: string) {
  const data = await request<{ token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

export async function signup(params: {
  company_name: string;
  owner_email: string;
  owner_name: string;
  owner_password: string;
  template?: string;
}) {
  const data = await request<{ company: any; owner: any; token: string }>('/companies', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  setToken(data.token);
  return data;
}

export async function getMe() {
  return request<{ user: any }>('/auth/me');
}

// ============================================================
// CATEGORIES
// ============================================================

export async function listCategories() {
  return request<{ categories: any[] }>('/categories');
}

export async function updateCategories(categories: any[]) {
  return request<{ categories: any[] }>('/categories', {
    method: 'PUT',
    body: JSON.stringify({ categories }),
  });
}

// ============================================================
// DOCUMENTS
// ============================================================

export async function listDocuments(category?: string) {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  return request<{ documents: any[] }>(`/documents${q}`);
}

export async function getDocument(docPath: string, version?: string) {
  const q = version ? `?version=${encodeURIComponent(version)}` : '';
  return request<{ path: string; content: string; version: string }>(
    `/documents/${docPath}${q}`,
  );
}

export async function getDocumentPermissions() {
  return request<{ permissions: Record<string, { can_create: boolean }>; is_viewer_only: boolean }>('/documents/permissions');
}

export async function createDocument(category: string, title: string, content?: string) {
  return request<{ document: any }>('/documents', {
    method: 'POST',
    body: JSON.stringify({ category, title, content }),
  });
}

export async function listDocumentPdfs(docId: string) {
  return request<{ pdfs: Array<{ path: string; filename: string; revision: string }> }>(
    `/documents/pdfs?doc_id=${encodeURIComponent(docId)}`,
  );
}

export function getDocumentPdfUrl(pdfPath: string): string {
  const token = getToken();
  const base = `${API_BASE}/documents/pdf/${pdfPath}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export async function updateDocument(docPath: string, content: string) {
  return request<{ path: string; updated: boolean }>(`/documents/${docPath}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

// ============================================================
// VERSIONS
// ============================================================

export async function saveVersion(docPath: string, message: string) {
  return request<{ version: any }>('/versions/save', {
    method: 'POST',
    body: JSON.stringify({ path: docPath, message }),
  });
}

export async function getVersionHistory(docPath?: string) {
  const q = docPath ? `?path=${encodeURIComponent(docPath)}` : '';
  return request<{ versions: any[] }>(`/versions${q}`);
}

export async function getVersionContent(versionId: string, docPath: string) {
  return request<{ path: string; version: string; content: string }>(
    `/versions/${versionId}?path=${encodeURIComponent(docPath)}`,
  );
}

export async function restoreVersion(docPath: string, versionId: string) {
  return request<{ version: any }>('/versions/restore', {
    method: 'POST',
    body: JSON.stringify({ path: docPath, version_id: versionId }),
  });
}

export async function getRedline(docPath: string, from: string, to: string) {
  return request<{ redline: any }>(
    `/versions/redline?path=${encodeURIComponent(docPath)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
}

// ============================================================
// DRAFTS
// ============================================================

export async function createDraft(documentPath: string, description?: string) {
  return request<{ draft: any }>('/drafts', {
    method: 'POST',
    body: JSON.stringify({ document_path: documentPath, description }),
  });
}

export async function listDrafts() {
  return request<{ drafts: any[] }>('/drafts');
}

export async function deleteDraft(name: string) {
  return request<{ success: boolean }>(`/drafts/${name}`, {
    method: 'DELETE',
  });
}

export async function getDraftDocument(branch: string, docPath: string) {
  return request<{ path: string; content: string; branch: string }>(
    `/drafts/document?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(docPath)}`,
  );
}

export async function saveDraftVersion(branch: string, docPath: string, message: string, content?: string) {
  return request<{ version: any }>('/drafts/save-version', {
    method: 'POST',
    body: JSON.stringify({ branch, path: docPath, message, content }),
  });
}

export async function getDraftChanges(branch: string) {
  return request<{ redline: any }>(
    `/drafts/changes?branch=${encodeURIComponent(branch)}`,
  );
}

// ============================================================
// CHANGE REQUESTS
// ============================================================

export async function submitChangeRequest(title: string, description: string, branchName: string, category: string, documentPath?: string) {
  return request<{ change_request: any }>('/change-requests', {
    method: 'POST',
    body: JSON.stringify({ title, description, branch_name: branchName, category, document_path: documentPath }),
  });
}

export async function getMyReviews() {
  return request<{ your_turn: any[]; their_turn: any[]; submitted: any[] }>('/change-requests/my-reviews');
}

export async function getPendingAcknowledgments() {
  return request<{ acknowledgments: any[] }>('/change-requests/acknowledgments');
}

export async function acknowledgeChange(id: string) {
  return request<{ success: boolean }>(`/change-requests/acknowledgments/${id}/acknowledge`, { method: 'POST' });
}

export async function listChangeRequests(status?: string, category?: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  const q = params.toString() ? `?${params}` : '';
  return request<{ change_requests: any[] }>(`/change-requests${q}`);
}

export async function getChangeRequest(id: string) {
  return request<{ change_request: any; approval_actions: any[]; comments?: any[]; unresolved_comment_count?: number; reviewer_status?: any[]; redline?: any; workflow?: any }>(`/change-requests/${id}`);
}

export async function approveChangeRequest(id: string, comments?: string) {
  return request<{ success: boolean; change_request: any }>(`/change-requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comments }),
  });
}

export async function requestChanges(id: string, comments: string) {
  return request<{ success: boolean; change_request: any }>(`/change-requests/${id}/request-changes`, {
    method: 'POST',
    body: JSON.stringify({ comments }),
  });
}

export async function resubmitChangeRequest(id: string) {
  return request<{ success: boolean; change_request: any }>(`/change-requests/${id}/resubmit`, {
    method: 'POST',
  });
}

export async function rejectChangeRequest(id: string, comments: string) {
  return request<{ success: boolean; change_request: any }>(`/change-requests/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comments }),
  });
}

export async function addReviewComment(crId: string, body: string, parentId?: string) {
  return request<{ comment: any }>(`/change-requests/${crId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body, parent_id: parentId }),
  });
}

export async function resolveComment(crId: string, commentId: string) {
  return request<{ success: boolean }>(`/change-requests/${crId}/comments/${commentId}/resolve`, {
    method: 'POST',
  });
}

export async function unresolveComment(crId: string, commentId: string) {
  return request<{ success: boolean }>(`/change-requests/${crId}/comments/${commentId}/unresolve`, {
    method: 'POST',
  });
}

// ============================================================
// RELEASES
// ============================================================

export async function createRelease(versionId: string, effectiveDate: string, description?: string) {
  return request<{ release: any }>('/releases', {
    method: 'POST',
    body: JSON.stringify({ version_id: versionId, effective_date: effectiveDate, description }),
  });
}

export async function listReleases() {
  return request<{ releases: any[] }>('/releases');
}

// ============================================================
// PDF TEMPLATES
// ============================================================

export async function getPdfTemplates() {
  return request<{ templates: any }>('/templates/pdf');
}

export async function updatePdfTemplates(templates: any) {
  return request<{ templates: any }>('/templates/pdf', {
    method: 'PUT',
    body: JSON.stringify({ templates }),
  });
}

export async function uploadLogo(data: string, filename: string) {
  return request<{ logo_path: string }>('/templates/pdf/logo', {
    method: 'POST',
    body: JSON.stringify({ data, filename }),
  });
}

// ============================================================
// IDENTITY (admin only)
// ============================================================

export async function listIdentityUsers(companyId: string) {
  return request<{ users: any[] }>(`/companies/${companyId}/identity/users`);
}

export async function createIdentityUser(companyId: string, user: any) {
  return request<{ user: any }>(`/companies/${companyId}/identity/users`, {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

export async function previewMatch(companyId: string, match: any) {
  return request<{ matched_users: any[]; total_matched: number }>(
    `/companies/${companyId}/identity/preview-match`,
    {
      method: 'POST',
      body: JSON.stringify({ match }),
    },
  );
}

// ============================================================
// PLATFORM USERS (owner only)
// ============================================================

export async function listPlatformUsers(companyId: string) {
  return request<{ users: any[] }>(`/companies/${companyId}/platform-users`);
}

export async function createPlatformUser(companyId: string, userId: string) {
  return request<{ user: any }>(`/companies/${companyId}/platform-users`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function getCompanySettings(companyId: string) {
  return request<{ company: any }>(`/companies/${companyId}`);
}

export async function updateCompanySettings(companyId: string, settings: Record<string, unknown>) {
  return request<{ company: any }>(`/companies/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

