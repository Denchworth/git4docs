/**
 * git4docs Version Routes
 * Version history, save, restore operations.
 *
 * Document path is passed as a query param `?path=POL/POL-001-test.md`
 * since Express 5 doesn't support compound wildcard routes.
 */

import { Router } from 'express';
import path from 'node:path';
import { authMiddleware } from '../middleware/auth.js';
import { gitEngine } from '../git/engine.js';

const router = Router();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage/companies';

function getRepoDir(companyId: string): string {
  return path.resolve(STORAGE_PATH, companyId);
}

function getDocPath(req: { query: Record<string, unknown> }): string | null {
  const p = req.query.path;
  return typeof p === 'string' && p.length > 0 ? p : null;
}

/**
 * POST /api/versions/save
 * Save a new version (git commit)
 * Body: { path: "POL/POL-001.md", message: "Updated section 3" }
 */
router.post('/save', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const { path: docPath, message } = req.body;

    if (!docPath) {
      res.status(400).json({ error: 'Document path is required' });
      return;
    }
    if (!message) {
      res.status(400).json({ error: 'A description of what changed is required' });
      return;
    }

    const version = await gitEngine.saveVersion({
      repoDir,
      paths: [docPath],
      message,
      author: { name: req.user!.name, email: req.user!.email },
    });

    res.status(201).json({ version });
  } catch (err) {
    console.error('Failed to save version:', err);
    res.status(500).json({ error: 'Failed to save version' });
  }
});

/**
 * GET /api/versions?path=POL/POL-001.md
 * Revision history for a document (or all if no path)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const docPath = getDocPath(req);

    const versions = await gitEngine.getVersionHistory(repoDir, docPath || undefined);

    res.json({ versions });
  } catch (err) {
    console.error('Failed to get version history:', err);
    res.status(500).json({ error: 'Failed to get revision history' });
  }
});

/**
 * GET /api/versions/redline?path=POL/POL-001.md&from=abc&to=def
 * Compare two versions (Redline)
 * NOTE: Must be before /:vid to avoid "redline" matching as a version ID.
 */
router.get('/redline', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const docPath = getDocPath(req) || undefined;
    const from = req.query.from as string;
    const to = req.query.to as string;

    if (!from || !to) {
      res.status(400).json({ error: 'Both "from" and "to" version parameters are required' });
      return;
    }

    const redline = await gitEngine.getRedline(repoDir, from, to, docPath);

    res.json({ redline });
  } catch (err) {
    console.error('Failed to generate redline:', err);
    res.status(500).json({ error: 'Failed to generate redline comparison' });
  }
});

/**
 * POST /api/versions/restore
 * Restore a previous version
 * Body: { path: "POL/POL-001.md", version_id: "abc123" }
 */
router.post('/restore', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const { path: docPath, version_id } = req.body;

    if (!docPath || !version_id) {
      res.status(400).json({ error: 'path and version_id are required' });
      return;
    }

    const version = await gitEngine.restorePreviousVersion(
      repoDir,
      version_id,
      docPath,
      { name: req.user!.name, email: req.user!.email },
    );

    res.json({ version });
  } catch (err) {
    console.error('Failed to restore version:', err);
    res.status(500).json({ error: 'Failed to restore previous version' });
  }
});

/**
 * GET /api/versions/:vid?path=POL/POL-001.md
 * Get document content at a specific version
 */
router.get('/:vid', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const docPath = getDocPath(req);
    const versionId = String(req.params.vid);

    if (!docPath) {
      res.status(400).json({ error: 'Document path is required (query param: path)' });
      return;
    }

    const content = await gitEngine.getDocument(repoDir, docPath, versionId);

    res.json({
      path: docPath,
      version: versionId,
      content,
    });
  } catch (err) {
    console.error('Failed to get version:', err);
    res.status(404).json({ error: 'Version not found' });
  }
});

export default router;
