/**
 * Git Engine Tests
 * Tests core document operations using git4docs terminology.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { GitEngine } from '../src/server/git/engine.js';

describe('GitEngine', () => {
  let engine: GitEngine;
  let tmpDir: string;
  let repoDir: string;
  const templateDir = path.resolve('templates/general');

  beforeEach(async () => {
    engine = new GitEngine();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git4docs-test-'));

    repoDir = await engine.createLibrary({
      companyId: 'test-company',
      storagePath: tmpDir,
      templatePath: templateDir,
      companyName: 'Test Corp',
      author: { name: 'Test Admin', email: 'admin@test.com' },
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('createLibrary', () => {
    it('should create a Document Library with template files', () => {
      expect(fs.existsSync(repoDir)).toBe(true);
      expect(fs.existsSync(path.join(repoDir, '.git'))).toBe(true);
      expect(fs.existsSync(path.join(repoDir, '.git4docs', 'config.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(repoDir, '.git4docs', 'categories.yaml'))).toBe(true);
      expect(fs.existsSync(path.join(repoDir, 'SOP', 'SOP-001-document-control.md'))).toBe(true);
    });
  });

  describe('addDocument + getDocument', () => {
    it('should add and retrieve a document', async () => {
      const content = '# POL-001: Test Policy\n\nThis is a test policy.';
      await engine.addDocument(repoDir, 'POL/POL-001-test-policy.md', content);

      const retrieved = await engine.getDocument(repoDir, 'POL/POL-001-test-policy.md');
      expect(retrieved).toBe(content);
    });
  });

  describe('listDocuments', () => {
    it('should list documents excluding config files', async () => {
      const docs = await engine.listDocuments(repoDir);

      expect(docs.length).toBeGreaterThan(0);
      expect(docs.some(d => d.path.startsWith('.git4docs/'))).toBe(false);
      expect(docs.some(d => d.category === 'SOP')).toBe(true);
    });
  });

  describe('saveVersion + getVersionHistory', () => {
    it('should save a version and show it in history', async () => {
      // Add a new document
      await engine.addDocument(repoDir, 'POL/POL-001-test.md', '# Test v1');

      const version = await engine.saveVersion({
        repoDir,
        paths: ['POL/POL-001-test.md'],
        message: 'Added test policy',
        author: { name: 'Jane Doe', email: 'jane@test.com' },
      });

      expect(version.id).toBeTruthy();
      expect(version.message).toBe('Added test policy');
      expect(version.author.name).toBe('Jane Doe');

      // Check history
      const history = await engine.getVersionHistory(repoDir, 'POL/POL-001-test.md');
      expect(history.length).toBe(1);
      expect(history[0].message).toBe('Added test policy');
    });

    it('should track multiple versions', async () => {
      await engine.addDocument(repoDir, 'POL/POL-001-test.md', '# Test v1');
      await engine.saveVersion({
        repoDir,
        paths: ['POL/POL-001-test.md'],
        message: 'Version 1',
        author: { name: 'Jane', email: 'jane@test.com' },
      });

      await engine.addDocument(repoDir, 'POL/POL-001-test.md', '# Test v2\nUpdated content');
      await engine.saveVersion({
        repoDir,
        paths: ['POL/POL-001-test.md'],
        message: 'Version 2',
        author: { name: 'Jane', email: 'jane@test.com' },
      });

      const history = await engine.getVersionHistory(repoDir, 'POL/POL-001-test.md');
      expect(history.length).toBe(2);
      expect(history[0].message).toBe('Version 2');
      expect(history[1].message).toBe('Version 1');
    });
  });

  describe('getRedline', () => {
    it('should show changes between two versions', async () => {
      // Create version 1
      await engine.addDocument(repoDir, 'POL/POL-001-test.md', '# Test Policy\n\nOriginal content.');
      const v1 = await engine.saveVersion({
        repoDir,
        paths: ['POL/POL-001-test.md'],
        message: 'Version 1',
        author: { name: 'Jane', email: 'jane@test.com' },
      });

      // Create version 2
      await engine.addDocument(repoDir, 'POL/POL-001-test.md', '# Test Policy\n\nUpdated content.\n\nNew section.');
      const v2 = await engine.saveVersion({
        repoDir,
        paths: ['POL/POL-001-test.md'],
        message: 'Version 2',
        author: { name: 'Jane', email: 'jane@test.com' },
      });

      const redline = await engine.getRedline(repoDir, v1.id, v2.id, 'POL/POL-001-test.md');

      expect(redline.from_version).toBe(v1.id);
      expect(redline.to_version).toBe(v2.id);
      expect(redline.changes.length).toBe(1);
      expect(redline.changes[0].type).toBe('modified');
    });
  });

  describe('restorePreviousVersion', () => {
    it('should restore a document to a previous version', async () => {
      // Version 1
      await engine.addDocument(repoDir, 'POL/POL-001-test.md', 'Original content');
      const v1 = await engine.saveVersion({
        repoDir,
        paths: ['POL/POL-001-test.md'],
        message: 'Original',
        author: { name: 'Jane', email: 'jane@test.com' },
      });

      // Version 2
      await engine.addDocument(repoDir, 'POL/POL-001-test.md', 'Changed content');
      await engine.saveVersion({
        repoDir,
        paths: ['POL/POL-001-test.md'],
        message: 'Changed',
        author: { name: 'Jane', email: 'jane@test.com' },
      });

      // Restore to v1
      await engine.restorePreviousVersion(
        repoDir,
        v1.id,
        'POL/POL-001-test.md',
        { name: 'Jane', email: 'jane@test.com' },
      );

      const restored = await engine.getDocument(repoDir, 'POL/POL-001-test.md');
      expect(restored).toBe('Original content');

      // Should have 3 versions now
      const history = await engine.getVersionHistory(repoDir, 'POL/POL-001-test.md');
      expect(history.length).toBe(3);
    });
  });

  describe('getNextDocumentNumber', () => {
    it('should auto-increment document numbers', async () => {
      const next = await engine.getNextDocumentNumber(repoDir, 'SOP');
      expect(next).toBe('SOP-002'); // SOP-001 already exists from template

      // Add another
      await engine.addDocument(repoDir, 'SOP/SOP-002-test.md', '# Test');
      await engine.saveVersion({
        repoDir,
        paths: ['SOP/SOP-002-test.md'],
        message: 'Added SOP-002',
        author: { name: 'Jane', email: 'jane@test.com' },
      });

      const next2 = await engine.getNextDocumentNumber(repoDir, 'SOP');
      expect(next2).toBe('SOP-003');
    });

    it('should start at 001 for new categories', async () => {
      const next = await engine.getNextDocumentNumber(repoDir, 'POL');
      expect(next).toBe('POL-001');
    });
  });

  describe('Working Drafts', () => {
    it('should create and list drafts', async () => {
      await engine.createDraft(repoDir, 'draft/test-draft');

      const drafts = await engine.listDrafts(repoDir);
      expect(drafts).toContain('draft/test-draft');
    });

    it('should discard a draft', async () => {
      await engine.createDraft(repoDir, 'draft/to-discard');
      await engine.discardDraft(repoDir, 'draft/to-discard');

      const drafts = await engine.listDrafts(repoDir);
      expect(drafts).not.toContain('draft/to-discard');
    });
  });

  describe('Releases', () => {
    it('should mark a version as released and list releases', async () => {
      await engine.addDocument(repoDir, 'POL/POL-001-test.md', '# Policy');
      const v = await engine.saveVersion({
        repoDir,
        paths: ['POL/POL-001-test.md'],
        message: 'Release candidate',
        author: { name: 'Jane', email: 'jane@test.com' },
      });

      const release = await engine.markAsReleased(
        repoDir,
        v.id,
        '2026-04-01',
        'First release of test policy',
        { name: 'CEO', email: 'ceo@test.com' },
      );

      expect(release.effective_date).toBe('2026-04-01');
      expect(release.released_by.name).toBe('CEO');

      const releases = await engine.getReleases(repoDir);
      expect(releases.length).toBe(1);
      expect(releases[0].tag).toBe(release.tag);
    });
  });
});
