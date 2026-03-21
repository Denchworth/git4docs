/**
 * git4docs Category Routes
 * Read and manage document categories from the repo's .git4docs/categories.yaml.
 */

import { Router } from 'express';
import path from 'node:path';
import yaml from 'js-yaml';
import { authMiddleware, platformOnly } from '../middleware/auth.js';
import { ConfigLoader } from '../config/loader.js';
import { gitEngine } from '../git/engine.js';
import type { CategoryConfig, CategoriesConfig } from '../../shared/types.js';

const router = Router();

const STORAGE_PATH = process.env.STORAGE_PATH || './storage/companies';

function getRepoDir(companyId: string): string {
  return path.resolve(STORAGE_PATH, companyId);
}

/**
 * GET /api/categories
 * List categories for the current company (any authenticated user)
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);
    const configLoader = new ConfigLoader(repoDir);
    const { categories } = configLoader.loadCategories();
    res.json({ categories });
  } catch (err) {
    console.error('Failed to load categories:', err);
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

/**
 * PUT /api/categories
 * Replace all categories (platform users only).
 * Writes categories.yaml and commits the change.
 */
router.put('/', authMiddleware, platformOnly, async (req, res) => {
  try {
    const companyId = req.user!.company_id;
    const repoDir = getRepoDir(companyId);

    const { categories } = req.body as { categories: CategoryConfig[] };
    if (!Array.isArray(categories) || categories.length === 0) {
      res.status(400).json({ error: 'categories array is required and must not be empty' });
      return;
    }

    // Validate each category
    for (const cat of categories) {
      if (!cat.prefix || !cat.name) {
        res.status(400).json({ error: 'Each category requires prefix and name' });
        return;
      }
      if (!/^[A-Z]{2,5}$/.test(cat.prefix)) {
        res.status(400).json({ error: `Invalid prefix "${cat.prefix}": must be 2-5 uppercase letters` });
        return;
      }
    }

    // Check for duplicate prefixes
    const prefixes = categories.map((c) => c.prefix);
    if (new Set(prefixes).size !== prefixes.length) {
      res.status(400).json({ error: 'Duplicate category prefixes are not allowed' });
      return;
    }

    // Build the YAML
    const config: CategoriesConfig = { categories };
    const yamlContent =
      '# .git4docs/categories.yaml\n' +
      '# Document types, prefixes, numbering, and role assignment.\n\n' +
      yaml.dump(config, { lineWidth: 120, noRefs: true });

    // Write and commit
    const docPath = '.git4docs/categories.yaml';
    await gitEngine.addDocument(repoDir, docPath, yamlContent);
    await gitEngine.saveVersion({
      repoDir,
      paths: [docPath],
      message: 'Updated document categories',
      author: { name: req.user!.name, email: req.user!.email },
    });

    // Read back to confirm
    const configLoader = new ConfigLoader(repoDir);
    const saved = configLoader.loadCategories();
    res.json({ categories: saved.categories });
  } catch (err) {
    console.error('Failed to update categories:', err);
    res.status(500).json({ error: 'Failed to update categories' });
  }
});

export default router;
