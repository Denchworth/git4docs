# GOV-001: Approval Policy

## Purpose

This document defines who can approve changes to controlled documents and how many approvals are required. The system reads this document to enforce approval rules automatically.

**Edit the table below to configure approval rules for your organization.** When this document is approved, the system immediately applies the updated rules.

## Approval Rules

<table>
<tr><th>Document Type</th><th>Required Approvals</th><th>Approvers</th></tr>
<tr><td>All</td><td>1</td><td>{{OWNER_EMAIL}}</td></tr>
</table>

<!-- HOW TO EDIT THIS TABLE:

Each row defines the approval rules for a document type. "All" applies to every document type unless overridden by a more specific row.

**Required Approvals** — How many approvers must approve before a change is merged. If you list 3 approvers but require 1, any one of them can approve.

**Approvers** — Comma-separated list of email addresses. These people will be assigned as approvers when a Change Request is submitted.

### Examples

To require two approvers for SOPs:

<table>
<tr><td>SOP</td><td>2</td><td>quality.manager@example.com, operations.director@example.com</td></tr>
</table>

To set different rules per document type:

<table>
<tr><td>POL</td><td>2</td><td>ceo@example.com, quality.manager@example.com</td></tr>
<tr><td>SOP</td><td>1</td><td>quality.manager@example.com, operations.manager@example.com</td></tr>
<tr><td>WI</td><td>1</td><td>department.lead@example.com</td></tr>
<tr><td>FRM</td><td>1</td><td>document.control@example.com</td></tr>
</table>

A specific document type row overrides the "All" row for that type.
-->

## Acknowledgment Rules

When a document is approved, the people listed below must read the change and acknowledge it. This does not block the document from becoming effective — it tracks that the right people have been notified and confirmed awareness.

<table>
<tr><th>Document Type</th><th>Acknowledge By</th></tr>
</table>

<!-- HOW TO EDIT THIS TABLE:

Each row specifies who must acknowledge changes for a document type.

**Acknowledge By** — Comma-separated list of email addresses, or "All Editors" to require all editors for that document type, or "All" for everyone.

### Examples

<table>
<tr><td>SOP</td><td>All Editors</td></tr>
<tr><td>POL</td><td>All</td></tr>
<tr><td>WI</td><td>supervisor@example.com, team.lead@example.com</td></tr>
</table>

If no row matches a document type, no acknowledgment is required.
-->

## System Rules

These rules are built into git4docs and cannot be changed:

- **Approval reset**: When a document is edited after receiving approvals, all approvals are automatically dismissed. Approvers must re-approve the new version. This ensures every approval is tied to a specific version of the document.
- **Document locking**: While a document is in review, it cannot be edited. The author must wait for a reviewer to request changes before making modifications.
- **All listed approvers must approve** for a change to be merged (up to the required count).

## Governance

Changes to this document follow the same review and approval workflow as any other document. The current approvers listed above must approve any changes to this policy.
