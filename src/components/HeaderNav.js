"use client";

import { useAuth } from './AuthProvider';
import { useRouter } from 'next/navigation';

export default function HeaderNav() {
  const { user, isAdmin, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  return (
    <header>
      <div className="logo" style={{ cursor: 'pointer' }} onClick={() => isAuthenticated && router.push('/')}>
        <div className="logo-mark">IB</div>
        <div>
          <div className="logo-text">Interactive Bees</div>
        </div>
      </div>

      {isAuthenticated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAdmin && (
            <button
              onClick={() => router.push('/users')}
              className="btn btn-secondary"
              style={{ padding: '5px 14px', fontSize: '13px' }}
            >
              Manage Users
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: isAdmin ? 'rgba(0,113,227,0.12)' : 'rgba(52,199,89,0.12)',
              display: 'grid', placeItems: 'center',
              fontSize: '12px', fontWeight: 700,
              color: isAdmin ? 'var(--blue)' : '#1a7f37'
            }}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                {user?.username}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text2)', textTransform: 'capitalize', letterSpacing: '0.02em' }}>
                {user?.role}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
