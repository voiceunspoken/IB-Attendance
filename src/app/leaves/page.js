"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import {
  getAllLeaveRequests, getAllPendingLeaveRequests, reviewLeaveRequest,
  getAllPendingRegularizations, reviewRegularization,
  getAllLeaveBalances, upsertLeavePolicy, getLeavePolicy, adminUpdateLeaveBalance
} from '../../actions/leave';

const LEAVE_LABELS = { cl: 'CL', sl: 'SL', el: 'EL', rl: 'RL' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de' };

export default function LeavesPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState('requests');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [regularizations, setRegularizations] = useState([]);
  const [balances, setBalances] = useState([]);
  const [policy, setPolicy] = useState({ cl: 12, sl: 6, el: 15, rl: 2 });
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  const loadAll = async () => {
    setLoading(true);
    const [reqs, regs, bal, pol] = await Promise.all([
      getAllLeaveRequests(),
      getAllPendingRegularizations(),
      getAllLeaveBalances(year),
      getLeavePolicy(year)
    ]);
    setLeaveRequests(reqs);
    setRegularizations(regs);
    setBalances(bal);
    if (pol) setPolicy({ cl: pol.cl, sl: pol.sl, el: pol.el, rl: pol.rl });
    setLoading(false);
  };

  const handleReviewLeave = async (id, approve) => {
    await reviewLeaveRequest(id, user.username, approve, reviewNote);
    setReviewingId(null);
    setReviewNote('');
    loadAll();
  };

  const handleReviewReg = async (id, approve) => {
    await reviewRegularization(id, user.username, approve);
    loadAll();
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    await upsertLeavePolicy(year, policy);
    alert('Policy saved for ' + year);
  };

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const pending = leaveRequests.filter(r => r.status === 'pending');

  const statusBadge = (status) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b' }
    };
    const s = map[status] || map.pending;
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1100px', margin: '0 auto' }} className="animate-fade-in">
      <button className="btn btn-secondary" style={{ marginBottom: '20px' }} onClick={() => router.push('/')}>← Dashboard</button>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Leave Management</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Review requests, manage balances and configure policy.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', width: 'fit-content' }}>
        {[
          { key: 'requests', label: `Leave Requests${pending.length > 0 ? ` (${pending.length})` : ''}` },
          { key: 'regularize', label: `Regularizations${regularizations.length > 0 ? ` (${regularizations.length})` : ''}` },
          { key: 'balances', label: 'Leave Balances' },
          { key: 'policy', label: 'Policy' },
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

      {/* ── LEAVE REQUESTS ── */}
      {!loading && tab === 'requests' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
            All Requests ({leaveRequests.length})
          </div>
          {leaveRequests.length === 0
            ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No leave requests yet.</div>
            : leaveRequests.map(r => (
              <div key={r.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.employee.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.employee.code}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                    {statusBadge(r.status)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                    {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    {' · '}{r.reason}
                  </div>
                  {r.reviewNote && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px', fontStyle: 'italic' }}>Note: {r.reviewNote}</div>}
                </div>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                    {reviewingId === r.id ? (
                      <>
                        <input className="input-field" placeholder="Optional note…" value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)} style={{ padding: '6px 10px', fontSize: '12px' }} />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-primary" style={{ flex: 1, padding: '6px', fontSize: '12px', background: 'var(--green)' }} onClick={() => handleReviewLeave(r.id, true)}>Approve</button>
                          <button style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }} onClick={() => handleReviewLeave(r.id, false)}>Reject</button>
                        </div>
                        <button className="btn btn-secondary" style={{ padding: '5px', fontSize: '11px' }} onClick={() => setReviewingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => setReviewingId(r.id)}>Review</button>
                    )}
                  </div>
                )}
              </div>
            ))
          }
        </div>
      )}

      {/* ── REGULARIZATIONS ── */}
      {!loading && tab === 'regularize' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
            Pending Regularizations ({regularizations.length})
          </div>
          {regularizations.length === 0
            ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No pending regularizations.</div>
            : regularizations.map(r => (
              <div key={r.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.employee.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.employee.code}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                    {r.requestedIn && `In: ${r.requestedIn}`}{r.requestedIn && r.requestedOut && ' · '}{r.requestedOut && `Out: ${r.requestedOut}`}
                    {' · '}{r.reason}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }} onClick={() => handleReviewReg(r.id, true)}>Approve</button>
                  <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }} onClick={() => handleReviewReg(r.id, false)}>Reject</button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── LEAVE BALANCES ── */}
      {!loading && tab === 'balances' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
            Leave Balances — {year} ({balances.length} employees)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Employee', 'CL Avail', 'SL Avail', 'EL Avail', 'RL Avail', 'CL Used', 'SL Used', 'EL Used', 'RL Used'].map(h => (
                    <th key={h} style={{ background: 'var(--surface2)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {balances.map(({ code, name, balance }) => balance && (
                  <tr key={code} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 500 }}>{name} <span style={{ color: 'var(--text3)', fontSize: '11px' }}>#{code}</span></td>
                    {['cl', 'sl', 'el', 'rl'].map(t => (
                      <td key={t} style={{ padding: '11px 14px', color: (balance[`${t}Avail`] ?? 0) <= 1 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                        {balance[`${t}Avail`] ?? 0}
                      </td>
                    ))}
                    {['cl', 'sl', 'el', 'rl'].map(t => (
                      <td key={t} style={{ padding: '11px 14px', color: 'var(--text2)' }}>
                        {balance[`${t}Used`] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── POLICY ── */}
      {!loading && tab === 'policy' && (
        <div className="card" style={{ padding: '24px', maxWidth: '480px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>Leave Policy — {year}</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>Annual leave quotas applied to all employees.</div>
          <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'cl', label: 'Casual Leave (CL)' },
              { key: 'sl', label: 'Sick Leave (SL)' },
              { key: 'el', label: 'Earned Leave (EL)' },
              { key: 'rl', label: 'Restricted Leave (RL)' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{label}</label>
                <input type="number" min={0} max={60} className="input-field" style={{ width: '80px', padding: '8px 12px', textAlign: 'center' }}
                  value={policy[key]} onChange={e => setPolicy(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))} />
              </div>
            ))}
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Save Policy</button>
          </form>
        </div>
      )}
    </div>
  );
}
