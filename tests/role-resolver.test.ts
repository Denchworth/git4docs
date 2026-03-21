/**
 * Role Resolver Tests
 * Tests that users get the correct role per document category.
 */

import { describe, it, expect } from 'vitest';
import { RoleResolver } from '../src/server/config/role-resolver.js';
import { ManualIdentityProvider } from '../src/server/identity/manual.js';
import { getDatabase, closeDatabase } from '../src/server/db/schema.js';
import * as db from '../src/server/db/queries.js';
import type { CategoryConfig, IdentityUser } from '../src/shared/types.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('RoleResolver', () => {
  let dbPath: string;

  const polCategory: CategoryConfig = {
    prefix: 'POL',
    name: 'Policy',
    description: 'Company-wide policies',
    workflow: 'policies',
    numbering: 'sequential',
    review_cycle_months: 24,
    roles: {
      viewer: { match: { all: true } },
      editor: { match: { department: 'Quality' } },
      approver: {
        match: {
          any_of: [
            { title: { includes: 'CEO' } },
            { title: { includes: 'President' } },
          ],
        },
      },
    },
  };

  const finCategory: CategoryConfig = {
    prefix: 'FIN',
    name: 'Finance Procedure',
    description: 'Financial processes',
    workflow: 'finance-procedures',
    numbering: 'sequential',
    review_cycle_months: 12,
    roles: {
      viewer: { match: { department: 'Finance' } },
      editor: {
        match: {
          department: 'Finance',
          title: {
            any_of: [
              { includes: 'Analyst' },
              { includes: 'Controller' },
            ],
          },
        },
      },
      approver: {
        match: {
          department: 'Finance',
          title: { includes: 'VP' },
        },
      },
    },
  };

  // Test users
  const ceo: IdentityUser = {
    email: 'ceo@acme.com', name: 'Alice CEO',
    department: 'Executive', title: 'CEO', is_active: true,
  };
  const qualityMgr: IdentityUser = {
    email: 'qm@acme.com', name: 'Dave Quality',
    department: 'Quality', title: 'Quality Manager', is_active: true,
  };
  const vpFinance: IdentityUser = {
    email: 'vp@acme.com', name: 'Bob VP',
    department: 'Finance', title: 'VP of Finance', is_active: true,
  };
  const analyst: IdentityUser = {
    email: 'carol@acme.com', name: 'Carol Analyst',
    department: 'Finance', title: 'Financial Analyst', is_active: true,
  };
  const engineer: IdentityUser = {
    email: 'eve@acme.com', name: 'Eve Engineer',
    department: 'Engineering', title: 'Senior Engineer', is_active: true,
  };

  it('should resolve correct roles for POL category', () => {
    const provider = { findUsers: async () => [], getUser: async () => null, getManager: async () => null, isAvailable: async () => true, sync: async () => {}, listAllUsers: async () => [] };
    const resolver = new RoleResolver(provider);

    // CEO is approver for policies
    expect(resolver.resolveRole(ceo, polCategory)).toBe('approver');
    // Quality Manager is editor for policies
    expect(resolver.resolveRole(qualityMgr, polCategory)).toBe('editor');
    // VP Finance is viewer for policies (all: true matches viewer, no other match)
    expect(resolver.resolveRole(vpFinance, polCategory)).toBe('viewer');
    // Engineer is viewer for policies
    expect(resolver.resolveRole(engineer, polCategory)).toBe('viewer');
  });

  it('should resolve correct roles for FIN category', () => {
    const provider = { findUsers: async () => [], getUser: async () => null, getManager: async () => null, isAvailable: async () => true, sync: async () => {}, listAllUsers: async () => [] };
    const resolver = new RoleResolver(provider);

    // VP Finance is approver for FIN
    expect(resolver.resolveRole(vpFinance, finCategory)).toBe('approver');
    // Analyst is editor for FIN
    expect(resolver.resolveRole(analyst, finCategory)).toBe('editor');
    // CEO gets none — not in Finance department
    expect(resolver.resolveRole(ceo, finCategory)).toBe('none');
    // Engineer gets none — not in Finance
    expect(resolver.resolveRole(engineer, finCategory)).toBe('none');
  });

  it('should give different roles in different categories for same user', () => {
    const provider = { findUsers: async () => [], getUser: async () => null, getManager: async () => null, isAvailable: async () => true, sync: async () => {}, listAllUsers: async () => [] };
    const resolver = new RoleResolver(provider);

    // Quality Manager: editor for POL, none for FIN
    expect(resolver.resolveRole(qualityMgr, polCategory)).toBe('editor');
    expect(resolver.resolveRole(qualityMgr, finCategory)).toBe('none');

    // VP Finance: viewer for POL, approver for FIN
    expect(resolver.resolveRole(vpFinance, polCategory)).toBe('viewer');
    expect(resolver.resolveRole(vpFinance, finCategory)).toBe('approver');
  });

  it('should check minimum role correctly', () => {
    const provider = { findUsers: async () => [], getUser: async () => null, getManager: async () => null, isAvailable: async () => true, sync: async () => {}, listAllUsers: async () => [] };
    const resolver = new RoleResolver(provider);

    // CEO is approver for POL — should pass all minimum checks
    expect(resolver.hasMinimumRole(ceo, polCategory, 'viewer')).toBe(true);
    expect(resolver.hasMinimumRole(ceo, polCategory, 'editor')).toBe(true);
    expect(resolver.hasMinimumRole(ceo, polCategory, 'approver')).toBe(true);

    // Engineer is viewer for POL — should only pass viewer check
    expect(resolver.hasMinimumRole(engineer, polCategory, 'viewer')).toBe(true);
    expect(resolver.hasMinimumRole(engineer, polCategory, 'editor')).toBe(false);
    expect(resolver.hasMinimumRole(engineer, polCategory, 'approver')).toBe(false);
  });
});
