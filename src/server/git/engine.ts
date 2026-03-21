/**
 * git4docs Git Engine
 * Core abstraction layer over isomorphic-git.
 * All function names use git4docs terminology.
 * Git terms never leak beyond this module.
 */

import git from 'isomorphic-git';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Version,
  Redline,
  RedlineChange,
  RedlineHunk,
  RedlineLine,
  Release,
  DocumentMeta,
} from '../../shared/types.js';

export interface CreateLibraryOptions {
  companyId: string;
  storagePath: string;
  templatePath: string;
  companyName: string;
  author: { name: string; email: string };
}

export interface SaveVersionOptions {
  repoDir: string;
  paths: string[];
  message: string;
  author: { name: string; email: string };
}

export class GitEngine {
  /**
   * Create a new Document Library (git init + copy template)
   */
  async createLibrary(options: CreateLibraryOptions): Promise<string> {
    const repoDir = path.join(options.storagePath, options.companyId);

    // Create the directory
    await fs.promises.mkdir(repoDir, { recursive: true });

    // Initialize git repo
    await git.init({ fs, dir: repoDir, defaultBranch: 'main' });

    // Copy template files
    await this.copyDirectory(options.templatePath, repoDir);

    // Replace placeholders in governance documents
    await this.replaceGovernancePlaceholders(repoDir, options.author);

    // Stage all files
    await this.stageAll(repoDir);

    // Initial commit
    await git.commit({
      fs,
      dir: repoDir,
      message: 'Initialize Document Library',
      author: {
        name: options.author.name,
        email: options.author.email,
      },
    });

    return repoDir;
  }

