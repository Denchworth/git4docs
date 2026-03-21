# GOV-003: Roles & Permissions

## Purpose

This document defines who can view, edit, create, and approve documents in your organization. The system reads this document to enforce access control automatically.

**Edit the tables below to configure roles for your organization.** When this document is approved, the system immediately applies the updated permissions.

## Editors

Editors can create new documents and edit existing ones. They can submit Change Requests for review.

<table>
<tr><th>Email</th><th>Name</th><th>Document Types</th></tr>
<tr><td>{{OWNER_EMAIL}}</td><td>{{OWNER_NAME}}</td><td>All</td></tr>
</table>

<!-- HOW TO EDIT THIS TABLE:

**Document Types** — Which document types this person can edit. Use "All" for all types, or list specific prefixes separated by commas (e.g., "SOP, WI").

### Examples

<table>
<tr><td>jane.smith@example.com</td><td>Jane Smith</td><td>SOP, WI</td></tr>
<tr><td>mike.torres@example.com</td><td>Mike Torres</td><td>All</td></tr>
<tr><td>priya.patel@example.com</td><td>Priya Patel</td><td>FRM</td></tr>
</table>
-->

## Approvers

Approvers are defined in GOV-001 (Approval Policy). This section is informational — edit GOV-001 to change who can approve.

## Viewers

All authenticated users can view documents. Viewers do not need to be listed individually. There is no limit on the number of viewers and no per-seat cost for read-only access.

## System Roles

<table>
<tr><th>Role</th><th>What they can do</th></tr>
<tr><td>Admin</td><td>Full access to all features including system configuration and user management</td></tr>
<tr><td>Editor</td><td>Create and edit documents, submit Change Requests</td></tr>
<tr><td>Approver</td><td>Review and approve Change Requests (defined per document type in GOV-001)</td></tr>
<tr><td>Viewer</td><td>Read all documents (no editing or approval capabilities)</td></tr>
</table>

## Notes

- A person can hold multiple roles (e.g., an Editor for SOPs and an Approver for WIs).
- Removing someone from the Editors table revokes their edit access immediately upon approval of the change.
- Adding a new person requires that they have an account in the system. Ask an admin to add them first.
