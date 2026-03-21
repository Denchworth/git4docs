/**
 * git4docs Auth Routes
 * Login, email verification, password setup.
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import * as db from '../db/queries.js';

import type { AuthPayload } from '../../shared/types.js';

const router = Router();


/**
 * POST /api/auth/login
 * Platform user login (email + password)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = db.getPlatformUserByEmail(email);
    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const payload: AuthPayload = {
      user_id: user.id,
      email: user.email,
      name: user.name,
      company_id: user.company_id,
      role: user.role,
      type: 'platform',
    };

    const token = generateToken(payload);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Current user info (works for both platform and document users)
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/verify
 * Verify email address with token.
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    const user = db.verifyEmail(token);
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification link' });
      return;
    }

    res.json({ success: true, email: user.email });
  } catch (err) {
    console.error('Verification failed:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * POST /api/auth/setup-password
 * Set password for an invited admin user.
 */
router.post('/setup-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const user = db.getPlatformUserByInviteToken(token);
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired invite link' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.setPasswordAndClearInvite(user.id, passwordHash);

    // Auto-login
    const payload: AuthPayload = {
      user_id: user.id,
      email: user.email,
      name: user.name,
      company_id: user.company_id,
      role: user.role,
      type: 'platform',
    };

    const authToken = generateToken(payload);

    res.json({
      success: true,
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch (err) {
    console.error('Password setup failed:', err);
    res.status(500).json({ error: 'Password setup failed' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset link. Always returns success to avoid email enumeration.
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const user = db.getPlatformUserByEmail(email);
    if (user) {
      const token = uuidv4();
      db.setResetToken(user.id, token);

      // Determine company slug for URL
      let companySlug: string | undefined;
      if (user.company_id) {
        const company = db.getCompany(user.company_id);
        companySlug = (company as any)?.slug;
      }

      // In production, send password reset email here
      console.log(`Password reset token for ${email}: ${token}`);
    }

    // Always return success to avoid email enumeration
    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password failed:', err);
    res.status(500).json({ error: 'Request failed' });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using a reset token.
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Validate password complexity
    if (!/[A-Z]/.test(password)) {
      res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
      return;
    }
    if (!/[a-z]/.test(password)) {
      res.status(400).json({ error: 'Password must contain at least one lowercase letter' });
      return;
    }
    if (!/[0-9]/.test(password)) {
      res.status(400).json({ error: 'Password must contain at least one number' });
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      res.status(400).json({ error: 'Password must contain at least one special character' });
      return;
    }

    const user = db.getPlatformUserByResetToken(token);
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset link' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.setPasswordAndClearResetToken(user.id, passwordHash);

    res.json({ success: true });
  } catch (err) {
    console.error('Password reset failed:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

export default router;
