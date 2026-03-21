/**
 * Auth Context
 * Provides current user state and company settings throughout the app.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getMe, getToken, setToken, getCompanySettings, getDocumentPermissions } from './api';
import type { RevisionFormat } from '../../../src/shared/types';

interface User {
  user_id?: string;
  email: string;
  name: string;
  company_id: string;
  role: string;
  type: 'platform' | 'document';
}

interface CompanySettings {
  revision_format: RevisionFormat;
  revision_start: number;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  companySettings: CompanySettings;
  isViewerOnly: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: CompanySettings = {
  revision_format: 'number',
  revision_start: 1,
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  companySettings: defaultSettings,
  isViewerOnly: false,
  logout: () => {},
  refresh: async () => {},
  refreshSettings: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultSettings);
  const [isViewerOnly, setIsViewerOnly] = useState(false);

  const loadSettings = useCallback(async (companyId: string) => {
    try {
      const { company } = await getCompanySettings(companyId);
      setCompanySettings({
        revision_format: company.revision_format || 'number',
        revision_start: company.revision_start ?? 1,
      });
    } catch {
      // Use defaults
    }
  }, []);

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await getMe();
      setUser(user);
      await loadSettings(user.company_id);
      try {
        const { is_viewer_only } = await getDocumentPermissions();
        setIsViewerOnly(is_viewer_only);
      } catch {
        // Permissions fetch failed — default to non-viewer
      }
    } catch {
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshSettings = async () => {
    if (user) await loadSettings(user.company_id);
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, companySettings, isViewerOnly, logout, refresh, refreshSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
