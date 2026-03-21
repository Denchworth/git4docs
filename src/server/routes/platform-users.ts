/**
 * git4docs Platform User Routes
 * Platform user CRUD (owner/admin only)
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, platformOnly, ownerOnly } from '../middleware/auth.js';
import * as db from '../db/queries.js';

const router = Router({ mergeParams: true });

/**
 * GET /api/companies/:id/platform-users
 * List platform users for a company
 */
router.get('/', authMiddleware, platformOnly, (req, res) => {
  const companyId = req.params.id;
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const users = db.listPlatformUsers(companyId);
  res.json({ users });
});

/**
 * POST /api/companies/:id/platform-users
 * Invite a new platform user (admin)
 */
router.post('/', authMiddleware, ownerOnly, async (req, res) => {
  try {
    const companyId = req.params.id;
    if (req.user!.company_id !== companyId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Owner must verify email before adding users
    const currentUser = db.getPlatformUserByEmail(req.user!.email);
    if (currentUser && !currentUser.email_verified) {
      res.status(403).json({ error: 'Please verify your email before adding users. Check your inbox for the verification link.' });
      return;
    }

    const { user_id } = req.body;
    if (!user_id) {
      res.status(400).json({ error: 'user_id is required' });
      return;
    }

    // Look up the identity user by email to get their name
    const identityUser = db.getManualIdentityUser(companyId, user_id);
    if (!identityUser) {
      res.status(404).json({ error: 'User not found in identity directory' });
      return;
    }

    const existing = db.getPlatformUserByEmail(identityUser.email);
    if (existing) {
      res.status(409).json({ error: 'This user is already a platform user' });
      return;
    }

    // Admin accounts — send invite email to set password
    const user = db.createPlatformUser(identityUser.email, identityUser.name, companyId, 'admin');

    const inviteToken = uuidv4();
    db.setInviteToken(user.id, inviteToken);
    // In production, send invite email here
    console.log(`Admin invite token for ${identityUser.email}: ${inviteToken}`);

    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create platform user' });
  }
});

/**
 * DELETE /api/companies/:id/platform-users/:uid
 * Remove a platform user (owner only, cannot remove owner)
 */
router.delete('/:uid', authMiddleware, ownerOnly, (req, res) => {
  const companyId = req.params.id;
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const deleted = db.deletePlatformUser(String(req.params.uid));
  if (!deleted) {
    res.status(404).json({ error: 'User not found or cannot delete owner' });
    return;
  }

  res.json({ success: true });
});

export default router;
