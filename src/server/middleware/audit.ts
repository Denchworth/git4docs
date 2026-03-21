/**
 * git4docs Audit Middleware
 * Logs audit entries (actor email + action) for non-git actions.
 */

import type { Request, Response, NextFunction } from 'express';
import { logAuditEvent } from '../db/queries.js';

export function auditMiddleware(action: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Log after the response is sent
    res.on('finish', () => {
      if (!req.user) return;
      if (res.statusCode >= 400) return; // Don't log failed requests

      const companyId = req.user.type === 'platform'
        ? req.user.company_id
        : req.user.company_id;

      if (companyId) {
        logAuditEvent(
          companyId,
          req.user.email,
          req.user.name,
          action,
          req.originalUrl,
          {
            method: req.method,
            status: res.statusCode,
          },
        );
      }
    });

    next();
  };
}
