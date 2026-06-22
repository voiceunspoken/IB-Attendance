"use client";

import { useAuth } from './AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { FiCalendar, FiFileText, FiTool, FiUser, FiHome, FiUsers, FiSettings, FiBell } from 'react-icons/fi';
import { checkIsManager } from '../actions/manager';
import { useNotifications } from './NotificationProvider';

const NAV_CONFIG = {
  super_admin: [
    { section: 'Super Admin', links: [
      { label: 'Dashboard', icon: <FiHome size={14} />, path: '/' },
      { label: 'Attendance', icon: <FiCalendar size={14} />, path: '/attendance' },
      { label: 'Team', icon: <FiUsers size={14} />, path: '/team' },
      { label: 'Leaves', icon: <FiFileText size={14} />, path: '/leaves' },
      { label: 'Audit', icon: <FiFileText size={14} />, path: '/audit' },
      { label: 'Notifications', icon: <FiBell size={14} />, path: '/notifications' },
      { label: 'Settings', icon: <FiSettings size={14} />, path: '/settings' },
    ]},
  ],

  admin: [
    { section: 'Admin', links: [
      { label: 'Dashboard', icon: <FiHome size={14} />, path: '/' },
      { label: 'Attendance', icon: <FiCalendar size={14} />, path: '/attendance' },
      { label: 'Team', icon: <FiUsers size={14} />, path: '/team' },
      { label: 'Leaves', icon: <FiFileText size={14} />, path: '/leaves' },
      { label: 'Audit', icon: <FiFileText size={14} />, path: '/audit' },
      { label: 'Notifications', icon: <FiBell size={14} />, path: '/notifications' },
      { label: 'Settings', icon: <FiSettings size={14} />, path: '/settings' },
    ]},
    { section: 'Employee', links: [
      { label: 'Attendance', icon: <FiCalendar size={14} />, path: (code) => `/employee/${code}` },
      { label: 'Leave Requests', icon: <FiFileText size={14} />, path: (code) => `/employee/${code}/leaves` },
      { label: 'Work Mode', icon: <FiHome size={14} />, path: (code) => `/employee/${code}/wfh` },
      { label: 'Regularization', icon: <FiTool size={14} />, path: (code) => `/employee/${code}/regularize` },
      { label: 'Profile', icon: <FiUser size={14} />, path: (code) => `/employee/${code}/profile` },
    ]},
  ],

  employee: [
    { section: 'Employee', links: [
      { label: 'Attendance', icon: <FiCalendar size={14} />, path: (code) => `/employee/${code}` },
      { label: 'Leave Requests', icon: <FiFileText size={14} />, path: (code) => `/employee/${code}/leaves` },
      { label: 'Work Mode', icon: <FiHome size={14} />, path: (code) => `/employee/${code}/wfh` },
      { label: 'Regularization', icon: <FiTool size={14} />, path: (code) => `/employee/${code}/regularize` },
      { label: 'Notifications', icon: <FiBell size={14} />, path: '/notifications' },
      { label: 'Profile', icon: <FiUser size={14} />, path: (code) => `/employee/${code}/profile` },
    ]},
  ],
};

function NavLink({ link, badge, pathname, router, isMobile, onClose }) {
  const resolvedPath = typeof link.path === 'function' ? link.path('') : link.path;
  const active = pathname === resolvedPath;

  return (
    <button
      onClick={() => {
        router.push(resolvedPath);
        if (isMobile && onClose) onClose();
      }}
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
      {badge > 0 && (
        <span style={{
          marginLeft: 'auto', background: 'var(--red)', color: '#fff',
          fontSize: '10px', fontWeight: 700, padding: '1px 6px',
          borderRadius: '980px', lineHeight: 1.4,
        }}>{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  );
}

function NavSection({ section, userCode, pathname, router, isMobile, onClose, unreadCount }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{
        fontSize: '9px', color: 'var(--text3)', fontWeight: 700, marginBottom: '6px',
        letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: '14px',
      }}>
        {section.section}
      </div>
      {section.links.map(link => {
        const resolvedPath = typeof link.path === 'function' ? link.path(userCode) : link.path;
        const badge = link.label === 'Notifications' ? unreadCount : 0;
        return (
          <NavLink
            key={resolvedPath}
            link={{ ...link, path: resolvedPath }}
            badge={badge}
            pathname={pathname}
            router={router}
            isMobile={isMobile}
            onClose={onClose}
          />
        );
      })}
    </div>
  );
}

export default function Sidebar({ open, onClose, isMobile }) {
  const { user, role, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [isManager, setIsManager] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user?.code || role === 'admin' || role === 'super_admin') return;
    checkIsManager(user.code).then(setIsManager);
  }, [user?.code, role]);

  const roleLabel = role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'employee' ? 'Employee' : '';
  const roleColor = role === 'super_admin' ? '#ff3b30' : role === 'admin' ? 'var(--blue)' : '#34c759';
  const roleBg = role === 'super_admin' ? 'rgba(255,59,48,0.1)' : role === 'admin' ? 'rgba(0,113,227,0.1)' : 'rgba(52,199,89,0.1)';

  const navSections = NAV_CONFIG[role] || [];

  const desktopOpen = !isMobile;
  const visible = desktopOpen || open;

  return (
    <>
      {isMobile && open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
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
        height: '100%',
        overflowY: 'auto',
        position: isMobile ? 'fixed' : 'relative',
        top: 0,
        left: 0,
        zIndex: isMobile ? 310 : 1,
        transform: isMobile ? (open ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        visibility: visible ? 'visible' : 'hidden',
      }}>
        {/* ── Logo ── */}
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

        {/* ── Nav sections (data-driven per role) ── */}
        <nav style={{
          display: 'flex', flexDirection: 'column', gap: '20px',
          padding: '12px 12px', flex: 1,
        }}>
          {navSections.map(section => (
            <NavSection
              key={section.section}
              section={section}
              userCode={user?.code}
              pathname={pathname}
              router={router}
              isMobile={isMobile}
              onClose={onClose}
              unreadCount={unreadCount}
            />
          ))}
        </nav>

        {/* ── Manager links (non-admin managers only) ── */}
        {role === 'employee' && isManager && (
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{
              fontSize: '9px', color: 'var(--text3)', fontWeight: 700, marginBottom: '6px',
              letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: '14px',
            }}>
              Manager
            </div>
            {[
              { label: 'Dashboard', icon: <FiHome size={14} />, path: '/' },
              { label: 'My Team', icon: <FiUsers size={14} />, path: '/team/manage' },
              { label: 'Leaves', icon: <FiFileText size={14} />, path: '/leaves' },
            ].map(link => (
              <NavLink key={link.path} link={link} pathname={pathname} router={router} isMobile={isMobile} onClose={onClose} />
            ))}
          </nav>
        )}

        {/* ── User pill + Sign Out ── */}
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
