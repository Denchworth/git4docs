/**
 * git4docs Document Routes
 * Document operations (any authenticated user)
 */

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import git from 'isomorphic-git';
import { authMiddleware } from '../middleware/auth.js';
import { gitEngine } from '../git/engine.js';
import { getCompany } from '../db/queries.js';
import { ConfigLoader } from '../config/loader.js';
import { RoleResolver } from '../config/role-resolver.js';
import { ManualIdentityProvider } from '../identity/manual.js';
import type { IdentityUser } from '../../shared/types.js';

const router = Router();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage/companies';

function getRepoDir(companyId: string): string {
  return path.resolve(STORAGE_PATH, companyId);
}

function extractPath(params: Record<string, unknown>): string {
  const p = params.path;
  if (Array.isArray(p)) return p.join('/');
  return String(p);
}

/**
 * GET /api/documents
 * List documents in current company
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const documents = await gitEngine.listDocuments(repoDir);

    // Filter by category if specified
    const category = req.query.category as string | undefined;
    const filtered = category
      ? documents.filter((d) => d.category === category)
      : documents;

    res.json({ documents: filtered });
  } catch (err) {
    console.error('Failed to list documents:', err);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

/**
 * POST /api/documents
 * Add a new document
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const { category, title, content } = req.body;
    if (!category || !title) {
      res.status(400).json({ error: 'category and title are required' });
      return;
    }

    // Auto-generate document ID
    const docId = await gitEngine.getNextDocumentNumber(repoDir, category);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `${docId}-${slug}.md`;
    const docPath = `${category}/${filename}`;

    const docContent = content || '';

    await gitEngine.addDocument(repoDir, docPath, docContent);

    // Save version
    const version = await gitEngine.saveVersion({
      repoDir,
      paths: [docPath],
      message: `Added new document: ${docId} ${title}`,
      author: { name: req.user!.name, email: req.user!.email },
    });

    res.status(201).json({
      document: {
        path: docPath,
        document_id: docId,
        title,
        category,
        version: version.id,
      },
    });
  } catch (err) {
    console.error('Failed to add document:', err);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

/**
 * GET /api/documents/permissions
 * Returns per-category create permissions for the current user.
 * Platform users (owner/admin) can always create.
 */
router.get('/permissions', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const configLoader = new ConfigLoader(repoDir);
    const { categories } = configLoader.loadCategories();

    // Platform users (owner/admin) can create in any category
    if (req.user!.type === 'platform') {
      const permissions: Record<string, { can_create: boolean }> = {};
      for (const cat of categories) {
        permissions[cat.prefix] = { can_create: true };
      }
      res.json({ permissions, is_viewer_only: false });
      return;
    }

    // Document users — resolve from identity attributes
    const identityProvider = new ManualIdentityProvider(companyId);
    const roleResolver = new RoleResolver(identityProvider);
    const identityUser = await identityProvider.getUser(req.user!.email);

    if (!identityUser) {
      const permissions: Record<string, { can_create: boolean }> = {};
      for (const cat of categories) {
        permissions[cat.prefix] = { can_create: false };
      }
      res.json({ permissions, is_viewer_only: true });
      return;
    }

    const permissions: Record<string, { can_create: boolean }> = {};
    let highestRole: string = 'none';
    const roleHierarchy = ['none', 'viewer', 'editor', 'approver'];
    for (const cat of categories) {
      permissions[cat.prefix] = { can_create: roleResolver.canCreate(identityUser, cat) };
      const role = roleResolver.resolveRole(identityUser, cat);
      if (roleHierarchy.indexOf(role) > roleHierarchy.indexOf(highestRole)) {
        highestRole = role;
      }
    }
    const isViewerOnly = highestRole === 'viewer' || highestRole === 'none';
    res.json({ permissions, is_viewer_only: isViewerOnly });
  } catch (err) {
    console.error('Failed to get permissions:', err);
    res.status(500).json({ error: 'Failed to get permissions' });
  }
});

/**
 * GET /api/documents/pdfs?doc_id=POL-001
 * List available PDFs for a document (by doc_id prefix)
 */
router.get('/pdfs', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const docId = req.query.doc_id as string;
    if (!docId) {
      res.status(400).json({ error: 'doc_id query parameter is required' });
      return;
    }

    await gitEngine.ensureOnMain(repoDir);
    const files = await git.listFiles({ fs, dir: repoDir, ref: 'HEAD' });
    const prefix = `${docId}_Rev`;
    const pdfs = files
      .filter((f) => f.endsWith('.pdf') && path.basename(f).startsWith(prefix))
      .map((f) => {
        const name = path.basename(f, '.pdf');
        const revMatch = name.match(/_Rev(.+)$/);
        return {
          path: f,
          filename: path.basename(f),
          revision: revMatch ? revMatch[1] : '',
        };
      })
      .sort((a, b) => a.filename.localeCompare(b.filename));

    res.json({ pdfs });
  } catch (err) {
    console.error('Failed to list PDFs:', err);
    res.status(500).json({ error: 'Failed to list PDFs' });
  }
});

/**
 * GET /api/documents/pdf/:path(*)
 * Serve a PDF file
 */
router.get('/pdf/{*path}', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const pdfPath = extractPath(req.params);
    const fullPath = path.join(repoDir, pdfPath);

    if (!pdfPath.endsWith('.pdf')) {
      res.status(400).json({ error: 'Not a PDF file' });
      return;
    }

    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'PDF not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(pdfPath)}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('Failed to serve PDF:', err);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
});

/**
 * GET /api/documents/:path(*)
 * Get document content
 */
router.get('/{*path}', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const docPath = extractPath(req.params);

    const version = req.query.version as string | undefined;
    const content = await gitEngine.getDocument(repoDir, docPath, version);

    res.json({
      path: docPath,
      content,
      version: version || 'latest',
    });
  } catch (err) {
    console.error('Failed to get document:', err);
    res.status(404).json({ error: 'Document not found' });
  }
});

/**
 * PUT /api/documents/:path(*)
 * Update document content
 */
router.put('/{*path}', authMiddleware, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const docPath = extractPath(req.params);

    const { content } = req.body;
    if (content === undefined) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    await gitEngine.addDocument(repoDir, docPath, content);

    res.json({ path: docPath, updated: true });
  } catch (err) {
    console.error('Failed to update document:', err);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

export default router;
