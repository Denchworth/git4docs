/**
 * Attribute Matcher Tests
 * Tests match rule resolution against user attributes.
 */

import { describe, it, expect } from 'vitest';
import { userMatchesRule, filterUsersByRule } from '../src/server/config/matcher.js';
import type { IdentityUser, MatchRule } from '../src/shared/types.js';

const users: IdentityUser[] = [
  {
    email: 'ceo@acme.com',
    name: 'Alice CEO',
    department: 'Executive',
    title: 'CEO',
    is_active: true,
  },
  {
    email: 'vp.finance@acme.com',
    name: 'Bob VP Finance',
    department: 'Finance',
    title: 'VP of Finance',
    is_active: true,
  },
  {
    email: 'analyst@acme.com',
    name: 'Carol Analyst',
    department: 'Finance',
    title: 'Financial Analyst',
    is_active: true,
    reports_to: 'vp.finance@acme.com',
  },
  {
    email: 'qm@acme.com',
    name: 'Dave Quality',
    department: 'Quality',
    title: 'Quality Manager',
    is_active: true,
  },
  {
    email: 'engineer@acme.com',
    name: 'Eve Engineer',
    department: 'Engineering',
    title: 'Senior Engineer',
    is_active: true,
  },
  {
    email: 'inactive@acme.com',
    name: 'Frank Inactive',
    department: 'Finance',
    title: 'VP of Finance',
    is_active: false,
  },
];

describe('userMatchesRule', () => {
  it('should match all users with { all: true }', () => {
    const rule: MatchRule = { all: true };
    for (const user of users) {
      expect(userMatchesRule(user, rule)).toBe(true);
    }
  });

  it('should match exact department', () => {
    const rule: MatchRule = { department: 'Finance' };
    expect(userMatchesRule(users[1], rule)).toBe(true); // VP Finance
    expect(userMatchesRule(users[2], rule)).toBe(true); // Analyst
    expect(userMatchesRule(users[0], rule)).toBe(false); // CEO
  });

  it('should match title includes', () => {
    const rule: MatchRule = { title: { includes: 'VP' } };
    expect(userMatchesRule(users[1], rule)).toBe(true); // VP of Finance
    expect(userMatchesRule(users[2], rule)).toBe(false); // Analyst
  });

  it('should match title any_of', () => {
    const rule: MatchRule = {
      title: {
        any_of: [
          { includes: 'CEO' },
          { includes: 'President' },
        ],
      },
    };
    expect(userMatchesRule(users[0], rule)).toBe(true); // CEO
    expect(userMatchesRule(users[1], rule)).toBe(false); // VP
  });

  it('should support AND logic (department + title)', () => {
    const rule: MatchRule = {
      department: 'Finance',
      title: { includes: 'VP' },
    };
    expect(userMatchesRule(users[1], rule)).toBe(true); // VP Finance
    expect(userMatchesRule(users[2], rule)).toBe(false); // Finance Analyst
    expect(userMatchesRule(users[0], rule)).toBe(false); // CEO
  });

  it('should support OR logic with any_of', () => {
    const rule: MatchRule = {
      any_of: [
        { title: { includes: 'CEO' } },
        { title: { includes: 'VP' } },
      ],
    };
    expect(userMatchesRule(users[0], rule)).toBe(true); // CEO
    expect(userMatchesRule(users[1], rule)).toBe(true); // VP
    expect(userMatchesRule(users[2], rule)).toBe(false); // Analyst
  });

  it('should match relationship: submitter.reports_to', () => {
    const rule: MatchRule = { relationship: 'submitter.reports_to' };
    const submitter = users[2]; // Carol reports to Bob

    expect(userMatchesRule(users[1], rule, submitter)).toBe(true); // Bob is Carol's manager
    expect(userMatchesRule(users[0], rule, submitter)).toBe(false); // CEO is not
  });
});

describe('filterUsersByRule', () => {
  it('should filter and exclude inactive users', () => {
    const rule: MatchRule = {
      department: 'Finance',
      title: { includes: 'VP' },
    };
    const result = filterUsersByRule(users, rule);

    expect(result.length).toBe(1);
    expect(result[0].email).toBe('vp.finance@acme.com');
    // Frank (inactive VP Finance) should be excluded
  });

  it('should return all active users for { all: true }', () => {
    const result = filterUsersByRule(users, { all: true });
    expect(result.length).toBe(5); // All except inactive Frank
  });
});
