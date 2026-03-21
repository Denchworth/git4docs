/**
 * git4docs Release Routes
 * Mark versions as released with effective dates.
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

/**
 * POST /api/releases
 * Mark a version as released with an effective date
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const { version_id, effective_date, description } = req.body;
    if (!version_id || !effective_date) {
      res.status(400).json({ error: 'version_id and effective_date are required' });
      return;
    }

    const release = await gitEngine.markAsReleased(
      repoDir,
      version_id,
      effective_date,
      description || '',
      { name: req.user!.name, email: req.user!.email },
    );

    res.status(201).json({ release });
  } catch (err) {
    console.error('Failed to create release:', err);
    res.status(500).json({ error: 'Failed to mark version as released' });
  }
});

/**
 * GET /api/releases
 * List all releases
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const releases = await gitEngine.getReleases(repoDir);

    res.json({ releases });
  } catch (err) {
    console.error('Failed to list releases:', err);
    res.status(500).json({ error: 'Failed to list releases' });
  }
});

export default router;
