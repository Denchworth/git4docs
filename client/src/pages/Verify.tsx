import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const API_BASE = '/api';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(`Email verified for ${data.email}`);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Verification failed. Please try again.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4" style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div className="max-w-sm w-full text-center">
        <h1 className="text-3xl font-bold text-blue-500 mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>git4docs</h1>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {status === 'loading' && (
            <p className="text-slate-500">Verifying your email...</p>
          )}
          {status === 'success' && (
            <>
              <div className="text-green-500 text-4xl mb-4">✓</div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Email Verified</h2>
              <p className="text-slate-500 text-sm mb-6">{message}</p>
              <Link to="/login" className="inline-block bg-blue-500 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-600 transition-colors">
                Sign In
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <div className="text-red-400 text-4xl mb-4">✕</div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Verification Failed</h2>
              <p className="text-slate-500 text-sm mb-6">{message}</p>
              <Link to="/login" className="text-blue-500 hover:text-blue-600 text-sm font-medium">
                Go to Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
