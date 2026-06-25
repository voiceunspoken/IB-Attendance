"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { getDeductionById, reviewLeaveDeduction } from '../../../actions/leave';
import { useToast } from '../../../components/Toast';
import { FiArrowLeft, FiCalendar, FiClock, FiAlertTriangle, FiCheck, FiX } from 'react-icons/fi';

const LEAVE_LABELS = { cl: 'Casual Leave', sl: 'Sick Leave', el: 'Earned Leave', rl: 'Restricted Leave', sh: 'Short Leave', ul: 'Unpaid Leave' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b', ul: '#8e8e93' };

export default function DeductionDetailPage({ params }) {
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();
  const toast = useToast();

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    getDeductionById(id).then(data => {
      if (!data) { setNotFound(true); } else { setReq(data); }
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [id, isAuthenticated]);

  const handleReview = async (approve) => {
    setSubmitting(true);
    const result = await reviewLeaveDeduction(id, user.username, approve);
    setSubmitting(false);
    if (result?.error) return toast.error(result.error);
    toast.success(approve ? 'Leave deduction approved.' : 'Leave deduction rejected.');
    const data = await getDeductionById(id);
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
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text2)' }}>Leave deduction request not found</div>
      <button className="btn btn-primary" onClick={() => router.back()} style={{ marginTop: '8px' }}>
        <FiArrowLeft size={14} /> Go Back
      </button>
    </div>
  );

  if (!req) return null;

  const p = req.payload;
  const canReview = isSuperAdmin && req.status === 'pending';
  const lColor = LEAVE_COLORS[p.leaveType] || 'var(--text2)';
  const statusColor = req.status === 'approved' ? '#34c759' : req.status === 'rejected' ? '#ff3b30' : '#ff9f0a';
  const statusLabel = req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending';

  return (
    <div className="page-wrapper animate-fade-in" style={{ maxWidth: '640px' }}>
      <button onClick={() => router.back()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: 500, color: 'var(--text2)', marginBottom: '16px', transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}>
        <FiArrowLeft size={14} /> Back
      </button>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: lColor + '14', display: 'grid', placeItems: 'center', color: lColor, fontSize: '16px', fontWeight: 700 }}>
              {p.leaveType?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.03em' }}>{p.employeeName || p.employeeCode}</div>
              {p.employeeCode && <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '1px' }}>#{p.employeeCode}</div>}
            </div>
            <span style={{ padding: '3px 12px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: statusColor + '18', color: statusColor }}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div style={{ padding: '20px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FiCalendar size={11} /> Leave Type
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: lColor }}>{LEAVE_LABELS[p.leaveType] || p.leaveType?.toUpperCase()}</div>
            </div>
            <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FiClock size={11} /> Days
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{p.days} day{p.days !== 1 ? 's' : ''}</div>
            </div>
            <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FiClock size={11} /> Requested by
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{req.requestedBy}</div>
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

          {p.reason && (
            <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text2)', marginBottom: '16px', padding: '14px 16px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Reason:</span> {p.reason}
            </div>
          )}

          {req.reviewNote && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: req.status === 'rejected' ? 'rgba(255,59,48,0.05)' : 'rgba(52,199,89,0.05)', border: req.status === 'rejected' ? '1px solid rgba(255,59,48,0.15)' : '1px solid rgba(52,199,89,0.15)', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: req.status === 'rejected' ? 'var(--red)' : 'var(--green)', marginBottom: '4px' }}>
                {req.status === 'rejected' ? 'Rejection Note' : 'Review Note'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{req.reviewNote}</div>
            </div>
          )}

          {canReview && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Your Review</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '14px', background: 'var(--green)', border: 'none', borderRadius: '10px', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  disabled={submitting} onClick={() => handleReview(true)}>
                  {submitting ? 'Submitting…' : <><FiCheck size={16} /> Approve</>}
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
