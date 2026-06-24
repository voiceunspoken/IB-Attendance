"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useNotifications } from '../../components/NotificationProvider';
import { FiBell, FiCheck, FiClock, FiCalendar, FiEdit3, FiX, FiUserCheck, FiUserX, FiChevronRight } from 'react-icons/fi';

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

function isActionable(type) {
  return type.includes('pending_super') || type.includes('mgr_pending') || type === 'leave_pending' || type === 'wfh_pending' || type === 'regularization_submitted' || type === 'adjustment_submitted';
}

function getActionLabel(type) {
  if (type.includes('pending_super')) return 'Approve Now';
  if (type.includes('mgr_pending') || type === 'leave_pending' || type === 'wfh_pending') return 'Review Request';
  return 'View Details';
}

function getCategory(type) {
  if (type.startsWith('leave_') || type === 'leave_pending') return 'leaves';
  if (type.startsWith('wfh_') || type === 'wfh_pending') return 'wfh';
  if (type.startsWith('regularization_')) return 'regularization';
  if (type.startsWith('adjustment_')) return 'adjustment';
  if (type.startsWith('name_change_')) return 'name_change';
  return 'other';
}

function relativeTimeFull(date) {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const mins = Math.floor(seconds / 60);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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

function getPayload(n) {
  try {
    return typeof n.payload === 'string' ? JSON.parse(n.payload) : (n.payload || {});
  } catch {
    return {};
  }
}

function getEmployeeSummary(n) {
  const p = getPayload(n);
  const parts = [];
  if (p.employeeName) parts.push(p.employeeName);
  else if (p.employeeCode) parts.push(`#${p.employeeCode}`);
  if (p.leaveType) parts.push(p.leaveType.toUpperCase());
  if (p.days) parts.push(`${p.days}d`);
  if (p.workType) parts.push(p.workType.toUpperCase());
  if (p.date && !p.leaveType) parts.push(new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  return parts.length ? parts.join(' · ') : null;
}

function getNavTarget(n) {
  const p = getPayload(n);
  const cat = getCategory(n.type);
  if (cat === 'leaves' || cat === 'wfh') {
    if (isActionable(n.type) && p.requestId) {
      return `/leaves/${p.requestId}`;
    }
    if (n.type.includes('_approved') || n.type.includes('_rejected')) {
      return `/employee/${p.employeeCode || ''}/leaves`;
    }
    return '/leaves';
  }
  if (cat === 'regularization' || cat === 'adjustment') {
    if (n.type.includes('_approved') || n.type.includes('_rejected')) {
      return `/employee/${p.employeeCode || ''}/regularize`;
    }
    return '/leaves';
  }
  if (cat === 'name_change') return '/team?tab=pending';
  return null;
}

export default function NotificationsPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { notifications, unreadCount, loadNotifications, markAsRead, markAllAsRead } = useNotifications();
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.isRead);
    if (filter === 'approvals') return notifications.filter(n => isActionable(n.type));
    return notifications;
  }, [notifications, filter]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(n => {
      const label = getGroupLabel(n.createdAt);
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    });
    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];
    return order.filter(g => groups[g]).map(g => ({ label: g, items: groups[g] }));
  }, [filtered]);

  const handleClick = (n) => {
    const ids = n.isRead ? [] : [n.id];
    if (ids.length) markAsRead(ids);
    const url = getNavTarget(n);
    if (url) router.push(url);
  };

  const filterTabs = [
    { key: 'all', label: `All (${notifications.length})` },
    { key: 'unread', label: `Unread (${unreadCount})` },
    { key: 'approvals', label: `Approvals (${notifications.filter(n => isActionable(n.type)).length})` },
  ];

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div>
          <div className="page-title">Notifications</div>
          <div className="page-subtitle">
            {notifications.length === 0
              ? 'No notifications yet'
              : unreadCount > 0
                ? `${unreadCount} unread · ${notifications.length} total`
                : `${notifications.length} total · All caught up`}
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '7px 16px', gap: '6px', display: 'inline-flex', alignItems: 'center' }}
            onClick={markAllAsRead}>
            <FiCheck size={13} /> Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', width: 'fit-content' }}>
        {filterTabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} style={{
            padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: filter === t.key ? 'var(--surface)' : 'transparent',
            color: filter === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: filter === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ maxWidth: '680px' }}>
        {filtered.length === 0 ? (
          <div className="card card-body" style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--surface2)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <FiBell size={26} style={{ color: 'var(--text3)' }} />
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px' }}>
              {filter === 'all' ? 'No notifications yet' : filter === 'unread' ? 'No unread notifications' : 'No pending approvals'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', maxWidth: '320px', margin: '0 auto', lineHeight: 1.5 }}>
              {filter !== 'all' ? 'Try switching to a different filter.' : 'Notifications will appear here when your requests are reviewed or when action is needed from you.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {grouped.map(group => (
              <div key={group.label}>
                <div style={{
                  fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: '12px',
                  paddingLeft: '4px',
                }}>
                  {group.label}
                  <span style={{ fontWeight: 400, marginLeft: '6px', color: 'var(--text3)' }}>
                    · {group.items.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {group.items.map(n => {
                    const color = TYPE_COLORS[n.type] || 'var(--text3)';
                    const actionable = isActionable(n.type);
                    const summary = getEmployeeSummary(n);
                    const isUnread = !n.isRead;

                    return (
                      <div key={n.id}
                        onClick={() => handleClick(n)}
                        style={{
                          background: isUnread ? `rgba(0,113,227,0.03)` : 'var(--surface)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          display: 'flex', gap: '14px', alignItems: 'flex-start',
                          borderLeft: `3px solid ${isUnread ? color : 'var(--border)'}`,
                          borderRadius: '16px',
                          border: `1px solid ${isUnread ? color + '22' : 'var(--border)'}`,
                          boxShadow: isUnread ? `0 1px 3px ${color}11` : 'var(--shadow-sm)',
                          padding: '16px 18px',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isUnread ? 'rgba(0,113,227,0.03)' : 'var(--surface)'; e.currentTarget.style.boxShadow = isUnread ? `0 1px 3px ${color}11` : 'var(--shadow-sm)'; }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '12px',
                          background: color + '14',
                          color,
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                          boxShadow: isUnread ? `0 0 0 1px ${color}22` : 'none',
                        }}>
                          {TYPE_ICONS[n.type] || <FiBell size={16} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, flex: 1 }}>
                              {n.title}
                            </span>
                            {isUnread && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: '5px', boxShadow: '0 0 0 2px rgba(0,113,227,0.15)' }} />
                            )}
                          </div>
                          {actionable && (
                            <div style={{ marginBottom: '5px' }}>
                              <span style={{
                                display: 'inline-flex', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.04em', padding: '2px 8px', borderRadius: '980px',
                                background: color + '18', color,
                              }}>
                                Action Required
                              </span>
                            </div>
                          )}
                          <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5, marginBottom: summary ? '3px' : '7px', wordBreak: 'break-word' }}>
                            {n.message}
                          </div>
                          {summary && (
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.4, marginBottom: '7px', padding: '5px 10px', background: 'var(--surface2)', borderRadius: '8px', display: 'inline-block', border: '1px solid var(--border)' }}>
                              {summary}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FiClock size={10} /> {relativeTimeFull(n.createdAt)}
                            </span>
                            <span style={{ flex: 1 }} />
                            {getNavTarget(n) && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '11px', fontWeight: 600,
                                color: actionable ? '#fff' : 'var(--blue)',
                                background: actionable ? color : 'transparent',
                                padding: actionable ? '5px 14px' : '0',
                                borderRadius: '980px',
                                transition: 'all 0.15s',
                              }}>
                                {getActionLabel(n.type)} {actionable ? <FiChevronRight size={12} /> : '→'}
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
