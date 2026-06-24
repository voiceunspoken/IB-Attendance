"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { getRegularizationById, reviewRegularization } from '../../../actions/leave';
import { useToast } from '../../../components/Toast';
import { FiArrowLeft, FiCalendar, FiClock, FiAlertTriangle, FiCheck, FiX, FiUser } from 'react-icons/fi';

export default function RegularizationDetailPage({ params }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();
  const toast = useToast();

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    getRegularizationById(id).then(data => {
      if (!data) { setNotFound(true); } else { setReq(data); }
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [id, isAuthenticated]);

  const handleReview = async (approve) => {
    setSubmitting(true);
    const result = await reviewRegularization(id, user.username, approve, reviewNote);
    setSubmitting(false);
    if (result?.error) return toast.error(result.error);
    toast.success(approve ? 'Regularization approved.' : 'Regularization rejected.');
    const data = await getRegularizationById(id);
    if (data) setReq(data);
  };

  if (authLoading || loading) return (
    <div className="page-wrapper animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>
    </div>
  );

  if (notFound) return (
    <div className="page-wrapper animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
      <div style={{ fontSize: '36px', opacity: 0.25 }}><FiAlertTriangle size={36} /></div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text2)' }}>Regularization request not found</div>
      <button className="btn btn-primary" onClick={() => router.push('/leaves')} style={{ marginTop: '8px' }}>
        <FiArrowLeft size={14} /> Back
      </button>
    </div>
  );

  if (!req) return null;

  const isPending = req.status === 'pending';
  const isSuperPending = isPending && req.superStatus === 'pending';
  const canAdminReview = isAdmin && isPending && req.superStatus !== 'approved';
  const canSuperReview = isSuperAdmin && (req.superStatus === 'pending');

  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: '720px' }}>
      <button onClick={() => router.push('/leaves')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 500, color: 'var(--text2)', marginBottom: '16px', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}>
        <FiArrowLeft size={14} /> Back to Leaves
      </button>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,107,53,0.12)', display: 'grid', placeItems: 'center', color: '#ff6b35', fontSize: '16px', fontWeight: 700 }}>
              <FiClock size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.03em' }}>{req.user?.name || 'Unknown'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '1px' }}>#{req.user?.code}</div>
            </div>
            <span style={{ padding: '3px 12px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: isPending ? 'rgba(255,159,10,0.1)' : req.status === 'approved' ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)', color: isPending ? '#b36200' : req.status === 'approved' ? '#1a7f37' : '#c0392b' }}>
              {isPending ? 'Pending' : req.status === 'approved' ? 'Approved' : 'Rejected'}
            </span>
          </div>
          {req.user?.department && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', display: 'flex', gap: '12px', marginTop: '4px' }}>
              <span>{req.user.department.name}{req.user.designation?.name ? ` · ${req.user.designation.name}` : ''}</span>
              <span>·</span>
              <span style={{ textTransform: 'capitalize' }}>{req.user.employeeType || 'Regular'}</span>
            </div>
          )}
        </div>

        <div style={{ padding: '20px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FiCalendar size={11} /> Date
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {new Date(req.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FiClock size={11} /> Requested Times
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {req.requestedIn && `In: ${req.requestedIn}`}{req.requestedIn && req.requestedOut && ' · '}{req.requestedOut && `Out: ${req.requestedOut}`}
                {!req.requestedIn && !req.requestedOut && <span style={{ color: 'var(--text3)' }}>N/A</span>}
              </div>
            </div>
            <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Type
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, textTransform: 'capitalize' }}>
                {req.type?.replace(/_/g, ' ') || 'Missing Punch'}
              </div>
            </div>
            <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FiClock size={11} /> Submitted
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text2)', marginBottom: '16px', padding: '14px 16px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>Reason:</span> {req.reason || 'No reason provided'}
          </div>

          {req.status === 'rejected' && req.reviewNote && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,59,48,0.05)', border: '1px solid rgba(255,59,48,0.15)', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red)', marginBottom: '4px' }}>Rejection Note</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{req.reviewNote}</div>
            </div>
          )}

          {req.status === 'approved' && req.superStatus === 'approved' && req.reviewNote && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(52,199,89,0.05)', border: '1px solid rgba(52,199,89,0.15)', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', marginBottom: '4px' }}>Review Note</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{req.reviewNote}</div>
            </div>
          )}

          {(canAdminReview || canSuperReview) && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>
                {canSuperReview ? 'Your Final Review' : 'Your Review'}
              </div>
              <input className="input-field" placeholder="Add a note (optional)…"
                value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '14px', background: 'var(--green)', border: 'none', borderRadius: '10px', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  disabled={submitting} onClick={() => handleReview(true)}>
                  {submitting ? 'Submitting…' : <><FiCheck size={16} /> {canSuperReview ? 'Final Approve' : 'Approve'}</>}
                </button>
                <button style={{ flex: 1, padding: '12px', fontSize: '14px', borderRadius: '10px', border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.08)', color: 'var(--red)', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  disabled={submitting} onClick={() => handleReview(false)}>
                  <FiX size={16} /> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
