"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getAllLeaveRequests } from '../../actions/leave';
import { getAuditLog } from '../../actions/audit';
import { FiClipboard, FiSun, FiUser, FiCalendar, FiFileText, FiSettings, FiAward, FiRefreshCw, FiFilter } from 'react-icons/fi';

const LEAVE_LABELS = { cl: 'CL', sl: 'SL', el: 'EL', rl: 'RL', sh: 'SH' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b' };

export default function AuditPage() {
  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();

  const [tab, setTab] = useState('leave_history');

  // Leave history
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [lhLoading, setLhLoading] = useState(true);

  // Audit log
  const [auditLog, setAuditLog] = useState([]);
  const [auditFilterEntity, setAuditFilterEntity] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterPerformer, setAuditFilterPerformer] = useState('');

  const ENTITY_META = {
    user: { icon: <FiUser size={14} />, color: '#0071e3', bg: 'rgba(0,113,227,0.08)', label: 'User' },
    employee: { icon: <FiCalendar size={14} />, color: '#34c759', bg: 'rgba(52,199,89,0.08)', label: 'Employee' },
    leave_request: { icon: <FiFileText size={14} />, color: '#ff9f0a', bg: 'rgba(255,159,10,0.08)', label: 'Leave' },
    attendance_policy: { icon: <FiSettings size={14} />, color: '#af52de', bg: 'rgba(175,82,222,0.08)', label: 'Policy' },
    holiday: { icon: <FiSun size={14} />, color: '#ff6b35', bg: 'rgba(255,107,53,0.08)', label: 'Holiday' },
    pending_change: { icon: <FiAward size={14} />, color: '#5ac8fa', bg: 'rgba(90,200,250,0.08)', label: 'Change' },
    super_admin_config: { icon: <FiSettings size={14} />, color: '#ff3b30', bg: 'rgba(255,59,48,0.08)', label: 'Config' },
  };

  const getEntityMeta = (entity) => ENTITY_META[entity] || { icon: <FiFileText size={14} />, color: 'var(--text2)', bg: 'var(--surface2)', label: entity };

  const groupByDate = (entries) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const groups = { today: [], yesterday: [], week: [], older: [] };
    entries.forEach(e => {
      const d = new Date(e.createdAt); d.setHours(0,0,0,0);
      if (+d === +today) groups.today.push(e);
      else if (+d === +yesterday) groups.yesterday.push(e);
      else if (d >= weekStart) groups.week.push(e);
      else groups.older.push(e);
    });
    return groups;
  };

  const filteredLog = useMemo(() => {
    let items = auditLog;
    if (auditFilterEntity) items = items.filter(l => l.entity === auditFilterEntity);
    if (auditFilterAction) items = items.filter(l => l.action === auditFilterAction);
    if (auditFilterPerformer) items = items.filter(l => l.performedBy === auditFilterPerformer);
    return groupByDate(items);
  }, [auditLog, auditFilterEntity, auditFilterAction, auditFilterPerformer]);

  const filterOptions = useMemo(() => {
    const entities = [...new Set(auditLog.map(l => l.entity))].sort();
    const actions = [...new Set(auditLog.map(l => l.action))].sort();
    const performers = [...new Set(auditLog.map(l => l.performedBy))].sort();
    return { entities, actions, performers };
  }, [auditLog]);

  const getDateGroupLabel = (key) => {
    const labels = { today: 'Today', yesterday: 'Yesterday', week: 'This Week', older: 'Older' };
    return labels[key] || key;
  };

  const statusBadge = (status) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b' }
    };
    const s = map[status] || map.pending;
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
  };

  const fetchAuditLog = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const logs = await getAuditLog({ limit: 200 });
      setAuditLog(logs);
    } catch { setAuditLog([]); }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLhLoading(true);
      try {
        const reqs = await getAllLeaveRequests();
        setLeaveRequests(reqs);
      } catch {
        setLeaveRequests([]);
      } finally {
        setLhLoading(false);
      }
    })();
    if (isSuperAdmin) fetchAuditLog();
  }, [isAdmin, isSuperAdmin, fetchAuditLog]);

  const tabs = [
    { key: 'leave_history', label: `Leave History (${leaveRequests.length})` },
    ...(isSuperAdmin ? [{ key: 'audit_log', label: 'Audit Log' }] : []),
  ];

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  return (
    <div className="page-wrapper animate-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Audit</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Leave request history and system audit log.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── LEAVE HISTORY ── */}
      {tab === 'leave_history' && (
        <div className="card overflow-hidden p-0">
          <div className="card-header">
            All Leave Requests ({leaveRequests.length})
          </div>
          {lhLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>
          ) : leaveRequests.length === 0 ? (
            <div className="p-32 text-center">
              <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25 }}><FiClipboard size={36} /></div>
              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: 'var(--text2)' }}>No leave requests yet</div>
              <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>Employees can apply for leave from their profile page.</div>
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {leaveRequests.map(r => (
                <div key={r.id} className="p-16-20 border-bottom flex-between items-start" style={{ gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name || 'Unknown'}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                      {r.shiftSlot && <span style={{ fontSize: '11px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                      {statusBadge(r.status)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      {' · '}{r.reason}
                    </div>
                    {r.prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '2px' }}>📎 Prescription attached</div>}
                    {r.reviewNote && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px', fontStyle: 'italic' }}>Note: {r.reviewNote}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG (super_admin only) ── */}
      {tab === 'audit_log' && isSuperAdmin && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Audit Log ({auditLog.length} entries)</span>
            <button className="btn btn-outline" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={fetchAuditLog}>
              <FiRefreshCw size={12} style={{ marginRight: '4px' }} /> Refresh
            </button>
          </div>

          {/* Filters */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface2)' }}>
            <FiFilter size={13} style={{ color: 'var(--text2)' }} />
            <select value={auditFilterEntity} onChange={e => setAuditFilterEntity(e.target.value)}
              className="input-field" style={{ padding: '5px 10px', fontSize: '12px', width: 'auto', minWidth: '120px' }}>
              <option value="">All Entities</option>
              {filterOptions.entities.map(e => (
                <option key={e} value={e}>{getEntityMeta(e).label}</option>
              ))}
            </select>
            <select value={auditFilterAction} onChange={e => setAuditFilterAction(e.target.value)}
              className="input-field" style={{ padding: '5px 10px', fontSize: '12px', width: 'auto', minWidth: '130px' }}>
              <option value="">All Actions</option>
              {filterOptions.actions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={auditFilterPerformer} onChange={e => setAuditFilterPerformer(e.target.value)}
              className="input-field" style={{ padding: '5px 10px', fontSize: '12px', width: 'auto', minWidth: '120px' }}>
              <option value="">All Users</option>
              {filterOptions.performers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(auditFilterEntity || auditFilterAction || auditFilterPerformer) && (
              <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => { setAuditFilterEntity(''); setAuditFilterAction(''); setAuditFilterPerformer(''); }}>
                Clear
              </button>
            )}
          </div>

          <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
            {auditLog.length === 0
              ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No audit entries yet.</div>
              : Object.entries(filteredLog).map(([groupKey, entries]) =>
                  entries.length === 0 ? null : (
                    <div key={groupKey}>
                      <div style={{ padding: '8px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                        {getDateGroupLabel(groupKey)} — {entries.length} event{entries.length !== 1 ? 's' : ''}
                      </div>
                      {entries.map(log => {
                        const meta = getEntityMeta(log.entity);
                        return (
                          <div key={log.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: meta.bg, color: meta.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              {meta.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600 }}>{log.performedBy}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{log.action.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: '10px', background: meta.bg, color: meta.color, padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{meta.label}</span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.4 }}>{log.detail}</div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )
            }
          </div>
        </div>
      )}
    </div>
  );
}
