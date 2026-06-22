"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../components/AuthProvider';
import { getRegularizations, submitRegularization } from '../../../../actions/leave';
import { useEmployeeData } from '../context';

export default function RegularizePage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const { emp, triggerRefetch } = useEmployeeData();
  const router = useRouter();

  const [regularizations, setRegularizations] = useState([]);
  const [regForm, setRegForm] = useState({ date: '', requestedIn: '', requestedOut: '', reason: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!code) return;
    getRegularizations(code).then(setRegularizations).catch(() => setRegularizations([]));
  }, [code, triggerRefetch]);

  const statusBadge = (status) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'Pending' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' }
    };
    const s = map[status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: status.charAt(0).toUpperCase() + status.slice(1) };
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const handleSubmitReg = async (e) => {
    e.preventDefault();
    setRegError(''); setRegSuccess('');
    if (!regForm.date) return setRegError('Please select a date.');
    if (!regForm.reason.trim()) return setRegError('Please provide a reason.');
    setSubmittingReg(true);
    const result = await submitRegularization(code, regForm);
    setSubmittingReg(false);
    if (result.error) return setRegError(result.error);
    setRegSuccess('Regularization request submitted.');
    setRegForm({ date: '', requestedIn: '', requestedOut: '', reason: '' });
    triggerRefetch();
  };

  if (!emp) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>Regularization Request</div>
        <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>Missed a punch-in or punch-out? Request a correction here.</div>
        <form onSubmit={handleSubmitReg} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Date</label>
            <input className="input-field" type="date" value={regForm.date} onChange={e => setRegForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="input-label">Punch In (HH:MM)</label>
              <input className="input-field" type="time" value={regForm.requestedIn} onChange={e => setRegForm(f => ({ ...f, requestedIn: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Punch Out (HH:MM)</label>
              <input className="input-field" type="time" value={regForm.requestedOut} onChange={e => setRegForm(f => ({ ...f, requestedOut: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="input-label">Reason</label>
            <textarea className="input-field" rows={3} placeholder="Why was the punch missed?" value={regForm.reason} onChange={e => setRegForm(f => ({ ...f, reason: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
          {regError && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{regError}</div>}
          {regSuccess && <div style={{ color: 'var(--green)', fontSize: '13px' }}>{regSuccess}</div>}
          <button type="submit" className="btn btn-primary" disabled={submittingReg} style={{ opacity: submittingReg ? 0.7 : 1 }}>
            {submittingReg ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
          My Regularizations ({regularizations.length})
        </div>
        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
          {regularizations.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No requests yet.</div>
            : regularizations.map(r => (
              <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  {statusBadge(r.status)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                  {r.requestedIn && `In: ${r.requestedIn}`}{r.requestedIn && r.requestedOut && ' · '}{r.requestedOut && `Out: ${r.requestedOut}`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{r.reason}</div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
