import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signup } from '../lib/api';
import { useAuth } from '../lib/auth';

const templates = [
  { id: 'general', name: 'General', desc: 'Generic starter template' },
  { id: 'manufacturing', name: 'Manufacturing', desc: 'ISO 9001 / manufacturing' },
  { id: 'medical-device', name: 'Medical Device', desc: 'FDA / ISO 13485' },
  { id: 'finance', name: 'Finance', desc: 'SOX compliance' },
];

const NAME_REGEX = /^[a-zA-Z\s]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordErrors(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(pw)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(pw)) errors.push('One lowercase letter');
  if (!/[0-9]/.test(pw)) errors.push('One number');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('One special character');
  return errors;
}

export default function Signup() {
  const [companyName, setCompanyName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [template, setTemplate] = useState('general');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nameError = touched.name && (!name.trim() ? 'Name is required' : !NAME_REGEX.test(name.trim()) ? 'Name can only contain letters and spaces' : '');
  const emailError = touched.email && email && !EMAIL_REGEX.test(email) ? 'Enter a valid email address' : '';
  const passwordErrors = getPasswordErrors(password);
  const confirmError = touched.confirmPassword && confirmPassword && password !== confirmPassword ? 'Passwords do not match' : '';

  const isValid = name.trim() && NAME_REGEX.test(name.trim()) && EMAIL_REGEX.test(email) && passwordErrors.length === 0 && password === confirmPassword && companyName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    if (!isValid) return;

    setError('');
    setLoading(true);

    try {
      const result = await signup({
        company_name: companyName,
        owner_name: name.trim(),
        owner_email: email,
        owner_password: password,
        template,
      });
      // Redirect to company subdomain with token
      const host = window.location.hostname;
      const companySlug = result.company?.slug || slug;
      if (host.endsWith('git4docs.app') && !host.includes(companySlug)) {
        window.location.href = `https://${companySlug}.git4docs.app/?token=${encodeURIComponent(result.token)}`;
      } else {
        await refresh();
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12" style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-[9px] bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-lg font-bold text-white">G</div>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">git4docs</span>
          </div>
          <p className="text-slate-500 mt-2">Set up your Document Library</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-semibold mb-6">Create Your Account</h2>

          {error && (
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                placeholder="Acme Manufacturing"
                required
              />
              {slug && (
                <p className="text-xs text-slate-400 mt-1">
                  Your URL: <span className="font-medium text-blue-500">{slug}.git4docs.app</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Industry Template</label>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      template === t.id
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-slate-200 hover:border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs opacity-75">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, name: true }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${nameError ? 'border-red-300' : 'border-slate-200'}`}
                required
              />
              {nameError && <p className="text-red-600 text-xs mt-1">{nameError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${emailError ? 'border-red-300' : 'border-slate-200'}`}
                required
              />
              {emailError && <p className="text-red-600 text-xs mt-1">{emailError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${touched.password && passwordErrors.length > 0 ? 'border-red-300' : 'border-slate-200'}`}
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
                onBlur={() => setTouched(t => ({ ...t, confirmPassword: true }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent ${confirmError ? 'border-red-300' : 'border-slate-200'}`}
                required
              />
              {confirmError && <p className="text-red-600 text-xs mt-1">{confirmError}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Document Library'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-500 hover:text-blue-600 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
