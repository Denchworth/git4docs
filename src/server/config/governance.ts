/**
 * Governance Document Parser
 * Reads GOV-001, GOV-002, GOV-003 markdown files and extracts
 * system configuration (approval rules, document types, roles).
 */

import { gitEngine } from '../git/engine.js';
import type { CategoryConfig, WorkflowStep } from '../../shared/types.js';

export interface ApprovalRule {
  document_type: string; // prefix or 'All'
  required_approvals: number;
  approvers: string[]; // email addresses
}

export interface DocumentTypeConfig {
  prefix: string;
  name: string;
  description: string;
  review_cycle_months: number;
}

export interface EditorEntry {
  email: string;
  name: string;
  document_types: string; // 'All' or comma-separated prefixes
}

export interface AcknowledgmentRule {
  document_type: string; // prefix or 'All'
  acknowledge_by: string; // 'All', 'All Editors', or comma-separated emails
}

export interface GovernanceConfig {
  approval_rules: ApprovalRule[];
  acknowledgment_rules: AcknowledgmentRule[];
  document_types: DocumentTypeConfig[];
  editors: EditorEntry[];
}

/**
 * Parse a table (markdown or HTML) into rows of string arrays.
 * Tries HTML first, falls back to markdown pipe tables.
 */
function parseTable(content: string, headerPattern: RegExp): string[][] {
  // Try HTML table first
  const htmlRows = parseHtmlTable(content, headerPattern);
  if (htmlRows.length > 0) return htmlRows;

  // Fall back to markdown pipe table
  return parseMarkdownTable(content, headerPattern);
}

/**
 * Parse an HTML table into rows of string arrays.
 * Finds the table whose header row matches the pattern.
 */
function parseHtmlTable(content: string, headerPattern: RegExp): string[][] {
  // Match all <table>...</table> blocks
  const tableRegex = /<table[\s>][\s\S]*?<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(content)) !== null) {
    const tableHtml = tableMatch[0];

    // Extract header text to check against pattern
    const headerCells = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
      .map(m => m[1].replace(/<[^>]*>/g, '').trim());
    const headerText = headerCells.join(' | ');

    if (!headerPattern.test(headerText)) continue;

    // Extract body rows
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let isFirst = true;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      // Skip the header row (contains <th>)
      if (isFirst && /<th[\s>]/i.test(rowHtml)) {
        isFirst = false;
        continue;
      }
      isFirst = false;

      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(m => m[1].replace(/<[^>]*>/g, '').trim());
      if (cells.length > 0 && cells[0]) {
        rows.push(cells);
      }
    }

    if (rows.length > 0) return rows;
  }

  return [];
}

/**
 * Parse a markdown pipe table into rows of string arrays.
 * Expects: | col1 | col2 | col3 |
 */
function parseMarkdownTable(content: string, headerPattern: RegExp): string[][] {
  const lines = content.split('\n');
  const rows: string[][] = [];
  let inTable = false;
  let headerFound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Look for a table header matching the pattern
    if (!headerFound && trimmed.startsWith('|') && headerPattern.test(trimmed)) {
      headerFound = true;
      inTable = true;
      continue;
    }

    // Skip separator row (|---|---|---|)
    if (inTable && /^\|[\s\-:|]+\|$/.test(trimmed)) {
      continue;
    }

    // Parse data rows
    if (inTable && trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1) // Remove leading/trailing |
        .split('|')
        .map(c => c.trim());
      if (cells.length > 0 && cells[0]) {
        rows.push(cells);
      }
    } else if (inTable && !trimmed.startsWith('|')) {
      // End of table
      inTable = false;
    }
  }

  return rows;
}

/**
 * Sanitize GOV-001 content: extract only the approval rules table from user
 * content and rebuild the document with the canonical template. This prevents
 * users from modifying the informational/system rules sections.
 */
export function sanitizeApprovalPolicy(userContent: string, originalContent: string): string {
  const userRules = parseApprovalPolicy(userContent);
  if (userRules.length === 0) return originalContent;

  // Build new HTML table from extracted rules
  const tableRows = userRules.map(r =>
    `<tr><td>${r.document_type}</td><td>${r.required_approvals}</td><td>${r.approvers.join(', ')}</td></tr>`
  ).join('\n');
  const newTable = `<table>\n<tr><th>Document Type</th><th>Required Approvals</th><th>Approvers</th></tr>\n${tableRows}\n</table>`;

  // Replace the table in the original content
  // Try HTML table first
  const htmlTableRegex = /<table[\s>][\s\S]*?<\/table>/i;
  if (htmlTableRegex.test(originalContent)) {
    return originalContent.replace(htmlTableRegex, newTable);
  }

  // Try markdown table
  const mdTableRegex = /\|[^\n]*Document Type[^\n]*\|[\s\S]*?(?=\n\n|\n<!--)/i;
  if (mdTableRegex.test(originalContent)) {
    return originalContent.replace(mdTableRegex, newTable);
  }

  return originalContent;
}

/**
 * Parse GOV-001 Approval Policy
 */
