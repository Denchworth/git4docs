import { useState } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  children?: Array<{ path: string; label: string }>;
}

export default function Layout() {
  const { user, loading, logout, isViewerOnly } = useAuth();
  const location = useLocation();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.type === 'platform' && (user.role === 'owner' || user.role === 'admin');

  const navItems: NavItem[] = [];

  // My Work — hidden for view-only roles
  if (!isViewerOnly) {
    navItems.push({ path: '/home', label: 'My Work', icon: '◫' });
  }

  // Documents
  navItems.push({ path: '/library', label: 'Documents', icon: '⊞' });

  // Activity — hidden for view-only roles
  if (!isViewerOnly) {
    navItems.push({ path: '/activity', label: 'Activity', icon: '↻' });
  }

  // Admin — only for platform owners/admins
  if (isAdmin) {
    navItems.push({ path: '/admin', label: 'Admin', icon: '⚙' });
  }

  function isActive(item: NavItem): boolean {
    if (item.children) {
      return item.children.some(c => location.pathname.startsWith(c.path));
    }
    return location.pathname === item.path;
  }

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-sm font-bold text-white">G</div>
                <span className="text-lg font-bold text-slate-800 tracking-tight">git4docs</span>
              </Link>
              <nav className="hidden md:flex gap-0.5 items-center">
                {navItems.map((item) => (
                  item.children ? (
                    <div
                      key={item.label}
                      className="relative flex items-center"
                      onMouseEnter={() => setOpenDropdown(item.label)}
                      onMouseLeave={() => setOpenDropdown(null)}
                    >
                      <Link
                        to={item.path}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive(item)
                            ? 'text-blue-500 bg-blue-50'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        {item.label}
                        <span className="ml-1 text-xs">▾</span>
                      </Link>
                      {openDropdown === item.label && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                          {item.children.map((child) => (
                            <Link
                              key={child.path}
                              to={child.path}
                              className={`block px-4 py-2 text-sm transition-colors ${
                                location.pathname === child.path
                                  ? 'text-blue-500 bg-blue-50'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                              }`}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive(item)
                          ? 'text-blue-500 bg-blue-50'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{user.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 text-blue-500 font-medium">
                {user.role}
              </span>
              <button
                onClick={logout}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center gap-3 text-xs text-slate-400">
          <Link to="/legal/terms" className="hover:text-slate-600 transition-colors">Terms</Link>
          <span>·</span>
          <Link to="/legal/privacy" className="hover:text-slate-600 transition-colors">Privacy</Link>
          <span>·</span>
          <a href="mailto:support@git4docs.dev" className="hover:text-slate-600 transition-colors">Contact Us</a>
        </div>
      </footer>
    </div>
  );
}
