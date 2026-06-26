"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { getExtraWorkRequest, reviewExtraWorkMgr, reviewExtraWorkAdmin } from '../../../actions/extraWork';
import { FiCalendar, FiClock } from 'react-icons/fi';

const STATUS_COLORS = {
  pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'Pending' },
  approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
  rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
};

export default function ExtraWorkDetailPage({ params }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState('full');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, isSuperAdmin, authLoading, router]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getExtraWorkRequest(id).then(r => {
      if (!cancelled) { setRequest(r); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setLoading(false); router.push('/extra-work'); }
    });
    return () => { cancelled = true; };
  }, [id, router]);

  const handleReview = async (approve) => {
    setError('');
    setSuccess('');
    if (!approve && !note.trim()) return setError('Rejection reason is required.');
    setActionLoading(true);
    let result;
    if (request.approvalStage === 'pending_admin') {
      result = await reviewExtraWorkAdmin(id, user.username, decision, approve, note.trim());
    } else {
      result = await reviewExtraWorkMgr(id, user.username, approve, note.trim());
    }
    setActionLoading(false);
    if (result?.error) return setError(result.error);
    setSuccess(approve ? 'Request approved.' : 'Request rejected.');
    const r = await getExtraWorkRequest(id);
    setRequest(r);
    setNote('');
  };

  if (authLoading || loading) return <div className="page-wrapper animate-fade-in"><div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>Loading…</div></div>;
  if (!request) return <div className="page-wrapper animate-fade-in"><div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)' }}>Request not found.</div></div>;

  const isPending = request.status === 'pending';
  const isAdminStage = request.approvalStage === 'pending_admin' && isAdmin;
  const isMgrStage = request.approvalStage === 'pending_mgr' && (role === 'admin' || role === 'super_admin');

  const s = STATUS_COLORS[request.status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: request.status };

  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: '640px' }}>
      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => router.push('/extra-work')} style={{
          background: 'none', border: 'none', color: 'var(--blue)', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '13px', fontWeight: 500, padding: '4px 0', marginBottom: '8px',
        }}>
          ← Back to Extra Work
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em' }}>Extra Work Request</h1>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>{request.user?.name || 'Unknown'}</span>
          <span style={{ fontSize: '13px', color: 'var(--text2)' }}>#{request.user?.code}</span>
          <span style={{ padding: '3px 10px', borderRadius: '980px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiCalendar size={11} /> Date
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>
              {new Date(request.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FiClock size={11} /> Hours
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{request.hours}h</div>
          </div>
        </div>

        <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>Reason</div>
          <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>{request.reason}</div>
        </div>

        {request.mgrReviewNote && (
          <div style={{ background: 'rgba(0,113,227,0.06)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>
              Manager Note {request.mgrReviewedBy && `(by ${request.mgrReviewedBy})`}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text)' }}>{request.mgrReviewNote}</div>
          </div>
        )}

        {request.approvalStage !== 'pending' && request.approvalStage !== 'pending_mgr' && (
          <div style={{ background: 'rgba(52,199,89,0.06)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>
              Decision
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text)' }}>
              {request.adminDecision === 'half' ? 'Half Day (0.5 EWL)' : request.adminDecision === 'full' ? 'Full Day (1.0 EWL)' : '—'}
            </div>
          </div>
        )}

        {isPending && (isAdminStage || isMgrStage) && (
          <>
            {isAdminStage && (
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Decision</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[
                    { value: 'full', label: 'Full Day (1.0 EWL)' },
                    { value: 'half', label: 'Half Day (0.5 EWL)' },
                  ].map(o => (
                    <button key={o.value} type="button" onClick={() => setDecision(o.value)} style={{
                      flex: 1, padding: '10px 16px', borderRadius: '10px', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                      border: decision === o.value ? '2px solid var(--blue)' : '1.5px solid var(--border)',
                      background: decision === o.value ? 'rgba(0,113,227,0.06)' : 'var(--surface2)',
                      color: decision === o.value ? 'var(--blue)' : 'var(--text2)',
                      transition: 'all 0.1s',
                    }}>{o.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="input-label" style={{ marginBottom: '6px', display: 'block' }}>
                Review Note <span style={{ color: 'var(--red)', fontWeight: 400, fontSize: '10px' }}>(required when rejecting)</span>
              </label>
              <input className="input-field" placeholder="Add a note for the employee…" value={note}
                onChange={e => setNote(e.target.value)} style={{ padding: '10px 14px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }} />
            </div>

            {error && <div style={{ fontSize: '13px', color: 'var(--red)', background: 'rgba(255,59,48,0.06)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{error}</div>}
            {success && <div style={{ fontSize: '13px', color: 'var(--green)', background: 'rgba(52,199,89,0.06)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>{success}</div>}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '14px', background: 'var(--green)' }}
                disabled={actionLoading} onClick={() => handleReview(true)}>
                {actionLoading ? 'Processing…' : 'Approve'}
              </button>
              <button style={{ flex: 1, padding: '12px', fontSize: '14px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.08)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                disabled={actionLoading} onClick={() => handleReview(false)}>
                Reject
              </button>
            </div>
          </>
        )}

        {request.reviewNote && (
          <div style={{ background: 'rgba(255,59,48,0.06)', borderRadius: '10px', padding: '12px 14px', marginTop: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' }}>
              Review Note {request.reviewedBy && `(by ${request.reviewedBy})`}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text)' }}>{request.reviewNote}</div>
          </div>
        )}
      </div>
    </div>
  );
}
