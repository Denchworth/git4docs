/**
 * git4docs Company Routes
 * Company management (owner/admin only)
 */

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, platformOnly, generateToken } from '../middleware/auth.js';
import { gitEngine } from '../git/engine.js';
import * as db from '../db/queries.js';
import type { AuthPayload } from '../../shared/types.js';

const router = Router();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage/companies';
const TEMPLATE_PATH = process.env.TEMPLATE_PATH || './templates';

/**
 * POST /api/companies
 * Create a new company (picks template, inits repo, creates owner account)
 */
router.post('/', async (req, res) => {
  try {
    const { company_name, template, owner_email, owner_name, owner_password } = req.body;

    if (!company_name || !owner_email || !owner_name || !owner_password) {
      res.status(400).json({
        error: 'company_name, owner_email, owner_name, and owner_password are required',
      });
      return;
    }

    // Check if email already exists
    const existing = db.getPlatformUserByEmail(owner_email);
    if (existing) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    const templateName = template || 'general';
    let templateDir = path.resolve(TEMPLATE_PATH, templateName);

    // Fall back to general if the selected template is empty or missing
    try {
      const files = await fs.promises.readdir(templateDir, { recursive: true });
      if (files.length === 0) {
        templateDir = path.resolve(TEMPLATE_PATH, 'general');
      }
    } catch {
      templateDir = path.resolve(TEMPLATE_PATH, 'general');
    }

    // Generate slug from company name
    const slug = company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug) {
      res.status(400).json({ error: 'Company name must contain letters or numbers' });
      return;
    }

    // Check slug uniqueness
    const existingCompany = db.getCompanyBySlug(slug);
    if (existingCompany) {
      res.status(409).json({ error: 'A company with a similar name already exists. Please choose a different name.' });
      return;
    }

    // Create company in DB first to get the ID
    const company = db.createCompany(company_name, '', 'manual');

    // Create the Document Library (git repo)
    const repoPath = await gitEngine.createLibrary({
      companyId: company.id,
      storagePath: path.resolve(STORAGE_PATH),
      templatePath: templateDir,
      companyName: company_name,
      author: { name: owner_name, email: owner_email },
    });

    // Update company with repo path and slug
    db.updateCompany(company.id, { name: company_name });
    db.setCompanySlug(company.id, slug);
    console.log(`Company created: ${company.id}, slug: ${slug}`);

    // Create owner platform user
    const passwordHash = await bcrypt.hash(owner_password, 12);
    const owner = db.createPlatformUser(
      owner_email,
      owner_name,
      company.id,
      'owner',
      passwordHash,
    );

    // Generate token so they can start using the system immediately
    const payload: AuthPayload = {
      user_id: owner.id,
      email: owner.email,
      name: owner.name,
      company_id: company.id,
      role: 'owner',
      type: 'platform',
    };

    const token = generateToken(payload);

    // Mark as verified (no email in open source version)
    db.setVerificationToken(owner.id, uuidv4());

    res.status(201).json({
      company: {
        id: company.id,
        name: company_name,
        slug,
        repo_path: repoPath,
      },
      owner: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
        role: owner.role,
      },
      token,
    });
  } catch (err) {
    console.error('Failed to create company:', err);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

/**
 * GET /api/companies/:id
 * Company details
 */
router.get('/:id', authMiddleware, platformOnly, (req, res) => {
  const company = db.getCompany(String(req.params.id));
  if (!company) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }

  // Verify user belongs to this company
  if (req.user!.type === 'platform' && req.user!.company_id !== company.id) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.json({ company });
});

/**
 * PUT /api/companies/:id
 * Update company settings
 */
router.put('/:id', authMiddleware, platformOnly, (req, res) => {
  const companyId = String(req.params.id);
  if (req.user!.company_id !== companyId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Only allow safe fields
  const { name, identity_provider, revision_format, revision_start } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (identity_provider) updates.identity_provider = identity_provider;
  if (revision_format !== undefined) updates.revision_format = revision_format;
  if (revision_start !== undefined) updates.revision_start = revision_start;

  const updated = db.updateCompany(companyId, updates);
  if (!updated) {
    res.status(404).json({ error: 'Company not found' });
    return;
  }

  res.json({ company: updated });
});

export default router;
