/**
 * git4docs Attribute Matcher
 * Resolves match rules against identity provider user attributes.
 */

import type { MatchRule, IdentityUser, TitleMatch } from '../../shared/types.js';

/**
 * Check if a single user matches a match rule.
 */
export function userMatchesRule(
  user: IdentityUser,
  rule: MatchRule,
  submitter?: IdentityUser,
): boolean {
  // Match all users
  if (rule.all === true) return true;

  // OR logic — at least one sub-rule must match
  if (rule.any_of && Array.isArray(rule.any_of)) {
    return rule.any_of.some((subRule) => userMatchesRule(user, subRule, submitter));
  }

  // Relationship matching
  if (rule.relationship) {
    return matchRelationship(user, rule.relationship, submitter);
  }

  // AND logic — all specified fields must match
  let allMatch = true;

  if (rule.department !== undefined) {
    if (user.department !== rule.department) allMatch = false;
  }

  if (rule.title !== undefined) {
    if (!matchTitle(user.title, rule.title)) allMatch = false;
  }

  if (rule.location !== undefined) {
    if (user.location !== rule.location) allMatch = false;
  }

  if (rule.cost_center !== undefined) {
    if (user.cost_center !== rule.cost_center) allMatch = false;
  }

  // If no fields were specified (empty object), don't match anyone
  const hasFields = rule.department !== undefined ||
    rule.title !== undefined ||
    rule.location !== undefined ||
    rule.cost_center !== undefined;

  return hasFields ? allMatch : false;
}

/**
 * Filter a list of users by a match rule.
 */
export function filterUsersByRule(
  users: IdentityUser[],
  rule: MatchRule,
  submitter?: IdentityUser,
): IdentityUser[] {
  return users.filter((user) => user.is_active && userMatchesRule(user, rule, submitter));
}

function matchTitle(userTitle: string, rule: string | TitleMatch): boolean {
  if (typeof rule === 'string') {
    // Exact match
    return userTitle === rule;
  }

  // TitleMatch object
  if (rule.includes) {
    return userTitle.toLowerCase().includes(rule.includes.toLowerCase());
  }

  if (rule.any_of && Array.isArray(rule.any_of)) {
    return rule.any_of.some((sub) =>
      userTitle.toLowerCase().includes(sub.includes.toLowerCase()),
    );
  }

  return false;
}

function matchRelationship(
  user: IdentityUser,
  relationship: string,
  submitter?: IdentityUser,
): boolean {
  if (relationship === 'submitter.reports_to' && submitter) {
    return user.email === submitter.reports_to;
  }
  return false;
}
