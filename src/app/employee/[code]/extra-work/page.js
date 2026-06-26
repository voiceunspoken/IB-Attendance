"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../components/AuthProvider';
import { useEmployeeData } from '../context';
import { submitExtraWork, getExtraWorkRequests } from '../../../../actions/extraWork';

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

export default function ExtraWorkPage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const { emp, leaveBalance, triggerRefetch } = useEmployeeData();
  const router = useRouter();

  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ date: '', hours: '', reason: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}/dashboard`);
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!code) return;
    getExtraWorkRequests(code).then(setRequests).catch(() => setRequests([]));
  }, [code, triggerRefetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.date) return setError('Please select a date.');
    if (!form.hours || parseFloat(form.hours) <= 0) return setError('Please enter hours worked.');
    if (!form.reason.trim()) return setError('Please provide a reason.');
    setSubmitting(true);
    const result = await submitExtraWork(code, {
      date: form.date,
      hours: parseFloat(form.hours),
      reason: form.reason.trim(),
    });
    setSubmitting(false);
    if (result.error) return setError(result.error);
    setSuccess('Extra work request submitted.');
    setForm({ date: '', hours: '', reason: '' });
    triggerRefetch();
    getExtraWorkRequests(code).then(setRequests).catch(() => setRequests([]));
  };

  const StatusBadge = ({ status }) => {
    const s = STATUS_COLORS[status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: status };
    return <span style={{ padding: '2px 8px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  if (!emp) return null;

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>Request Extra Working Leave</div>

        {leaveBalance && (
          <div style={{ background: 'rgba(175,82,222,0.08)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px' }}>
            <span style={{ fontWeight: 700, color: '#7b2d8b' }}>EWL Balance:</span>{' '}
            {leaveBalance.ewlRemaining ?? 0} / {leaveBalance.ewlTotal ?? 0} remaining
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Date</label>
            <input className="input-field" type="date" min={today} value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Hours Worked</label>
            <input className="input-field" type="number" min={0.5} max={24} step={0.5} placeholder="e.g. 8"
              value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Reason</label>
            <textarea className="input-field" placeholder="Why did you work extra?"
              value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              style={{ minHeight: '80px', resize: 'vertical' }} />
          </div>
          {error && <div style={{ fontSize: '13px', color: 'var(--red)', background: 'rgba(255,59,48,0.06)', borderRadius: '8px', padding: '8px 12px' }}>{error}</div>}
          {success && <div style={{ fontSize: '13px', color: 'var(--green)', background: 'rgba(52,199,89,0.06)', borderRadius: '8px', padding: '8px 12px' }}>{success}</div>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="card-header">
          <span>Extra Work Requests</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', background: 'var(--surface3)', padding: '1px 8px', borderRadius: '980px', marginLeft: '8px' }}>
            {requests.length}
          </span>
        </div>
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {requests.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
              No extra work requests yet.
            </div>
          ) : requests.map(r => (
            <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 500 }}>{r.hours}h</span>
                <StatusBadge status={r.status} />
                {r.status === 'pending' && r.approvalStage !== 'approved' && (
                  <span style={{ fontSize: '10px', color: 'var(--text3)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: '4px' }}>
                    {STAGE_LABELS[r.approvalStage] || r.approvalStage}
                  </span>
                )}
                {r.adminDecision && (
                  <span style={{ fontSize: '10px', color: '#7b2d8b', background: 'rgba(175,82,222,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                    {r.adminDecision === 'half' ? 'Half Day' : 'Full Day'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                {r.reason}
                {(r.mgrReviewNote || r.reviewNote) && (
                  <span style={{ color: 'var(--text3)', fontStyle: 'italic', display: 'block', marginTop: '4px' }}>
                    Note: {r.reviewNote || r.mgrReviewNote}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
