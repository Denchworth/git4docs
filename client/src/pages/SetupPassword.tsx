import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setToken } from '../lib/api';
import { useAuth } from '../lib/auth';

const API_BASE = '/api';

function getPasswordErrors(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(pw)) errors.push('One lowercase letter');
  if (!/[0-9]/.test(pw)) errors.push('One number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('One special character');
  return errors;
}

export default function SetupPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const passwordErrors = getPasswordErrors(password);
  const confirmError = confirmPassword && password !== confirmPassword ? 'Passwords do not match' : '';
  const isValid = passwordErrors.length === 0 && password === confirmPassword && token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/auth/setup-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to set password');
        return;
      }
      setToken(data.token);
      await refresh();
      navigate('/');
    } catch {
      setError('Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4" style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-500 mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>git4docs</h1>
          <p className="text-slate-500">Invalid invite link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4" style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3"><div className="w-9 h-9 rounded-[9px] bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-lg font-bold text-white">G</div><span className="text-2xl font-bold text-slate-800 tracking-tight">git4docs</span></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Set Your Password</h2>

          {error && (
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {['At least 8 characters', 'One uppercase letter', 'One lowercase letter', 'One number', 'One special character'].map((req) => {
                  const met = !getPasswordErrors(password).includes(req);
                  return (
                    <span key={req} className={`text-xs ${met ? 'text-green-600' : 'text-slate-400'}`}>
                      {met ? '✓' : '○'} {req}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
              {confirmError && <p className="text-red-600 text-xs mt-1">{confirmError}</p>}
            </div>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Setting up...' : 'Set Password & Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
