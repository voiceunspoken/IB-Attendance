"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { getLeaveRequestById, reviewLeaveRequest, cancelLeaveRequest } from '../../../actions/leave';
import { useToast } from '../../../components/Toast';
import { FiArrowLeft, FiCalendar, FiClock, FiAlertTriangle, FiCheck, FiX, FiUser } from 'react-icons/fi';

const LEAVE_LABELS = { cl: 'CL', sl: 'SL', el: 'EL', rl: 'RL', sh: 'SH' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b' };
const STAGE_CONFIG = {
  pending_mgr: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'With Manager' },
  pending_l2: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'With Manager' },
  pending_l1: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'With Manager' },
  pending_super: { bg: 'rgba(175,82,222,0.1)', color: '#7b2d8b', label: 'Awaiting Super Admin' },
  approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
  rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
  cancelled: { bg: 'rgba(142,142,147,0.1)', color: '#8e8e93', label: 'Cancelled' },
};

export default function LeaveDetailPage({ params }) {
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
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    getLeaveRequestById(id).then(data => {
      if (!data) { setNotFound(true); } else { setReq(data); }
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [id, isAuthenticated]);

  const handleReview = async (approve) => {
    setSubmitting(true);
    const result = await reviewLeaveRequest(id, user.username, approve, reviewNote);
    setSubmitting(false);
    if (result?.error) return toast.error(result.error);
    toast.success(approve ? 'Leave approved successfully.' : 'Leave rejected.');
    const data = await getLeaveRequestById(id);
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
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text2)' }}>Leave request not found</div>
      <button className="btn btn-primary" onClick={() => router.push('/leaves')} style={{ marginTop: '8px' }}>
        <FiArrowLeft size={14} /> Back to Leaves
      </button>
    </div>
  );

  if (!req) return null;

      const canReview = (isAdmin || isSuperAdmin) && req.status === 'pending';
  const canCancel = req.status === 'approved' && new Date(req.fromDate) > new Date() && (isAdmin || isSuperAdmin || user?.id === req.userId);
  const stageCfg = STAGE_CONFIG[req.approvalStage] || { bg: 'var(--surface2)', color: 'var(--text2)', label: req.approvalStage };
  const leaveColor = LEAVE_COLORS[req.leaveType] || 'var(--text2)';
  const leaveLabel = LEAVE_LABELS[req.leaveType] || req.leaveType.toUpperCase();

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
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: leaveColor + '14', display: 'grid', placeItems: 'center', color: leaveColor, fontSize: '16px', fontWeight: 700 }}>
              {leaveLabel}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.03em' }}>{req.user?.name || 'Unknown'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '1px' }}>#{req.user?.code}</div>
            </div>
            <span style={{ padding: '3px 12px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: stageCfg.bg, color: stageCfg.color }}>
              {stageCfg.label}
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
                <FiCalendar size={11} /> Duration
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {new Date(req.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {req.fromDate !== req.toDate && <> – {new Date(req.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
              </div>
            </div>
            <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FiClock size={11} /> Days
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>
                {req.days} day{req.days !== 1 ? 's' : ''}
                {req.unpaidDays > 0 && <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--orange)', marginLeft: '6px' }}>({req.unpaidDays} unpaid)</span>}
              </div>
            </div>
            {req.shiftSlot && (
              <div className="card" style={{ padding: '14px 16px', margin: 0, border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Shift Slot</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{req.shiftSlot}</div>
              </div>
            )}
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

          {req.sandwichCount > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--orange)', fontWeight: 500, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(255,159,10,0.06)', borderRadius: '8px' }}>
              <FiAlertTriangle size={14} />
              {req.sandwichCount === 1 ? '1st sandwich leave' : `${req.sandwichCount} sandwich leave`}
            </div>
          )}

          {req.prescriptionFile && (
            <div style={{ fontSize: '12px', color: 'var(--blue)', marginBottom: '14px', padding: '8px 12px', background: 'rgba(0,113,227,0.06)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCheck size={14} /> Prescription attached
            </div>
          )}

          {req.user?.managers && req.user.managers.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>Approval Progress</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {req.user.managers.map((m, i) => {
                  const isCurrent = req.currentApproverId === m.managerUserId && req.status === 'pending';
                  const isDone = req.approvalStage === 'approved' || (req.reviewedBy && i < req.user.managers.length - 1);
                  const isReject = req.status === 'rejected' && req.reviewedBy;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: isCurrent ? 'rgba(0,113,227,0.06)' : 'var(--surface2)', border: isCurrent ? '1.5px solid rgba(0,113,227,0.25)' : '1px solid var(--border)' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isReject ? 'rgba(255,59,48,0.1)' : isDone ? 'rgba(52,199,89,0.1)' : 'var(--surface3)', display: 'grid', placeItems: 'center', color: isReject ? '#ff3b30' : isDone ? '#34c759' : 'var(--text3)', flexShrink: 0 }}>
                        {isReject ? <FiX size={13} /> : isDone ? <FiCheck size={13} /> : <FiUser size={13} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.manager.name}</div>
                        <div style={{ fontSize: '11px', color: isCurrent ? 'var(--blue)' : 'var(--text3)' }}>
                          {isCurrent ? 'Pending your approval' : isDone ? 'Approved' : 'Pending'}
                        </div>
                      </div>
                      {isCurrent && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--blue)', padding: '2px 8px', borderRadius: '980px', background: 'rgba(0,113,227,0.1)' }}>You</span>}
                    </div>
                  );
                })}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: req.approvalStage === 'pending_super' && req.status === 'pending' ? 'rgba(175,82,222,0.06)' : 'var(--surface2)', border: req.approvalStage === 'pending_super' && req.status === 'pending' ? '1.5px solid rgba(175,82,222,0.25)' : '1px solid var(--border)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: req.approvalStage === 'approved' ? 'rgba(52,199,89,0.1)' : 'var(--surface3)', display: 'grid', placeItems: 'center', color: req.approvalStage === 'approved' ? '#34c759' : 'var(--text3)', flexShrink: 0 }}>
                    {req.approvalStage === 'approved' ? <FiCheck size={13} /> : <FiUser size={13} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>Super Admin</div>
                    <div style={{ fontSize: '11px', color: req.approvalStage === 'pending_super' && req.status === 'pending' ? '#af52de' : req.approvalStage === 'approved' ? '#34c759' : 'var(--text3)' }}>
                      {req.approvalStage === 'approved' ? 'Approved' : req.approvalStage === 'pending_super' && req.status === 'pending' ? 'Pending your approval' : 'Pending'}
                    </div>
                  </div>
                  {req.approvalStage === 'pending_super' && req.status === 'pending' && isSuperAdmin && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#af52de', padding: '2px 8px', borderRadius: '980px', background: 'rgba(175,82,222,0.1)' }}>You</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {req.status === 'rejected' && req.reviewNote && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,59,48,0.05)', border: '1px solid rgba(255,59,48,0.15)', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red)', marginBottom: '4px' }}>Rejection Note</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{req.reviewNote}</div>
            </div>
          )}

          {req.status === 'approved' && req.reviewNote && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(52,199,89,0.05)', border: '1px solid rgba(52,199,89,0.15)', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green)', marginBottom: '4px' }}>Review Note</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>{req.reviewNote}</div>
            </div>
          )}

          {canReview && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Your Review</div>
              <input className="input-field" placeholder="Add a note (optional)…"
                value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', fontSize: '13px', marginBottom: '12px', boxSizing: 'border-box' }} />
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

          {canCancel && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Cancel Leave</div>
              <button style={{ width: '100%', padding: '12px', fontSize: '14px', borderRadius: '10px', border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.08)', color: 'var(--red)', cursor: cancelling ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600, opacity: cancelling ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={cancelling} onClick={async () => {
                  if (!confirm('Cancel this approved leave?')) return;
                  setCancelling(true);
                  const result = await cancelLeaveRequest(req.id, user?.username);
                  setCancelling(false);
                  if (result.error) return toast.error(result.error);
                  toast.success('Leave cancelled.');
                  setReq(prev => prev ? { ...prev, status: 'cancelled', approvalStage: 'cancelled' } : prev);
                }}>
                <FiX size={16} /> {cancelling ? 'Cancelling…' : 'Cancel Leave'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