  /**
   * Add a new document to the library
   */
  async addDocument(
    repoDir: string,
    docPath: string,
    content: string,
  ): Promise<void> {
    const fullPath = path.join(repoDir, docPath);
    const dir = path.dirname(fullPath);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, content, 'utf-8');
    await git.add({ fs, dir: repoDir, filepath: docPath });
  }

  /**
   * Get document content, optionally at a specific version
   */
  async getDocument(
    repoDir: string,
    docPath: string,
    versionId?: string,
  ): Promise<string> {
    if (versionId) {
      // Read from a specific commit
      const { blob } = await git.readBlob({
        fs,
        dir: repoDir,
        oid: versionId,
        filepath: docPath,
      });
      return new TextDecoder().decode(blob);
    }

    // Read from working directory
    const fullPath = path.join(repoDir, docPath);
    return fs.promises.readFile(fullPath, 'utf-8');
  }

  /**
   * List all documents in the library
   */
  async listDocuments(repoDir: string): Promise<DocumentMeta[]> {
    // Ensure HEAD is valid (recover from deleted branch)
    await this.ensureOnMain(repoDir);

    const documents: DocumentMeta[] = [];

    // Walk the git tree to find all tracked files
    const files = await git.listFiles({ fs, dir: repoDir, ref: 'HEAD' });

    for (const filepath of files) {
      // Skip config files and generated PDFs
      if (filepath.startsWith('.git4docs/')) continue;
      if (filepath.startsWith('.')) continue;
      if (filepath.endsWith('.pdf')) continue;

      // Extract category from path
      const parts = filepath.split('/');
      if (parts.length < 2) continue;

      const category = parts[0];
      const filename = parts[parts.length - 1];
      const docId = filename.replace(/\.md$/, '');

      // Get last commit for this file
      const logs = await git.log({ fs, dir: repoDir, ref: 'HEAD', filepath });
      const lastCommit = logs[0];

      documents.push({
        path: filepath,
        name: this.formatDocumentName(docId),
        category,
        document_id: docId,
        last_modified: lastCommit
          ? new Date(
              lastCommit.commit.author.timestamp * 1000,
            ).toISOString()
          : new Date().toISOString(),
        last_modified_by: lastCommit
          ? lastCommit.commit.author.name
          : 'System',
        status: 'Official',
        version_count: logs.length,
      });
    }

    return documents;
  }

  /**
   * Save Version (git add + commit)
   */
  async saveVersion(options: SaveVersionOptions): Promise<Version> {
    // Stage specified files
    for (const filepath of options.paths) {
      await git.add({ fs, dir: options.repoDir, filepath });
    }

    // Commit
    const oid = await git.commit({
      fs,
      dir: options.repoDir,
      message: options.message,
      author: {
        name: options.author.name,
        email: options.author.email,
      },
    });

    return {
      id: oid,
      message: options.message,
      author: options.author,
      date: new Date().toISOString(),
      files_changed: options.paths,
    };
  }

  /**
   * Get Revision History (git log)
   */
  async getVersionHistory(
    repoDir: string,
    docPath?: string,
  ): Promise<Version[]> {
    await this.ensureOnMain(repoDir);
    const logs = await git.log({
      fs,
      dir: repoDir,
      ref: 'HEAD',
      ...(docPath ? { filepath: docPath } : {}),
    });

    return logs.map((entry) => ({
      id: entry.oid,
      message: entry.commit.message.trim(),
      author: {
        name: entry.commit.author.name,
        email: entry.commit.author.email,
      },
      date: new Date(entry.commit.author.timestamp * 1000).toISOString(),
    }));
  }

  /**
   * Redline — compare two versions (git diff)
   */
  async getRedline(
    repoDir: string,
    fromVersion: string,
    toVersion: string,
    filepath?: string,
  ): Promise<Redline> {
    const changes: RedlineChange[] = [];

    // Get the trees for both commits
    const fromFiles = await this.getFilesAtCommit(repoDir, fromVersion);
    const toFiles = await this.getFilesAtCommit(repoDir, toVersion);

    // Determine which files to compare
    const allPaths = new Set([...fromFiles.keys(), ...toFiles.keys()]);

    for (const filePath of allPaths) {
      // Skip config files and generated PDFs in redline
      if (filePath.startsWith('.git4docs/') || filePath.startsWith('.'))
        continue;
      if (filePath.endsWith('.pdf')) continue;

      // If a specific filepath is requested, only compare that
      if (filepath && filePath !== filepath) continue;

      const fromContent = fromFiles.get(filePath);
      const toContent = toFiles.get(filePath);

      if (!fromContent && toContent) {
        changes.push({
          path: filePath,
          type: 'added',
          hunks: this.createAdditionHunks(toContent),
        });
      } else if (fromContent && !toContent) {
        changes.push({
          path: filePath,
          type: 'deleted',
          hunks: this.createDeletionHunks(fromContent),
        });
      } else if (fromContent && toContent && fromContent !== toContent) {
        changes.push({
          path: filePath,
          type: 'modified',
          hunks: this.computeDiffHunks(fromContent, toContent),
        });
      }
    }

    return {
      from_version: fromVersion,
      to_version: toVersion,
      changes,
    };
  }

  /**
   * Restore Previous Version (create a new commit that reverts to an older state)
   */
  async restorePreviousVersion(
    repoDir: string,
    versionId: string,
    docPath: string,
    author: { name: string; email: string },
  ): Promise<Version> {
    // Read the file content at the target version
    const content = await this.getDocument(repoDir, docPath, versionId);

    // Write it to the working directory
    const fullPath = path.join(repoDir, docPath);
    await fs.promises.writeFile(fullPath, content, 'utf-8');

    // Stage and commit
    await git.add({ fs, dir: repoDir, filepath: docPath });

    const oid = await git.commit({
      fs,
      dir: repoDir,
      message: `Restored previous version of ${docPath}`,
      author: { name: author.name, email: author.email },
    });

    return {
      id: oid,
      message: `Restored previous version of ${docPath}`,
      author,
      date: new Date().toISOString(),
      files_changed: [docPath],
    };
  }

  /**
   * Mark as Released (git tag)
   */
  async markAsReleased(
    repoDir: string,
    versionId: string,
    effectiveDate: string,
    description: string,
    author: { name: string; email: string },
  ): Promise<Release> {
    const tagName = `release-${effectiveDate}-${uuidv4().slice(0, 8)}`;

    await git.annotatedTag({
      fs,
      dir: repoDir,
      ref: tagName,
      object: versionId,
      message: JSON.stringify({ effectiveDate, description }),
      tagger: {
        name: author.name,
        email: author.email,
      },
    });

    return {
      tag: tagName,
      version_id: versionId,
      effective_date: effectiveDate,
      released_by: author,
      description,
      date: new Date().toISOString(),
    };
  }

  /**
   * Get all releases (git tags)
   */
  async getReleases(repoDir: string): Promise<Release[]> {
    const tags = await git.listTags({ fs, dir: repoDir });
    const releases: Release[] = [];

    for (const tagName of tags) {
      if (!tagName.startsWith('release-')) continue;

      try {
        const tagObj = await git.readTag({ fs, dir: repoDir, oid: await git.resolveRef({ fs, dir: repoDir, ref: tagName }) });
        const tag = tagObj.tag;
        const meta = JSON.parse(tag.message);

        releases.push({
          tag: tagName,
          version_id: tag.object,
          effective_date: meta.effectiveDate,
          released_by: {
            name: tag.tagger.name,
            email: tag.tagger.email,
          },
          description: meta.description,
          date: new Date(tag.tagger.timestamp * 1000).toISOString(),
        });
      } catch {
        // Skip malformed tags
      }
    }

    return releases.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  /**
   * Get the HEAD commit SHA for a branch
   */
  async getBranchHeadSha(repoDir: string, branch: string): Promise<string> {
    return git.resolveRef({ fs, dir: repoDir, ref: branch });
  }

  // ============================================================
  // Working Draft operations (branches)
  // ============================================================

  /**
   * Create a Working Draft (git branch)
   */
  async createDraft(
    repoDir: string,
    draftName: string,
  ): Promise<void> {
    await git.branch({ fs, dir: repoDir, ref: draftName });
    await git.checkout({ fs, dir: repoDir, ref: draftName });
  }

  /**
   * List Working Drafts (git branches)
   */
  async listDrafts(repoDir: string): Promise<string[]> {
    const branches = await git.listBranches({ fs, dir: repoDir });
    return branches.filter((b) => b !== 'main');
  }

  /**
   * Switch to a Working Draft or Official Version
   */
  async switchToDraft(repoDir: string, draftName: string): Promise<void> {
    await git.checkout({ fs, dir: repoDir, ref: draftName });
  }

  /**
   * Get current branch name. Always falls back to 'main'.
   */
  async getCurrentBranch(repoDir: string): Promise<string> {
    const branch = await git.currentBranch({ fs, dir: repoDir, fullname: false }) || 'main';
    // Verify the branch still exists; if it was deleted, return 'main'
    const branches = await git.listBranches({ fs, dir: repoDir });
    return branches.includes(branch) ? branch : 'main';
  }

  /**
   * Ensure the repo is checked out on main. Call this to recover from broken state.
   */
  async ensureOnMain(repoDir: string): Promise<void> {
    try {
      const current = await git.currentBranch({ fs, dir: repoDir, fullname: false });
      if (current !== 'main') {
        await git.checkout({ fs, dir: repoDir, ref: 'main' });
      }
    } catch {
      await git.checkout({ fs, dir: repoDir, ref: 'main' });
    }
  }

  /**
   * Delete a Working Draft (git branch -d)
   */
  async discardDraft(repoDir: string, draftName: string): Promise<void> {
    // Switch to main first
    await git.checkout({ fs, dir: repoDir, ref: 'main' });
    await git.deleteBranch({ fs, dir: repoDir, ref: draftName });
  }

  /**
   * Read a document from a specific branch (without checkout)
   */
  async getDocumentOnBranch(
    repoDir: string,
    docPath: string,
    branch: string,
  ): Promise<string> {
    const oid = await git.resolveRef({ fs, dir: repoDir, ref: branch });
    const { blob } = await git.readBlob({
      fs,
      dir: repoDir,
      oid,
      filepath: docPath,
    });
    return new TextDecoder().decode(blob);
  }

  /**
   * Save a version on a specific branch with content.
   * Checkout branch, write content, stage, commit, checkout back — all in one operation.
   */
  async saveVersionOnBranch(
    options: SaveVersionOptions & { branch: string; content?: string; docPath?: string },
  ): Promise<Version> {
    try {
      await git.checkout({ fs, dir: options.repoDir, ref: options.branch });

      // If content is provided, write it before committing
      if (options.content !== undefined && options.docPath) {
        const fullPath = path.join(options.repoDir, options.docPath);
        const dir = path.dirname(fullPath);
        await fs.promises.mkdir(dir, { recursive: true });
        await fs.promises.writeFile(fullPath, options.content, 'utf-8');
      }

      const version = await this.saveVersion(options);
      return version;
    } finally {
      // Always return to main to keep the repo in a clean state
      await git.checkout({ fs, dir: options.repoDir, ref: 'main' });
    }
  }

  /**
   * Merge a Working Draft into main (simple merge strategy)
   * Copies all changed files from draft branch into main and commits.
   */
  async mergeDraft(
    repoDir: string,
    draftName: string,
    author: { name: string; email: string },
    message: string,
  ): Promise<Version> {
    // Find fork point and compare draft against it to get only draft changes
    const mainOid = await git.resolveRef({ fs, dir: repoDir, ref: 'main' });
    const draftOid = await git.resolveRef({ fs, dir: repoDir, ref: draftName });
    const baseOid = await this.findMergeBase(repoDir, 'main', draftName);

    const baseFiles = await this.getFilesAtCommit(repoDir, baseOid);
    const draftFiles = await this.getFilesAtCommit(repoDir, draftOid);

    // Switch to main
    await git.checkout({ fs, dir: repoDir, ref: 'main' });

    // Apply only files that changed on the draft (relative to fork point)
    const changedPaths: string[] = [];

    for (const [filepath, draftContent] of draftFiles) {
      const baseContent = baseFiles.get(filepath);
      if (baseContent !== draftContent) {
        const fullPath = path.join(repoDir, filepath);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, draftContent, 'utf-8');
        await git.add({ fs, dir: repoDir, filepath });
        changedPaths.push(filepath);
      }
    }

    // Handle files deleted on the draft (in base but not in draft)
    for (const [filepath] of baseFiles) {
      if (!draftFiles.has(filepath)) {
        const fullPath = path.join(repoDir, filepath);
        try {
          await fs.promises.unlink(fullPath);
          await git.remove({ fs, dir: repoDir, filepath });
          changedPaths.push(filepath);
        } catch {
          // File already gone
        }
      }
    }

    if (changedPaths.length === 0) {
      // Nothing to merge
      return {
        id: mainOid,
        message: 'No changes to merge',
        author,
        date: new Date().toISOString(),
      };
    }

    // Commit merge
    const oid = await git.commit({
      fs,
      dir: repoDir,
      message,
      author: { name: author.name, email: author.email },
    });

    // Delete the draft branch
    await git.deleteBranch({ fs, dir: repoDir, ref: draftName });

    return {
      id: oid,
      message,
      author,
      date: new Date().toISOString(),
      files_changed: changedPaths,
    };
  }

  /**
   * Get changes between a draft branch and main
   */
  async getDraftChanges(
    repoDir: string,
    draftName: string,
  ): Promise<Redline> {
    const draftOid = await git.resolveRef({ fs, dir: repoDir, ref: draftName });
    const baseOid = await this.findMergeBase(repoDir, 'main', draftName);
    return this.getRedline(repoDir, baseOid, draftOid);
  }

  /**
   * Find the merge base (common ancestor) between two refs by walking both histories.
   */
  private async findMergeBase(repoDir: string, refA: string, refB: string): Promise<string> {
    const commitsA = await git.log({ fs, dir: repoDir, ref: refA });
    const ancestorsA = new Set(commitsA.map((c) => c.oid));

    const commitsB = await git.log({ fs, dir: repoDir, ref: refB });
    for (const commit of commitsB) {
      if (ancestorsA.has(commit.oid)) {
        return commit.oid;
      }
    }

    // Fallback: if no common ancestor found, use refA HEAD
    return git.resolveRef({ fs, dir: repoDir, ref: refA });
  }

  /**
   * Get version history on a specific branch
   */
  async getVersionHistoryOnBranch(
    repoDir: string,
    branch: string,
    docPath?: string,
  ): Promise<Version[]> {
    const logs = await git.log({
      fs,
      dir: repoDir,
      ref: branch,
      ...(docPath ? { filepath: docPath } : {}),
    });

    return logs.map((entry) => ({
      id: entry.oid,
      message: entry.commit.message.trim(),
      author: {
        name: entry.commit.author.name,
        email: entry.commit.author.email,
      },
      date: new Date(entry.commit.author.timestamp * 1000).toISOString(),
    }));
  }

  /**
   * Get the next document number for a category
   */
  async getNextDocumentNumber(
    repoDir: string,
    categoryPrefix: string,
  ): Promise<string> {
    // Ensure HEAD is valid (recover from deleted branch)
    await this.ensureOnMain(repoDir);
    const files = await git.listFiles({ fs, dir: repoDir, ref: 'HEAD' });
    const categoryFiles = files.filter((f) =>
      f.startsWith(`${categoryPrefix}/`),
    );

    let maxNum = 0;
    const pattern = new RegExp(`^${categoryPrefix}/${categoryPrefix}-(\\d+)`);
    for (const file of categoryFiles) {
      const match = file.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = (maxNum + 1).toString().padStart(3, '0');
    return `${categoryPrefix}-${nextNum}`;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private async replaceGovernancePlaceholders(
    repoDir: string,
    author: { name: string; email: string },
  ): Promise<void> {
    const govDir = path.join(repoDir, 'GOV');
    try {
      const files = await fs.promises.readdir(govDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(govDir, file);
        let content = await fs.promises.readFile(filePath, 'utf-8');
        content = content
          .replace(/\{\{OWNER_EMAIL\}\}/g, author.email)
          .replace(/\{\{OWNER_NAME\}\}/g, author.name);
        await fs.promises.writeFile(filePath, content, 'utf-8');
      }
    } catch {
      // GOV directory may not exist in all templates
    }
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await fs.promises.mkdir(destPath, { recursive: true });
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  private async stageAll(repoDir: string): Promise<void> {
    const statusMatrix = await git.statusMatrix({ fs, dir: repoDir });
    for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
      if (workdirStatus !== stageStatus) {
        await git.add({ fs, dir: repoDir, filepath });
      }
    }
  }

  private async getFilesAtCommit(
    repoDir: string,
    commitOid: string,
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    // Walk the tree at this commit
    const commit = await git.readCommit({ fs, dir: repoDir, oid: commitOid });
    const treeOid = commit.commit.tree;

    await this.walkTree(repoDir, treeOid, '', files);

    return files;
  }

  private async walkTree(
    repoDir: string,
    treeOid: string,
    prefix: string,
    files: Map<string, string>,
  ): Promise<void> {
    const { tree } = await git.readTree({ fs, dir: repoDir, oid: treeOid });

    for (const entry of tree) {
      const filepath = prefix ? `${prefix}/${entry.path}` : entry.path;

      if (entry.type === 'tree') {
        await this.walkTree(repoDir, entry.oid, filepath, files);
      } else if (entry.type === 'blob') {
        try {
          const { blob } = await git.readBlob({
            fs,
            dir: repoDir,
            oid: entry.oid,
          });
          files.set(filepath, new TextDecoder().decode(blob));
        } catch {
          // Skip binary files
        }
      }
    }
  }

  private formatDocumentName(docId: string): string {
    return docId
      .replace(/\.md$/, '')
      .split('-')
      .slice(2)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  private createAdditionHunks(content: string): RedlineHunk[] {
    const lines = content.split('\n');
    return [
      {
        old_start: 0,
        old_lines: 0,
        new_start: 1,
        new_lines: lines.length,
        lines: lines.map((l) => ({ type: 'addition' as const, content: l })),
      },
    ];
  }

  private createDeletionHunks(content: string): RedlineHunk[] {
    const lines = content.split('\n');
    return [
      {
        old_start: 1,
        old_lines: lines.length,
        new_start: 0,
        new_lines: 0,
        lines: lines.map((l) => ({ type: 'deletion' as const, content: l })),
      },
    ];
  }

  /**
   * Simple line-based diff algorithm.
   * Produces hunks showing additions, deletions, and context lines.
   */
  private computeDiffHunks(
    oldContent: string,
    newContent: string,
  ): RedlineHunk[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple LCS-based diff
    const lcs = this.computeLCS(oldLines, newLines);
    const diffLines: RedlineLine[] = [];

    let oldIdx = 0;
    let newIdx = 0;

    for (const [oldLcsIdx, newLcsIdx] of lcs) {
      // Lines deleted (in old but not in new before this match)
      while (oldIdx < oldLcsIdx) {
        diffLines.push({ type: 'deletion', content: oldLines[oldIdx] });
        oldIdx++;
      }
      // Lines added (in new but not in old before this match)
      while (newIdx < newLcsIdx) {
        diffLines.push({ type: 'addition', content: newLines[newIdx] });
        newIdx++;
      }
      // Context line (matches in both)
      diffLines.push({ type: 'context', content: oldLines[oldIdx] });
      oldIdx++;
      newIdx++;
    }

    // Remaining lines
    while (oldIdx < oldLines.length) {
      diffLines.push({ type: 'deletion', content: oldLines[oldIdx] });
      oldIdx++;
    }
    while (newIdx < newLines.length) {
      diffLines.push({ type: 'addition', content: newLines[newIdx] });
      newIdx++;
    }

    if (diffLines.length === 0) return [];

    return [
      {
        old_start: 1,
        old_lines: oldLines.length,
        new_start: 1,
        new_lines: newLines.length,
        lines: diffLines,
      },
    ];
  }

  /**
   * Compute Longest Common Subsequence indices.
   * Returns array of [oldIndex, newIndex] pairs.
   */
  private computeLCS(
    oldLines: string[],
    newLines: string[],
  ): Array<[number, number]> {
    const m = oldLines.length;
    const n = newLines.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      new Array(n + 1).fill(0),
    );

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find the actual LCS
    const result: Array<[number, number]> = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        result.unshift([i - 1, j - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return result;
  }
}

// Singleton instance
export const gitEngine = new GitEngine();
