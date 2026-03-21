/**
 * git4docs Role Resolver
 * Given a user + category, returns their git4docs role
 * (viewer/editor/approver) by evaluating category match rules.
 */

import type {
  IdentityUser,
  CategoryConfig,
  DocumentRole,
  WorkflowStep,
} from '../../shared/types.js';
import { userMatchesRule, filterUsersByRule } from './matcher.js';
import type { IdentityProvider } from '../identity/provider.js';

export class RoleResolver {
  constructor(private identityProvider: IdentityProvider) {}

  /**
   * Given a user and a document category, return their highest applicable role.
   * Role hierarchy: approver > editor > viewer > none
   */
  resolveRole(user: IdentityUser, category: CategoryConfig): DocumentRole {
    if (!user.is_active) return 'none';

    // Check from highest to lowest
    if (userMatchesRule(user, category.roles.approver.match)) {
      return 'approver';
    }
    if (userMatchesRule(user, category.roles.editor.match)) {
      return 'editor';
    }
    if (userMatchesRule(user, category.roles.viewer.match)) {
      return 'viewer';
    }

    return 'none';
  }

  /**
   * Check if a user has the 'creator' permission for a category.
   * Falls back to editor role if no creator rule is defined.
   */
  canCreate(user: IdentityUser, category: CategoryConfig): boolean {
    if (!user.is_active) return false;
    if (category.roles.creator) {
      return userMatchesRule(user, category.roles.creator.match);
    }
    // Fallback: editors can create if no explicit creator rule
    return userMatchesRule(user, category.roles.editor.match);
  }

  /**
   * Check if a user has at least the specified role for a category.
   */
  hasMinimumRole(
    user: IdentityUser,
    category: CategoryConfig,
    minimumRole: DocumentRole,
  ): boolean {
    const roleHierarchy: DocumentRole[] = ['none', 'viewer', 'editor', 'approver'];
    const userRole = this.resolveRole(user, category);
    return roleHierarchy.indexOf(userRole) >= roleHierarchy.indexOf(minimumRole);
  }

  /**
   * Given a workflow step, resolve the actual people who should act.
   */
  async resolveWorkflowStep(
    step: WorkflowStep,
    category: CategoryConfig,
    submitter: IdentityUser,
  ): Promise<IdentityUser[]> {
    // If step uses a role reference, look up the match rule from the category
    if (step.role) {
      const roleName = step.role as 'viewer' | 'editor' | 'approver';
      const roleConfig = category.roles[roleName];
      if (!roleConfig) return [];

      const users = await this.identityProvider.findUsers(roleConfig.match);
      return users.filter((u) => u.is_active);
    }

    // If step has a direct match rule, resolve against identity provider
    if (step.match) {
      return this.identityProvider.findUsers(step.match, submitter);
    }

    return [];
  }

  /**
   * Resolve users available for a workflow step, handling fallback logic.
   */
  async resolveStepWithFallback(
    step: WorkflowStep,
    category: CategoryConfig,
    submitter: IdentityUser,
  ): Promise<IdentityUser[]> {
    const primaryUsers = await this.resolveWorkflowStep(step, category, submitter);

    // Filter to available users
    const availableUsers = primaryUsers.filter(
      (u) => u.is_active && !u.out_of_office,
    );

    if (availableUsers.length > 0) return availableUsers;

    // Try fallback if defined
    if (step.on_unavailable?.fallback?.match) {
      const fallbackUsers = await this.identityProvider.findUsers(
        step.on_unavailable.fallback.match,
      );
      const availableFallback = fallbackUsers.filter(
        (u) => u.is_active && !u.out_of_office,
      );
      if (availableFallback.length > 0) return availableFallback;
    }

    // Return primary users even if OOO — let the system handle escalation
    return primaryUsers.filter((u) => u.is_active);
  }
}
