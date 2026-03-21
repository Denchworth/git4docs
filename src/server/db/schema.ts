/**
 * git4docs Database Schema
 * SQLite — RUNTIME STATE ONLY.
 * Documents, config, and audit trails live in Git.
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

let db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (db) return db;

  const resolvedPath = dbPath || process.env.DATABASE_PATH || './data/git4docs.db';
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');

  initializeSchema(db);
  migrateSchema(db);
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function migrateSchema(database: Database.Database): void {
  // Add revision columns if missing (for databases created before this feature)
  const companyCols = database.prepare(`PRAGMA table_info(companies)`).all() as Array<{ name: string }>;
  const companyColNames = companyCols.map((c) => c.name);
  if (!companyColNames.includes('revision_format')) {
    database.exec(`ALTER TABLE companies ADD COLUMN revision_format TEXT DEFAULT 'number'`);
  }
  if (!companyColNames.includes('slug')) {
    database.exec(`ALTER TABLE companies ADD COLUMN slug TEXT`);
  }
  if (!companyColNames.includes('revision_start')) {
    database.exec(`ALTER TABLE companies ADD COLUMN revision_start INTEGER DEFAULT 1`);
  }

  // Add email_verified to platform_users
  const puCols = database.prepare(`PRAGMA table_info(platform_users)`).all() as Array<{ name: string }>;
  const puColNames = puCols.map((c) => c.name);
  if (!puColNames.includes('email_verified')) {
    database.exec(`ALTER TABLE platform_users ADD COLUMN email_verified INTEGER DEFAULT 0`);
    // Mark existing users as verified
    database.exec(`UPDATE platform_users SET email_verified = 1 WHERE email_verified IS NULL OR email_verified = 0`);
  }
  if (!puColNames.includes('invite_token')) {
    database.exec(`ALTER TABLE platform_users ADD COLUMN invite_token TEXT`);
  }
  if (!puColNames.includes('verification_token')) {
    database.exec(`ALTER TABLE platform_users ADD COLUMN verification_token TEXT`);
  }
  if (!puColNames.includes('reset_token')) {
    database.exec(`ALTER TABLE platform_users ADD COLUMN reset_token TEXT`);
  }

  // Add document_path to change_requests (for one-active-CR-per-document enforcement)
  const crCols = database.prepare(`PRAGMA table_info(change_requests)`).all() as Array<{ name: string }>;
  const crColNames = crCols.map((c) => c.name);
  if (!crColNames.includes('document_path')) {
    database.exec(`ALTER TABLE change_requests ADD COLUMN document_path TEXT`);
  }
  if (!crColNames.includes('review_head_sha')) {
    database.exec(`ALTER TABLE change_requests ADD COLUMN review_head_sha TEXT`);
  }

  // Add commit_sha and dismissed tracking to approval_actions
  const aaCols = database.prepare(`PRAGMA table_info(approval_actions)`).all() as Array<{ name: string }>;
  const aaColNames = aaCols.map((c) => c.name);
  if (!aaColNames.includes('commit_sha')) {
    database.exec(`ALTER TABLE approval_actions ADD COLUMN commit_sha TEXT`);
  }
  if (!aaColNames.includes('dismissed')) {
    database.exec(`ALTER TABLE approval_actions ADD COLUMN dismissed INTEGER DEFAULT 0`);
  }
  if (!aaColNames.includes('dismissed_reason')) {
    database.exec(`ALTER TABLE approval_actions ADD COLUMN dismissed_reason TEXT`);
  }

  // Review comments table
  database.exec(`
    CREATE TABLE IF NOT EXISTS review_comments (
      id TEXT PRIMARY KEY,
      change_request_id TEXT REFERENCES change_requests(id),
      author_email TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      parent_id TEXT,
      resolved INTEGER DEFAULT 0,
      resolved_by_email TEXT,
      resolved_by_name TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate old statuses to new ones
  database.exec(`UPDATE change_requests SET status = 'in_review' WHERE status IN ('submitted', 'under_review')`);

  // Requirement sources and matrix
  database.exec(`
    CREATE TABLE IF NOT EXISTS requirement_sources (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      uploaded_by_email TEXT NOT NULL,
      uploaded_by_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS requirement_matrix (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      requirement_text TEXT NOT NULL,
      requirement_ref TEXT,
      document_paths TEXT,
      status TEXT NOT NULL DEFAULT 'gap',
      ai_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS requirement_matrix_meta (
      company_id TEXT PRIMARY KEY,
      last_calculated_at DATETIME,
      calculation_status TEXT DEFAULT 'idle',
      error_message TEXT
    );
  `);

}

function initializeSchema(database: Database.Database): void {
  database.exec(`
    -- ============================================================
    -- COMPANIES
    -- ============================================================
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      repo_path TEXT NOT NULL,
      identity_provider TEXT DEFAULT 'manual',
      revision_format TEXT DEFAULT 'number',
      revision_start INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- PLATFORM USERS (owner, admin)
    -- ============================================================
    CREATE TABLE IF NOT EXISTS platform_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      company_id TEXT REFERENCES companies(id),
      role TEXT NOT NULL DEFAULT 'admin',
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      platform_user_id TEXT REFERENCES platform_users(id),
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- CHANGE REQUESTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS change_requests (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      branch_name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_step INTEGER DEFAULT 0,
      submitted_by_email TEXT NOT NULL,
      submitted_by_name TEXT NOT NULL,
      submitted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS approval_actions (
      id TEXT PRIMARY KEY,
      change_request_id TEXT REFERENCES change_requests(id),
      acted_by_email TEXT NOT NULL,
      acted_by_name TEXT NOT NULL,
      action TEXT NOT NULL,
      step_number INTEGER NOT NULL,
      comments TEXT,
      acted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- AUDIT LOG
    -- ============================================================
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT REFERENCES companies(id),
      actor_email TEXT NOT NULL,
      actor_name TEXT,
      action TEXT NOT NULL,
      resource TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- USAGE TRACKING
    -- ============================================================
    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT REFERENCES companies(id),
      actor_email TEXT,
      event_type TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================================
    -- MANUAL IDENTITY PROVIDER USERS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS manual_identity_users (
      id TEXT PRIMARY KEY,
      company_id TEXT REFERENCES companies(id),
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT DEFAULT '',
      title TEXT DEFAULT '',
      location TEXT DEFAULT '',
      cost_center TEXT DEFAULT '',
      reports_to TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      out_of_office INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, email)
    );

    -- ============================================================
    -- ACKNOWLEDGMENTS
    -- ============================================================
    CREATE TABLE IF NOT EXISTS acknowledgments (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      change_request_id TEXT REFERENCES change_requests(id),
      document_path TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      acknowledged_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(change_request_id, user_email)
    );

  `);
}
