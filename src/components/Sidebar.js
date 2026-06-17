"use client";

import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { FiCalendar, FiFileText, FiTool, FiUser, FiHome, FiUsers, FiSettings } from 'react-icons/fi';
import { checkIsManager } from '../actions/manager';

const EMPLOYEE_LINKS = [
  { label: 'Attendance', icon: <FiCalendar size={14} />, path: (code) => `/employee/${code}` },
  { label: 'Leave Requests', icon: <FiFileText size={14} />, path: (code) => `/employee/${code}/leaves` },
  { label: 'Regularization', icon: <FiTool size={14} />, path: (code) => `/employee/${code}/regularize` },
  { label: 'Profile', icon: <FiUser size={14} />, path: (code) => `/employee/${code}/profile` },
];

const ADMIN_LINKS = [
  { label: 'Dashboard', icon: <FiHome size={14} />, path: '/' },
  { label: 'Attendance', icon: <FiCalendar size={14} />, path: '/attendance' },
  { label: 'Team', icon: <FiUsers size={14} />, path: '/team' },
  { label: 'Leaves', icon: <FiFileText size={14} />, path: '/leaves' },
  { label: 'Settings', icon: <FiSettings size={14} />, path: '/settings' },
];

function NavLink({ link, pathname, router, isMobile, onClose }) {
  const active = pathname === link.path;
  return (
    <button
      key={link.path}
      onClick={() => { router.push(link.path); if (isMobile && onClose) onClose(); }}
      style={{
        padding: '10px 14px',
        borderRadius: '10px',
        border: 'none',
        background: active ? 'var(--surface2)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text2)',
        fontFamily: 'inherit',
        fontSize: 'var(--fs-sm)',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '-0.01em',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)'; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)'; }}}
    >
      {link.icon}{link.label}
    </button>
  );
}

export default function Sidebar({ open, onClose, isMobile }) {
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const [isManager, setIsManager] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isPureEmployee = !isAdmin && !isManager && !!user?.code;
  const showEmployeeSection = (isAdmin || isPureEmployee) && !!user?.code;

  useEffect(() => {
    if (!user?.code || isAdmin) return;
    checkIsManager(user.code).then(setIsManager);
  }, [user?.code, isAdmin]);

  const roleLabel = isSuperAdmin ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'Employee';
  const roleColor = isSuperAdmin ? '#ff3b30' : user?.role === 'admin' ? 'var(--blue)' : '#34c759';
  const roleBg = isSuperAdmin ? 'rgba(255,59,48,0.1)' : user?.role === 'admin' ? 'rgba(0,113,227,0.1)' : 'rgba(52,199,89,0.1)';

  const desktopOpen = !isMobile;
  const visible = desktopOpen || open;

  return (
    <>
      {isMobile && open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            zIndex: 300,
          }}
        />
      )}

      <aside style={{
        width: '260px',
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        height: '100vh',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        zIndex: isMobile ? 310 : 1,
        overflowY: 'auto',
        transform: isMobile ? (open ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        visibility: visible ? 'visible' : 'hidden',
      }}>
        {/* Logo */}
        <div
          onClick={() => { router.push('/'); if (onClose) onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            cursor: 'pointer', flexShrink: 0,
            padding: '20px 20px 24px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{
            width: '32px', height: '32px', background: 'var(--text)',
            borderRadius: '9px', display: 'grid', placeItems: 'center',
            fontSize: '13px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em',
          }}>IB</div>
          <div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em' }}>Interactive Bees</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', fontWeight: 400 }}>Attendance Portal</div>
          </div>
        </div>

        {/* ── ADMIN SECTION ── */}
        {isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '12px 12px', flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: '14px' }}>
              Admin
            </div>
            {ADMIN_LINKS.map(link => (
              <NavLink key={link.path} link={link} pathname={pathname} router={router} isMobile={isMobile} onClose={onClose} />
            ))}
          </div>
        )}

        {/* ── EMPLOYEE SECTION ── */}
        {showEmployeeSection && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 12px',
            borderTop: isAdmin ? '1px solid var(--border)' : 'none',
            flex: isAdmin ? '0 0 auto' : 1,
          }}>
            {/* Section label */}
            <div style={{ fontSize: '9px', color: 'var(--text3)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: '14px', marginTop: isAdmin ? '4px' : '0' }}>
              Employee
            </div>

            {/* Employee info card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 10px', background: 'var(--surface2)',
              borderRadius: '10px', marginBottom: '4px', marginLeft: '0', marginRight: '0',
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: roleBg, display: 'grid', placeItems: 'center',
                fontSize: '12px', fontWeight: 700, color: roleColor, flexShrink: 0,
              }}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div style={{ lineHeight: 1.2, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--fs-sm)', fontWeight: 600,
                  color: 'var(--text)', letterSpacing: '-0.01em',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.username}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text2)', fontFamily: 'monospace' }}>
                  #{user?.code}
                </div>
              </div>
            </div>

            {/* Employee nav links */}
            {EMPLOYEE_LINKS.map(link => (
              <NavLink key={link.path(user?.code)} link={{ ...link, path: link.path(user?.code) }} pathname={pathname} router={router} isMobile={isMobile} onClose={onClose} />
            ))}
          </div>
        )}

        {/* ── MANAGER LINKS ── */}
        {!isAdmin && isManager && (
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '12px 12px', flex: 1 }}>
            {[
              { label: 'Dashboard', path: '/' },
              { label: 'My Team', path: '/team/manage' },
              { label: 'Leaves', path: '/leaves' },
            ].map(link => (
              <NavLink key={link.path} link={link} pathname={pathname} router={router} isMobile={isMobile} onClose={onClose} />
            ))}
          </nav>
        )}

        {/* Close button — mobile only */}
        {isMobile && (
          <button
            onClick={onClose}
            style={{
              padding: '10px 14px', margin: '0 12px',
              borderRadius: '10px', border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--text2)',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 'var(--fs-sm)', fontWeight: 500,
              textAlign: 'center', width: 'calc(100% - 24px)',
            }}
          >✕ Close</button>
        )}

        {/* User pill + Sign Out */}
        <div style={{
          borderTop: '1px solid var(--border)', padding: '16px 16px 20px',
          display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 10px', background: 'var(--surface2)',
            borderRadius: '14px', border: '1px solid var(--border)',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: roleBg, display: 'grid', placeItems: 'center',
              fontSize: '13px', fontWeight: 700, color: roleColor, flexShrink: 0,
            }}>
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div style={{ lineHeight: 1.2, minWidth: 0 }}>
              <div style={{
                fontSize: 'var(--fs-sm)', fontWeight: 600,
                color: 'var(--text)', letterSpacing: '-0.01em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user?.username}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: roleColor, fontWeight: 500 }}>
                {roleLabel}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              padding: '9px 14px', borderRadius: '10px',
              border: '1px solid rgba(255,59,48,0.25)',
              background: 'rgba(255,59,48,0.06)',
              color: 'var(--red)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
              fontWeight: 600, textAlign: 'center',
              width: '100%', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.06)'; }}
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
