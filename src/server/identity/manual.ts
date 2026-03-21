/**
 * Manual Identity Provider
 * For development, testing, and small companies without SSO.
 * Users and attributes stored in SQLite.
 */

import type { IdentityProvider } from './provider.js';
import type { IdentityUser, MatchRule } from '../../shared/types.js';
import { filterUsersByRule } from '../config/matcher.js';
import {
  listManualIdentityUsers,
  getManualIdentityUser,
} from '../db/queries.js';

export class ManualIdentityProvider implements IdentityProvider {
  constructor(private companyId: string) {}

  async findUsers(match: MatchRule, submitter?: IdentityUser): Promise<IdentityUser[]> {
    const allUsers = listManualIdentityUsers(this.companyId);
    return filterUsersByRule(allUsers, match, submitter);
  }

  async getUser(email: string): Promise<IdentityUser | null> {
    return getManualIdentityUser(this.companyId, email) || null;
  }

  async getManager(email: string): Promise<IdentityUser | null> {
    const user = getManualIdentityUser(this.companyId, email);
    if (!user?.reports_to) return null;
    return getManualIdentityUser(this.companyId, user.reports_to) || null;
  }

  async isAvailable(email: string): Promise<boolean> {
    const user = getManualIdentityUser(this.companyId, email);
    if (!user) return false;
    return user.is_active && !user.out_of_office;
  }

  async sync(): Promise<void> {
    // No-op for manual provider — data is already in the database
  }

  async listAllUsers(): Promise<IdentityUser[]> {
    return listManualIdentityUsers(this.companyId);
  }
}
