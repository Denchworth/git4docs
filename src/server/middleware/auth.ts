/**
 * git4docs Auth Middleware
 * Authenticates both platform users and SSO document users.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthToken, AuthPayload, SSOPayload } from '../../shared/types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

declare global {
  namespace Express {
    interface Request {
      user?: AuthToken;
    }
  }
}

export function generateToken(payload: AuthToken): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // Allow token from query param (for iframe/download URLs)
  const queryToken = req.query.token as string | undefined;

  if (!authHeader?.startsWith('Bearer ') && !queryToken) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = queryToken || authHeader!.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthToken;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Require the user to be a platform user (owner or admin)
 */
export function platformOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.type !== 'platform') {
    res.status(403).json({ error: 'Platform access required' });
    return;
  }
  next();
}

/**
 * Require the user to be the owner
 */
export function ownerOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.type !== 'platform' || (req.user as AuthPayload).role !== 'owner') {
    res.status(403).json({ error: 'Owner access required' });
    return;
  }
  next();
}