export function parseApprovalPolicy(content: string): ApprovalRule[] {
  const rows = parseTable(content, /Document Type.*Required.*Approver/i);
  return rows.map(cells => ({
    document_type: cells[0]?.trim() || 'All',
    required_approvals: parseInt(cells[1]?.trim() || '1', 10) || 1,
    approvers: (cells[2] || '').split(',').map(e => e.trim()).filter(Boolean),
  }));
}

/**
 * Parse GOV-001 Acknowledgment Rules
 */
export function parseAcknowledgmentRules(content: string): AcknowledgmentRule[] {
  const rows = parseTable(content, /Document Type.*Acknowledge/i);
  return rows.map(cells => ({
    document_type: cells[0]?.trim() || 'All',
    acknowledge_by: cells[1]?.trim() || '',
  })).filter(r => r.acknowledge_by);
}

/**
 * Parse GOV-002 Document Types
 */
export function parseDocumentTypes(content: string): DocumentTypeConfig[] {
  const rows = parseTable(content, /Prefix.*Name.*Description/i);
  return rows.map(cells => ({
    prefix: cells[0]?.trim() || '',
    name: cells[1]?.trim() || '',
    description: cells[2]?.trim() || '',
    review_cycle_months: parseInt(cells[3]?.trim() || '12', 10) || 12,
  })).filter(dt => dt.prefix);
}

/**
 * Parse GOV-003 Roles & Permissions (editors table)
 */
export function parseRolesAndPermissions(content: string): EditorEntry[] {
  const rows = parseTable(content, /Email.*Name.*Document Types/i);
  return rows.map(cells => ({
    email: cells[0]?.trim() || '',
    name: cells[1]?.trim() || '',
    document_types: cells[2]?.trim() || 'All',
  })).filter(e => e.email);
}

/**
 * Load and parse all governance documents from a company's repo.
 */
export async function loadGovernanceConfig(repoDir: string): Promise<GovernanceConfig | null> {
  try {
    const files = await gitEngine.listDocuments(repoDir);
    const govFiles = files.filter(f => f.path.startsWith('GOV/'));

    let approval_rules: ApprovalRule[] = [];
    let acknowledgment_rules: AcknowledgmentRule[] = [];
    let document_types: DocumentTypeConfig[] = [];
    let editors: EditorEntry[] = [];

    for (const file of govFiles) {
      try {
        const content = await gitEngine.getDocument(repoDir, file.path);

        if (file.path.includes('GOV-001')) {
          approval_rules = parseApprovalPolicy(content);
          acknowledgment_rules = parseAcknowledgmentRules(content);
        } else if (file.path.includes('GOV-002')) {
          document_types = parseDocumentTypes(content);
        } else if (file.path.includes('GOV-003')) {
          editors = parseRolesAndPermissions(content);
        }
      } catch {
        // Skip unreadable governance docs
      }
    }

    return { approval_rules, acknowledgment_rules, document_types, editors };
  } catch {
    return null;
  }
}

/**
 * Convert governance config into CategoryConfig array compatible with existing system.
 */
export function governanceToCategoryConfigs(
  gov: GovernanceConfig,
  ownerEmail: string,
): CategoryConfig[] {
  return gov.document_types.map(dt => {
    // Find approval rule for this type (specific or fallback to 'All')
    const specificRule = gov.approval_rules.find(r =>
      r.document_type.toUpperCase() === dt.prefix.toUpperCase()
    );
    const defaultRule = gov.approval_rules.find(r =>
      r.document_type.toLowerCase() === 'all'
    );
    const rule = specificRule || defaultRule;

    // Find editors for this type
    const typeEditors = gov.editors.filter(e =>
      e.document_types.toLowerCase() === 'all' ||
      e.document_types.toUpperCase().split(',').map(t => t.trim()).includes(dt.prefix.toUpperCase())
    );

    const approverEmails = rule?.approvers || [ownerEmail];
    const editorEmails = typeEditors.map(e => e.email);

    return {
      prefix: dt.prefix,
      name: dt.name,
      description: dt.description,
      workflow: 'governance', // Governance-driven workflow
      numbering: 'sequential' as const,
      review_cycle_months: dt.review_cycle_months,
      roles: {
        viewer: { match: { all: true } },
        editor: {
          match: editorEmails.length > 0
            ? { any_of: editorEmails.map(email => ({ email } as any)) }
            : { all: true },
        },
        approver: {
          match: approverEmails.length > 0
            ? { any_of: approverEmails.map(email => ({ email } as any)) }
            : { all: true },
        },
      },
    };
  });
}

/**
 * Build workflow steps from governance approval rules.
 */
export function governanceToWorkflowSteps(
  gov: GovernanceConfig,
  categoryPrefix: string,
): WorkflowStep[] {
  const specificRule = gov.approval_rules.find(r =>
    r.document_type.toUpperCase() === categoryPrefix.toUpperCase()
  );
  const defaultRule = gov.approval_rules.find(r =>
    r.document_type.toLowerCase() === 'all'
  );
  const rule = specificRule || defaultRule;

  if (!rule) return [];

  return [{
    action: 'approve',
    required: true,
    description: `Requires ${rule.required_approvals} approval(s)`,
    match: {
      any_of: rule.approvers.map(email => ({ email } as any)),
    },
  }];
}
