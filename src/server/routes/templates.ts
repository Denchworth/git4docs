/**
 * git4docs PDF Template Routes
 * Manage PDF header/footer templates stored in .git4docs/config.yaml.
 */

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import git from 'isomorphic-git';
import { authMiddleware, platformOnly } from '../middleware/auth.js';
import { ConfigLoader } from '../config/loader.js';
import { gitEngine } from '../git/engine.js';
import type { PdfTemplateConfig } from '../../shared/types.js';

const router = Router();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage/companies';

function getRepoDir(companyId: string): string {
  return path.resolve(STORAGE_PATH, companyId);
}

/**
 * GET /api/templates/pdf
 * Get current PDF template config
 */
router.get('/pdf', authMiddleware, (req, res) => {
  try {
    const repoDir = getRepoDir(req.user!.company_id);
    const configLoader = new ConfigLoader(repoDir);
    const templates = configLoader.loadPdfTemplates();
    res.json({ templates });
  } catch (err) {
    console.error('Failed to load PDF templates:', err);
    res.status(500).json({ error: 'Failed to load PDF templates' });
  }
});

/**
 * PUT /api/templates/pdf
 * Update PDF template config (platform users only)
 */
router.put('/pdf', authMiddleware, platformOnly, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const configLoader = new ConfigLoader(repoDir);

    const { templates } = req.body as { templates: PdfTemplateConfig };
    if (!templates) {
      res.status(400).json({ error: 'templates object is required' });
      return;
    }

    // Save to config.yaml
    const yamlContent = configLoader.savePdfTemplates(templates);

    // Commit the change
    const docPath = '.git4docs/config.yaml';
    await gitEngine.addDocument(repoDir, docPath, yamlContent);
    await gitEngine.saveVersion({
      repoDir,
      paths: [docPath],
      message: 'Updated PDF templates',
      author: { name: req.user!.name, email: req.user!.email },
    });

    // Read back
    const saved = configLoader.loadPdfTemplates();
    res.json({ templates: saved });
  } catch (err) {
    console.error('Failed to update PDF templates:', err);
    res.status(500).json({ error: 'Failed to update PDF templates' });
  }
});

/**
 * POST /api/templates/pdf/logo
 * Upload a company logo for PDF headers.
 * Accepts base64-encoded image in JSON body.
 */
router.post('/pdf/logo', authMiddleware, platformOnly, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const { data, filename } = req.body as { data: string; filename: string };
    if (!data || !filename) {
      res.status(400).json({ error: 'data (base64) and filename are required' });
      return;
    }

    // Validate file extension
    const ext = path.extname(filename).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.svg'].includes(ext)) {
      res.status(400).json({ error: 'Logo must be PNG, JPG, or SVG' });
      return;
    }

    // Write logo file to .git4docs/assets/
    const logoPath = `.git4docs/assets/logo${ext}`;
    const fullPath = path.join(repoDir, logoPath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

    const buffer = Buffer.from(data, 'base64');
    await fs.promises.writeFile(fullPath, buffer);

    // Stage binary file directly with isomorphic-git
    await git.add({ fs, dir: repoDir, filepath: logoPath });
    await gitEngine.saveVersion({
      repoDir,
      paths: [logoPath],
      message: 'Updated company logo',
      author: { name: req.user!.name, email: req.user!.email },
    });

    // Update config to reference the logo
    const configLoader = new ConfigLoader(repoDir);
    const templates = configLoader.loadPdfTemplates();
    templates.logo_path = logoPath;
    const yamlContent = configLoader.savePdfTemplates(templates);

    await gitEngine.addDocument(repoDir, '.git4docs/config.yaml', yamlContent);
    await gitEngine.saveVersion({
      repoDir,
      paths: ['.git4docs/config.yaml'],
      message: 'Updated logo path in config',
      author: { name: req.user!.name, email: req.user!.email },
    });

    res.json({ logo_path: logoPath });
  } catch (err) {
    console.error('Failed to upload logo:', err);
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

/**
 * GET /api/templates/pdf/logo
 * Serve the company logo file
 */
router.get('/pdf/logo', authMiddleware, (req, res) => {
  try {
    const repoDir = getRepoDir(req.user!.company_id);
    const configLoader = new ConfigLoader(repoDir);
    const templates = configLoader.loadPdfTemplates();

    if (!templates.logo_path) {
      res.status(404).json({ error: 'No logo uploaded' });
      return;
    }

    const fullPath = path.join(repoDir, templates.logo_path);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Logo file not found' });
      return;
    }

    const ext = path.extname(templates.logo_path).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('Failed to serve logo:', err);
    res.status(500).json({ error: 'Failed to serve logo' });
  }
});

export default router;
