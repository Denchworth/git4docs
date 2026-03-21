/**
 * git4docs Identity Provider Interface
 * Abstract interface that all identity providers implement.
 */

import type { IdentityUser, MatchRule } from '../../shared/types.js';

export interface IdentityProvider {
  /** Get all users matching a set of attribute conditions */
  findUsers(match: MatchRule, submitter?: IdentityUser): Promise<IdentityUser[]>;

  /** Get a specific user's attributes */
  getUser(email: string): Promise<IdentityUser | null>;

  /** Get a user's manager (for relationship matching) */
  getManager(email: string): Promise<IdentityUser | null>;

  /** Check if a user is available (not OOO, not deactivated) */
  isAvailable(email: string): Promise<boolean>;

  /** Refresh the cached directory */
  sync(): Promise<void>;

  /** Get all users (for admin preview-match tool) */
  listAllUsers(): Promise<IdentityUser[]>;
}
