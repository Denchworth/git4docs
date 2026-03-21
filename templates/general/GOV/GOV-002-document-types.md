# GOV-002: Document Types

## Purpose

This document defines the categories of controlled documents in your organization. The system reads this document to determine what document types are available, how they are numbered, and how often they should be reviewed.

**Edit the table below to configure document types for your organization.** When this document is approved, the system immediately reflects the updated types.

## Document Types

<table>
<tr><th>Prefix</th><th>Name</th><th>Description</th><th>Review Cycle (months)</th></tr>
<tr><td>POL</td><td>Policy</td><td>High-level organizational policies and principles</td><td>24</td></tr>
<tr><td>SOP</td><td>Standard Operating Procedure</td><td>Step-by-step procedures for routine operations</td><td>12</td></tr>
<tr><td>WI</td><td>Work Instruction</td><td>Detailed task-level instructions for specific activities</td><td>12</td></tr>
<tr><td>FRM</td><td>Form</td><td>Templates, checklists, and forms used in daily operations</td><td>24</td></tr>
</table>

<!-- HOW TO EDIT THIS TABLE:

**Prefix** — A short code used in document numbering (e.g., SOP-001, FRM-012). Must be unique. Use 2-4 uppercase letters.

**Name** — The full name of the document type, displayed in the UI.

**Description** — A brief explanation of what this type is used for.

**Review Cycle (months)** — How often documents of this type should be reviewed. The system uses this to flag documents that are overdue for review.

### Examples

To add equipment calibration records:

<table>
<tr><td>CAL</td><td>Calibration Record</td><td>Equipment calibration records and schedules</td><td>12</td></tr>
</table>

To add training records:

<table>
<tr><td>TRN</td><td>Training Record</td><td>Employee training documentation and certifications</td><td>12</td></tr>
</table>

To add quality records:

<table>
<tr><td>QR</td><td>Quality Record</td><td>Quality inspection and test results</td><td>6</td></tr>
</table>

To remove a document type, delete its row from the table. Existing documents of that type will remain but no new ones can be created.
-->

## Numbering

Documents are numbered automatically using the pattern: `PREFIX-NNN` (e.g., SOP-001, FRM-012). Numbers are assigned sequentially and never reused.
