"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getAllExtraWorkRequests } from '../../actions/extraWork';
import { FiClock } from 'react-icons/fi';

const STATUS_COLORS = {
  pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'Pending' },
  approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
  rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
};

const STAGE_LABELS = {
  pending_mgr: 'Pending Manager Review',
  pending_admin: 'Awaiting Admin Decision',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function ExtraWorkListPage() {
  const { role, isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();

  const [tab, setTab] = useState('pending_admin');
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, isSuperAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) return;
    setLoading(true);
    (async () => {
      try {
        const all = await getAllExtraWorkRequests();
        setAllRequests(all);
      } catch {
        setAllRequests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, isSuperAdmin]);

  const pendingAdmin = allRequests.filter(r => r.approvalStage === 'pending_admin' && r.status === 'pending');

  const StatusBadge = ({ status }) => {
    const s = STATUS_COLORS[status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: status };
    return <span style={{ padding: '2px 8px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="page-wrapper animate-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Extra Working Leave</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Review and manage extra work requests.</p>
      </div>

      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', width: 'fit-content' }}>
        {[
          { key: 'pending_admin', label: `Awaiting Admin (${pendingAdmin.length})` },
          { key: 'all', label: `All Requests (${allRequests.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>}

      {/* Awaiting Admin Decision */}
      {!loading && tab === 'pending_admin' && (
        <div className="card overflow-hidden p-0">
          <div className="card-header">
            Awaiting Admin Decision ({pendingAdmin.length})
          </div>
          {pendingAdmin.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', opacity: 0.25, color: 'var(--text3)', marginBottom: '12px' }}><FiClock size={36} /></div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text2)', marginBottom: '4px' }}>No pending admin reviews</div>
              <div style={{ fontSize: '13px', color: 'var(--text3)' }}>All extra work requests have been processed.</div>
            </div>
          ) : pendingAdmin.map(r => (
            <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => router.push(`/extra-work/${r.id}`)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name || 'Unknown'}</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                  {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#7b2d8b' }}>{r.hours}h</span>
                <StatusBadge status={r.status} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                {r.reason}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Requests */}
      {!loading && tab === 'all' && (
        <div className="card overflow-hidden p-0">
          <div className="card-header">
            All Extra Work Requests ({allRequests.length})
          </div>
          {allRequests.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', opacity: 0.25, color: 'var(--text3)', marginBottom: '12px' }}><FiClock size={36} /></div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text2)', marginBottom: '4px' }}>No requests found</div>
              <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Employees have not submitted any extra work requests yet.</div>
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {allRequests.map(r => (
                <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => router.push(`/extra-work/${r.id}`)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name || 'Unknown'}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                      {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#7b2d8b' }}>{r.hours}h</span>
                    <StatusBadge status={r.status} />
                    {r.adminDecision && (
                      <span style={{ fontSize: '10px', color: '#7b2d8b', background: 'rgba(175,82,222,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                        {r.adminDecision === 'half' ? 'Half Day' : 'Full Day'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                    {r.reason}
                    <span style={{ color: 'var(--text3)', fontSize: '10px', marginLeft: '8px' }}>
                      {STAGE_LABELS[r.approvalStage] || r.approvalStage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
