"use client";

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useNotifications } from '../../components/NotificationProvider';
import { FiBell, FiCheck, FiClock, FiCalendar, FiEdit3, FiX, FiUserCheck, FiUserX } from 'react-icons/fi';

const TYPE_ICONS = {
  leave_submitted: <FiCalendar size={15} />,
  leave_approved: <FiCheck size={15} />,
  leave_rejected: <FiX size={15} />,
  leave_pending_super: <FiClock size={15} />,
  leave_mgr_pending: <FiClock size={15} />,
  leave_pending: <FiClock size={15} />,
  wfh_submitted: <FiCalendar size={15} />,
  wfh_approved: <FiCheck size={15} />,
  wfh_rejected: <FiX size={15} />,
  wfh_pending_super: <FiClock size={15} />,
  wfh_pending: <FiClock size={15} />,
  regularization_submitted: <FiEdit3 size={15} />,
  regularization_approved: <FiCheck size={15} />,
  regularization_rejected: <FiX size={15} />,
  regularization_pending_super: <FiClock size={15} />,
  adjustment_submitted: <FiEdit3 size={15} />,
  adjustment_approved: <FiCheck size={15} />,
  adjustment_rejected: <FiX size={15} />,
  name_change_approved: <FiUserCheck size={15} />,
  name_change_rejected: <FiUserX size={15} />,
};

const TYPE_COLORS = {
  leave_submitted: '#0071e3',
  leave_approved: '#34c759',
  leave_rejected: '#ff3b30',
  leave_pending_super: '#af52de',
  leave_mgr_pending: '#ff9f0a',
  leave_pending: '#0071e3',
  wfh_submitted: '#0071e3',
  wfh_approved: '#34c759',
  wfh_rejected: '#ff3b30',
  wfh_pending_super: '#af52de',
  wfh_pending: '#0071e3',
  regularization_submitted: '#0071e3',
  regularization_approved: '#34c759',
  regularization_rejected: '#ff3b30',
  regularization_pending_super: '#af52de',
  adjustment_submitted: '#0071e3',
  adjustment_approved: '#34c759',
  adjustment_rejected: '#ff3b30',
  name_change_approved: '#34c759',
  name_change_rejected: '#ff3b30',
};

function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getGroupLabel(date) {
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;
  const oneDay = 86400000;
  if (diff < oneDay && d.getDate() === now.getDate()) return 'Today';
  if (diff < 2 * oneDay && (d.getDate() === now.getDate() - 1 || (now.getDate() === 1 && d.getDate() === new Date(now.getFullYear(), now.getMonth(), 0).getDate()))) return 'Yesterday';
  if (diff < 7 * oneDay) return 'This Week';
  if (diff < 30 * oneDay) return 'This Month';
  return 'Earlier';
}

function getNavTarget(n) {
  try {
    const p = typeof n.payload === 'string' ? JSON.parse(n.payload) : (n.payload || {});
    if (n.type.startsWith('leave_') || n.type.startsWith('wfh_') || n.type === 'leave_pending' || n.type === 'wfh_pending') {
      if (n.type.includes('_approved') || n.type.includes('_rejected')) {
        return `/employee/${p.employeeCode || ''}/leaves`;
      }
      return '/leaves';
    }
    if (n.type.startsWith('regularization_') || n.type.startsWith('adjustment_')) {
      if (n.type.includes('_approved') || n.type.includes('_rejected')) {
        return `/employee/${p.employeeCode || ''}/regularize`;
      }
      return '/leaves';
    }
    if (n.type.startsWith('name_change_')) return '/team?tab=pending';
    if (n.type.startsWith('leave_deduction_')) return '/leaves';
    return null;
  } catch {
    return null;
  }
}

export default function NotificationsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const grouped = useMemo(() => {
    const groups = {};
    notifications.forEach(n => {
      const label = getGroupLabel(n.createdAt);
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    });
    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];
    return order.filter(g => groups[g]).map(g => ({ label: g, items: groups[g] }));
  }, [notifications]);

  const handleClick = (n) => {
    const ids = n.isRead ? [] : [n.id];
    if (ids.length) markAsRead(ids);
    const url = getNavTarget(n);
    if (url) router.push(url);
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Notifications</div>
          <div className="page-subtitle">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up'}
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '7px 16px', gap: '6px', display: 'inline-flex', alignItems: 'center' }}
            onClick={markAllAsRead}>
            <FiCheck size={13} /> Mark All as Read
          </button>
        )}
      </div>

      <div style={{ maxWidth: '680px' }}>
        {notifications.length === 0 ? (
          <div className="card card-body" style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--surface2)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <FiBell size={26} style={{ color: 'var(--text3)' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px' }}>No notifications yet</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', maxWidth: '320px', margin: '0 auto', lineHeight: 1.5 }}>
              Notifications will appear here when your requests are reviewed or when action is needed from you.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {grouped.map(group => (
              <div key={group.label}>
                <div style={{
                  fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: '10px',
                  paddingLeft: '4px',
                }}>
                  {group.label}
                  <span style={{ fontWeight: 400, marginLeft: '6px', color: 'var(--text3)' }}>
                    · {group.items.length}
                  </span>
                </div>
                <div className="card overflow-hidden p-0" style={{ borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  {group.items.map((n, i) => {
                    const color = TYPE_COLORS[n.type] || 'var(--text3)';
                    return (
                      <div key={n.id}
                        onClick={() => handleClick(n)}
                        style={{
                          padding: '16px 18px',
                          borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : 'none',
                          background: n.isRead ? 'var(--surface)' : 'rgba(0,113,227,0.03)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          display: 'flex', gap: '14px', alignItems: 'flex-start',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = n.isRead ? 'var(--surface)' : 'rgba(0,113,227,0.03)'; }}>
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '12px',
                          background: color + '14',
                          color,
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                          boxShadow: n.isRead ? 'none' : `0 0 0 1px ${color}22`,
                        }}>
                          {TYPE_ICONS[n.type] || <FiBell size={15} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>
                              {n.title}
                            </span>
                            {!n.isRead && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: '4px', boxShadow: '0 0 0 2px rgba(0,113,227,0.15)' }} />}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5, marginBottom: '6px', wordBreak: 'break-word' }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FiClock size={10} />
                            {relativeTime(n.createdAt)}
                            {getNavTarget(n) && (
                              <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--blue)', fontWeight: 500, opacity: 0.7 }}>
                                View →
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
