/**
 * git4docs Terminology Mapping
 * Single source of truth for Git → git4docs term translation.
 * Git terms NEVER appear in UI, API, error messages, or user-facing logs.
 */

export const terminology = {
  // Git Concept → git4docs Term
  gitToPolicy: {
    'main': 'Official Version',
    'master': 'Official Version',
    'commit': 'Save Version',
    'branch': 'Working Draft',
    'merge': 'Incorporate Changes',
    'pull_request': 'Change Request',
    'diff': 'Redline',
    'tag': 'Release',
    'revert': 'Restore Previous Version',
    'log': 'Revision History',
    'conflict': 'Competing Changes',
    'clone': 'Create Library',
    'push': 'Sync',
    'pull': 'Refresh',
    'add': 'Stage',
    'repository': 'Document Library',
  } as const,

  // git4docs Term → Git Concept (reverse lookup)
  policyToGit: {
    'Official Version': 'main',
    'Save Version': 'commit',
    'Working Draft': 'branch',
    'Incorporate Changes': 'merge',
    'Change Request': 'pull_request',
    'Redline': 'diff',
    'Release': 'tag',
    'Restore Previous Version': 'revert',
    'Revision History': 'log',
    'Competing Changes': 'conflict',
    'Document Library': 'repository',
  } as const,

  // Document statuses
  documentStatus: {
    OFFICIAL: 'Official',
    DRAFT: 'Draft In Progress',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    RETURNED: 'Returned for Revision',
    NEEDS_RESOLUTION: 'Needs Resolution',
    SUPERSEDED: 'Superseded',
    ARCHIVED: 'Archived',
  } as const,

  // Change request statuses
  changeRequestStatus: {
    DRAFT: 'draft',
    SUBMITTED: 'submitted',
    UNDER_REVIEW: 'under_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    MERGED: 'merged',
  } as const,
} as const;

export type DocumentStatus = typeof terminology.documentStatus[keyof typeof terminology.documentStatus];
export type ChangeRequestStatus = typeof terminology.changeRequestStatus[keyof typeof terminology.changeRequestStatus];
