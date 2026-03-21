/**
 * Subdomain middleware
 * Extracts company slug from subdomain and attaches company_id to request.
 * e.g., acme.git4docs.ai → slug = "acme"
 */

import type { Request, Response, NextFunction } from 'express';
import * as db from '../db/queries.js';

const ROOT_DOMAINS = ['git4docs.app', 'git4docs.ai', 'git4docs.com', 'localhost'];

export function subdomainMiddleware(req: Request, res: Response, next: NextFunction): void {
  const host = req.hostname || req.headers.host?.split(':')[0] || '';

  // Check if this is a subdomain request
  let slug: string | null = null;
  for (const root of ROOT_DOMAINS) {
    if (host.endsWith(`.${root}`)) {
      slug = host.slice(0, -(root.length + 1));
      break;
    }
  }

  // No subdomain — root domain request
  if (!slug || slug === 'www') {
    next();
    return;
  }

  // Look up company by slug — if found, attach to request
  const company = db.getCompanyBySlug(slug);
  if (company) {
    (req as any).companySlug = slug;
    (req as any).companyIdFromSlug = company.id;
  }
  next();
}
