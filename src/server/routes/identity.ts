/**
 * git4docs Identity Routes
 * Identity provider management and manual user CRUD.
 */

import { Router } from 'express';
import { authMiddleware, platformOnly } from '../middleware/auth.js';
import * as db from '../db/queries.js';
import { ManualIdentityProvider } from '../identity/manual.js';
import { filterUsersByRule } from '../config/matcher.js';
import type { MatchRule } from '../../shared/types.js';

const router = Router({ mergeParams: true });

/**
 * GET /api/companies/:id/identity/status
 * Identity provider connection status
 */
router.get('/status', authMiddleware, platformOnly, (req, res) => {
  const companyId = req.params.id;
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const company = db.getCompany(companyId);
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }

  const userCount = db.listManualIdentityUsers(companyId).length;

  res.json({
    provider: company.identity_provider,
    status: 'connected',
    user_count: userCount,
  });
});

/**
 * POST /api/companies/:id/identity/sync
 * Force refresh user directory cache
 */
router.post('/sync', authMiddleware, platformOnly, async (req, res) => {
  const companyId = req.params.id;
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const provider = new ManualIdentityProvider(companyId);
  await provider.sync();

  res.json({ success: true, message: 'Directory synced' });
});

/**
 * GET /api/companies/:id/identity/preview-match
 * Test a match rule — see who resolves
 */
router.post('/preview-match', authMiddleware, platformOnly, async (req, res) => {
  const companyId = req.params.id;
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { match } = req.body as { match: MatchRule };
  if (!match) {
    res.status(400).json({ error: 'match rule is required' });
    return;
  }

  const allUsers = db.listManualIdentityUsers(companyId);
  const matched = filterUsersByRule(allUsers, match);

  res.json({
    match_rule: match,
    matched_users: matched.map((u) => ({
      email: u.email,
      name: u.name,
      department: u.department,
      title: u.title,
    })),
    total_matched: matched.length,
  });
});

/**
 * GET /api/companies/:id/identity/users
 * List all identity users (manual provider)
 */
router.get('/users', authMiddleware, platformOnly, (req, res) => {
  const companyId = req.params.id;
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const users = db.listManualIdentityUsers(companyId);
  res.json({ users });
});

/**
 * POST /api/companies/:id/identity/users
 * Add a manual identity user
 */
router.post('/users', authMiddleware, platformOnly, (req, res) => {
  try {
    const companyId = req.params.id;
    if (req.user!.company_id !== companyId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { email, name, department, title, location, cost_center, reports_to } = req.body;
    if (!email || !name) {
      res.status(400).json({ error: 'email and name are required' });
      return;
    }

    const user = db.createManualIdentityUser(companyId, {
      email,
      name,
      department: department || '',
      title: title || '',
      location,
      cost_center,
      reports_to,
    });

    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create identity user' });
  }
});

/**
 * PUT /api/companies/:id/identity/users/:email
 * Update a manual identity user
 */
router.put('/users/:email', authMiddleware, platformOnly, (req, res) => {
  const companyId = req.params.id;
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const updated = db.updateManualIdentityUser(companyId, String(req.params.email), req.body);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: updated });
});

/**
 * DELETE /api/companies/:id/identity/users/:email
 * Remove a manual identity user
 */
router.delete('/users/:email', authMiddleware, platformOnly, (req, res) => {
  const companyId = req.params.id;
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const deleted = db.deleteManualIdentityUser(companyId, String(req.params.email));
  if (!deleted) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ success: true });
});

export default router;
