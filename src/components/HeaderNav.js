"use client";

import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';

export default function HeaderNav() {
  const { user, isAdmin, isSuperAdmin, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const navLinks = isAdmin ? [
    { label: 'Dashboard', path: '/' },
    { label: 'Leaves', path: '/leaves' },
    { label: 'Users', path: '/users' },
    { label: 'Settings', path: '/settings' },
  ] : [];

  const roleLabel = isSuperAdmin ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Employee';
  const roleColor = isSuperAdmin ? '#ff3b30' : user?.role === 'admin' ? 'var(--blue)' : '#34c759';
  const roleBg = isSuperAdmin ? 'rgba(255,59,48,0.1)' : user?.role === 'admin' ? 'rgba(0,113,227,0.1)' : 'rgba(52,199,89,0.1)';

  return (
    <header>
      {/* Logo */}
      <div
        className="logo"
        style={{ cursor: 'pointer', flexShrink: 0 }}
        onClick={() => isAuthenticated && router.push('/')}
      >
        <div className="logo-mark">IB</div>
        <div>
          <div className="logo-text">Interactive Bees</div>
          <div className="logo-sub">Attendance Portal</div>
        </div>
      </div>

      {/* Nav links — center */}
      {isAuthenticated && navLinks.length > 0 && (
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {navLinks.map(link => {
            const active = pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => router.push(link.path)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: active ? 'var(--surface3)' : 'transparent',
                  color: active ? 'var(--text)' : 'var(--text2)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)'; }}
              >
                {link.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Right — user info + sign out */}
      {isAuthenticated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {/* User pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '5px 12px 5px 6px',
            background: 'var(--surface2)',
            borderRadius: '980px',
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: roleBg,
              display: 'grid', placeItems: 'center',
              fontSize: '11px', fontWeight: 700,
              color: roleColor,
              flexShrink: 0,
            }}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{
                fontSize: 'var(--fs-sm)', fontWeight: 600,
                color: 'var(--text)', letterSpacing: '-0.01em',
                maxWidth: '140px', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.username}
              </div>
              <div style={{
                fontSize: 'var(--fs-xs)', color: roleColor,
                fontWeight: 500, letterSpacing: '0.01em',
              }}>
                {roleLabel}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            className="btn btn-outline"
            style={{ padding: '6px 14px', fontSize: 'var(--fs-xs)' }}
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}
