"use client";

import { useState, useEffect } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../components/AuthProvider';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, isAuthenticated, loading, role, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      const isAdmin = role === 'admin' || role === 'super_admin';
      router.push(isAdmin ? '/' : `/employee/${user?.code}/dashboard`);
    }
  }, [isAuthenticated, role, user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await login(email.trim(), password);
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
            <label className="input-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
            />
          </div>
          <div>
            <label className="input-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: '40px' }}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)} tabIndex={-1} style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
                color: 'var(--text3)', display: 'grid', placeItems: 'center',
                fontFamily: 'inherit', fontSize: '16px',
              }}>
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
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
