"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.push('/');
  }, [isAuthenticated, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await login(username.trim(), password);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    }
  };

  if (loading || isAuthenticated) return null;

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-card">
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', background: 'var(--text)', borderRadius: '14px',
            display: 'grid', placeItems: 'center', margin: '0 auto 20px',
            fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em'
          }}>IB</div>
          <h1 className="auth-title">Sign In</h1>
          <p className="auth-subtitle">Sign in to access the attendance portal.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="input-field"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255, 59, 48, 0.08)', border: '1px solid rgba(255, 59, 48, 0.2)',
              borderRadius: '8px', padding: '10px 14px', color: 'var(--red)', fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%', marginTop: '4px', padding: '12px', borderRadius: '12px', fontSize: '15px', fontWeight: 600, opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Signing in…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
