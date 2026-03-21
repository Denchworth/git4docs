import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { setToken } from '../lib/api';

export default function LandingRedirect() {
  const { user, loading, isViewerOnly, refresh } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Pick up token from URL (used after subdomain redirect from signup)
  const urlToken = searchParams.get('token');

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      searchParams.delete('token');
      setSearchParams(searchParams, { replace: true });
      refresh();
    }
  }, [urlToken]);

  if (loading || urlToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  // Not logged in — redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // View-only users land on Documents; everyone else lands on My Work
  if (isViewerOnly) {
    return <Navigate to="/library" replace />;
  }
  return <Navigate to="/home" replace />;
}
