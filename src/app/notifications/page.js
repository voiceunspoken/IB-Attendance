"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useNotifications } from '../../components/NotificationProvider';
import { FiBell, FiCheck, FiClock, FiCalendar, FiEdit3, FiX } from 'react-icons/fi';

const TYPE_ICONS = {
  leave_submitted: <FiCalendar size={14} />,
  leave_approved: <FiCheck size={14} />,
  leave_rejected: <FiX size={14} />,
  leave_pending_super: <FiClock size={14} />,
  leave_mgr_pending: <FiClock size={14} />,
  regularization_submitted: <FiEdit3 size={14} />,
  regularization_approved: <FiCheck size={14} />,
  regularization_rejected: <FiX size={14} />,
  regularization_pending_super: <FiClock size={14} />,
  adjustment_submitted: <FiEdit3 size={14} />,
  adjustment_approved: <FiCheck size={14} />,
  adjustment_rejected: <FiX size={14} />,
  name_change_approved: <FiCheck size={14} />,
  name_change_rejected: <FiX size={14} />,
};

const TYPE_COLORS = {
  leave_submitted: '#0071e3',
  leave_approved: '#34c759',
  leave_rejected: '#ff3b30',
  leave_pending_super: '#af52de',
  leave_mgr_pending: '#ff9f0a',
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
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 14px' }}
            onClick={markAllAsRead}>
            <FiCheck size={12} /> Mark All as Read
          </button>
        )}
      </div>

      <div style={{ maxWidth: '680px' }}>
        {notifications.length === 0 ? (
          <div className="card card-body" style={{ textAlign: 'center', padding: '60px 24px' }}>
            <FiBell size={32} style={{ color: 'var(--text3)', marginBottom: '12px' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text2)', marginBottom: '4px' }}>No notifications yet</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Notifications will appear here when your requests are reviewed.</div>
          </div>
        ) : (
          <div className="card overflow-hidden p-0" style={{ borderRadius: '14px' }}>
            {notifications.map((n, i) => (
              <div key={n.id}
                onClick={() => { if (!n.isRead) markAsRead([n.id]); }}
                style={{
                  padding: '14px 18px',
                  borderBottom: i < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                  background: n.isRead ? 'transparent' : 'var(--surface2)',
                  cursor: n.isRead ? 'default' : 'pointer',
                  transition: 'background 0.15s',
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: (TYPE_COLORS[n.type] || 'var(--text3)') + '14',
                  color: TYPE_COLORS[n.type] || 'var(--text3)',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  {TYPE_ICONS[n.type] || <FiBell size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{n.title}</span>
                    {!n.isRead && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.4, marginBottom: '2px' }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiClock size={10} /> {relativeTime(n.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
