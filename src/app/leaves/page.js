"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/Toast';
import { FiClipboard } from 'react-icons/fi';
import {
  getAllLeaveRequests, reviewLeaveRequest,
  getAllPendingRegularizations, reviewRegularization,
  getPendingSuperRegularizations, reviewRegularizationSuper,
  getAllLeaveBalances, upsertLeavePolicy, getLeavePolicy,
  getLeaveBalancesForExport, getManagerLeaveRequests
} from '../../actions/leave';
import { getPendingAttendanceCorrections, reviewAttendanceCorrection } from '../../actions/attendanceChanges';
import { getManagedEmployees } from '../../actions/departments';

const LEAVE_LABELS = { cl: 'CL', sl: 'SL', el: 'EL', rl: 'RL', sh: 'SH' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b' };

export default function LeavesPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState('manager_approval');

  // Switch to overview for admins after mount
  useEffect(() => {
    if (isAdmin && tab === 'manager_approval') setTab('overview');
  }, [isAdmin, tab]);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [managerLeaves, setManagerLeaves] = useState([]);
  const [regularizations, setRegularizations] = useState([]);
  const [superRegularizations, setSuperRegularizations] = useState([]);
  const [attendanceCorrections, setAttendanceCorrections] = useState([]);
  const [balances, setBalances] = useState([]);
  const [balancePage, setBalancePage] = useState(1);
  const balancePageSize = 20;
  const paginatedBalances = balances.slice((balancePage - 1) * balancePageSize, balancePage * balancePageSize);
  const totalBalancePages = Math.ceil(balances.length / balancePageSize);
  const [policy, setPolicy] = useState({ cl: 12, sl: 6, el: 4, rl: 2, sh: 6 });
  const [loading, setLoading] = useState(true);
  const [managerLoading, setManagerLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const year = new Date().getFullYear();

  // Export range state
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportFrom, setExportFrom] = useState(1);
  const [exportTo, setExportTo] = useState(new Date().getMonth() + 1);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

  const exportLeaveBalances = async () => {
    if (exportFrom > exportTo) return toast.error('From month cannot be after To month.');
    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const data = await getLeaveBalancesForExport(exportYear, exportFrom, exportTo);

      const rangeLabel = exportFrom === exportTo
        ? `${MONTHS[exportFrom - 1]} ${exportYear}`
        : `${MONTHS[exportFrom - 1]}–${MONTHS[exportTo - 1]} ${exportYear}`;

      const rows = data.map(({ code, name, balance, rangeUsed, leaveDetail }) => ({
        'Emp Code': code,
        'Employee Name': name,
        'CL Total': balance?.clTotal ?? 0,
        'CL Used (Period)': rangeUsed.cl,
        'CL Remaining': balance?.clAvail ?? 0,
        'SL Total': balance?.slTotal ?? 0,
        'SL Used (Period)': rangeUsed.sl,
        'SL Remaining': balance?.slAvail ?? 0,
        'EL Total': balance?.elTotal ?? 0,
        'EL Used (Period)': rangeUsed.el,
        'EL Remaining': balance?.elAvail ?? 0,
        'RL Total': balance?.rlTotal ?? 0,
        'RL Used (Period)': rangeUsed.rl,
        'RL Remaining': balance?.rlAvail ?? 0,
        'SH Total': balance?.shTotal ?? 0,
        'SH Used (Period)': rangeUsed.sh,
        'SH Remaining': balance?.shAvail ?? 0,
        'Leave Details': leaveDetail,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 10 }, { wch: 24 },
        { wch: 9 }, { wch: 16 }, { wch: 13 },
        { wch: 9 }, { wch: 16 }, { wch: 13 },
        { wch: 9 }, { wch: 16 }, { wch: 13 },
        { wch: 9 }, { wch: 16 }, { wch: 13 },
        { wch: 9 }, { wch: 16 }, { wch: 13 },
        { wch: 52 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, rangeLabel);
      XLSX.writeFile(wb, `Leave_Balances_${rangeLabel.replace(/[–\s]/g, '_')}.xlsx`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (isAdmin) return;
    (async () => {
      try {
        const [mgrEmps, leaves] = await Promise.all([
          getManagedEmployees(user?.code),
          getManagerLeaveRequests(user?.code)
        ]);
        setManagerLeaves(leaves || []);
        setManagerLoading(false);
        if (!mgrEmps || mgrEmps.length === 0) router.push('/');
      } catch {
        setManagerLoading(false);
        router.push('/');
      }
    })();
  }, [isAuthenticated, isAdmin, authLoading, user?.code, router, fetchTrigger]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!isSuperAdmin && tab === 'corrections') setTab('requests');
    setLoading(true);
    (async () => {
      try {
        const [reqs, regs, bal, pol, mgrLeaves] = await Promise.all([
          getAllLeaveRequests(),
          getAllPendingRegularizations(),
          getAllLeaveBalances(year),
          getLeavePolicy(year),
          user?.code ? getManagerLeaveRequests(user.code) : Promise.resolve([])
        ]);
        setLeaveRequests(reqs);
        setManagerLeaves(mgrLeaves);
        setRegularizations(regs);
        setBalances(bal);
        if (isSuperAdmin) {
          const supRegs = await getPendingSuperRegularizations();
          setSuperRegularizations(supRegs);
          const ac = await getPendingAttendanceCorrections();
          setAttendanceCorrections(ac);
        }
        if (pol) setPolicy({ cl: pol.cl, sl: pol.sl, el: pol.el, rl: pol.rl, sh: pol.sh ?? 6 });
      } catch {
        setLeaveRequests([]);
        setManagerLeaves([]);
        setRegularizations([]);
        setBalances([]);
        setSuperRegularizations([]);
        setAttendanceCorrections([]);
      } finally {
        setLoading(false);
        setManagerLoading(false);
      }
    })();
  }, [isAdmin, isSuperAdmin, year, tab, fetchTrigger, user?.code]);

  const handleReviewLeave = async (id, approve) => {
    await reviewLeaveRequest(id, user.username, approve, reviewNote);
    setReviewingId(null);
    setReviewNote('');
    setFetchTrigger(t => t + 1);
  };

  const handleReviewReg = async (id, approve) => {
    await reviewRegularization(id, user.username, approve);
    setFetchTrigger(t => t + 1);
  };

  const handleSuperReviewReg = async (id, approve) => {
    await reviewRegularizationSuper(id, user.username, approve);
    setFetchTrigger(t => t + 1);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    await upsertLeavePolicy(year, policy);
    toast.success('Policy saved for ' + year);
    setFetchTrigger(t => t + 1);
  };

  if (authLoading || !isAuthenticated) return null;
  if (!isAdmin && managerLoading) return null;
  if (!isAdmin && !managerLoading && !user?.code) return null;

  const statusBadge = (status) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b' }
    };
    const s = map[status] || map.pending;
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
  };

  const StageBadge = ({ stage }) => {
    const map = {
      pending_mgr: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'Pending' },
      pending_l2: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'L2 Pending' },
      pending_l1: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'L1 Pending' },
      pending_super: { bg: 'rgba(175,82,222,0.1)', color: '#7b2d8b', label: 'Super Pending' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
    };
    const s = map[stage] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: stage };
    return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <div className="page-wrapper animate-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Leave Management</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Review requests, manage balances and configure policy.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', width: 'fit-content', flexWrap: 'wrap' }}>
        {(!isAdmin ? [
          { key: 'manager_approval', label: `My Approvals${managerLeaves.length > 0 ? ` (${managerLeaves.length})` : ''}` },
        ] : [
          { key: 'overview', label: `All Requests (${leaveRequests.length})` },
          { key: 'manager_approval', label: `My Approvals${managerLeaves.length > 0 ? ` (${managerLeaves.length})` : ''}` },
          { key: 'regularize', label: `Regularizations${regularizations.length > 0 ? ` (${regularizations.length})` : ''}` },
          { key: 'corrections', label: `Attendance Corrections${attendanceCorrections.length > 0 ? ` (${attendanceCorrections.length})` : ''}` },
          { key: 'balances', label: 'Leave Balances' },
          { key: 'policy', label: 'Policy' },
        ]).filter(t => {
          if (t.key === 'corrections') return isSuperAdmin;
          return true;
        }).map(t => (
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

      {/* ── ALL REQUESTS (admin overview — read only) ── */}
      {!loading && tab === 'overview' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
            All Leave Requests ({leaveRequests.length})
          </div>
          {leaveRequests.length === 0
            ? <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25 }}><FiClipboard size={36} /></div>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: 'var(--text2)' }}>No leave requests yet</div>
                <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>Employees can apply for leave from their profile page.</div>
              </div>
            : leaveRequests.map(r => (
              <div key={r.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name || 'Unknown'}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                    {r.shiftSlot && <span style={{ fontSize: '11px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                    {statusBadge(r.status)}
                    <StageBadge stage={r.approvalStage} />
                  </div>
                  {r.sandwichCount > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--orange)', marginBottom: '2px', fontWeight: 500 }}>
                      🥪 {r.sandwichCount === 1 ? '1st sandwich' : `${r.sandwichCount} sandwich`} leave
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                    {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    {' · '}{r.reason}
                  </div>
                  {r.prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '2px' }}>📎 Prescription attached</div>}
                  {r.reviewNote && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px', fontStyle: 'italic' }}>Note: {r.reviewNote}</div>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── MY APPROVALS (manager + super admin) ── */}
      {!loading && tab === 'manager_approval' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              Pending Your Approval ({managerLeaves.length})
            </div>
            {managerLeaves.length === 0
              ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No leave requests awaiting your approval.</div>
              : managerLeaves.map(r => (
                <div key={r.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name || 'Unknown'}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                      {r.shiftSlot && <span style={{ fontSize: '11px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                      <StageBadge stage={r.approvalStage} />
                    </div>
                    {r.sandwichCount > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--orange)', marginBottom: '2px', fontWeight: 500 }}>
                        🥪 {r.sandwichCount === 1 ? '1st sandwich' : `${r.sandwichCount} sandwich`} leave
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      {' · '}{r.reason}
                    </div>
                    {r.prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '2px' }}>📎 Prescription attached</div>}
                  </div>
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
                </div>
              ))
            }
          </div>

          {/* Super admin also sees pending_super leaves here */}
          {isSuperAdmin && (
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
                Pending Super Admin Approval
              </div>
              {leaveRequests.filter(r => r.approvalStage === 'pending_super' && r.status === 'pending').length === 0
                ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No leave requests awaiting super admin approval.</div>
                : leaveRequests.filter(r => r.approvalStage === 'pending_super' && r.status === 'pending').map(r => (
                  <div key={r.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                        {r.shiftSlot && <span style={{ fontSize: '11px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                        <StageBadge stage={r.approvalStage} />
                      </div>
                      {r.sandwichCount > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--orange)', marginBottom: '2px', fontWeight: 500 }}>
                          🥪 {r.sandwichCount === 1 ? '1st sandwich' : `${r.sandwichCount} sandwich`} leave
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        {' · '}{r.reason}
                      </div>
                      {r.prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '2px' }}>📎 Prescription attached</div>}
                    </div>
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
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ── REGULARIZATIONS ── */}
      {!loading && tab === 'regularize' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Admin review */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              Pending Admin Review ({regularizations.length})
            </div>
            {regularizations.length === 0
              ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No pending regularizations.</div>
              : regularizations.map(r => (
                <div key={r.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user.code}</span>
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

          {/* Super admin final approval */}
          {isSuperAdmin && (
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
                Pending Super Admin Approval ({superRegularizations.length})
              </div>
              {superRegularizations.length === 0
                ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No regularizations awaiting final approval.</div>
                : superRegularizations.map(r => (
                  <div key={r.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user.code}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        {r.requestedIn && `In: ${r.requestedIn}`}{r.requestedIn && r.requestedOut && ' · '}{r.requestedOut && `Out: ${r.requestedOut}`}
                        {' · '}{r.reason}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }} onClick={() => handleSuperReviewReg(r.id, true)}>Final Approve</button>
                      <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }} onClick={() => handleSuperReviewReg(r.id, false)}>Reject</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE CORRECTIONS (super admin) ── */}
      {!loading && tab === 'corrections' && isSuperAdmin && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
            Pending Attendance Corrections ({attendanceCorrections.length})
          </div>
          {attendanceCorrections.length === 0
            ? <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No pending corrections.</div>
            : attendanceCorrections.map(c => {
                const p = JSON.parse(c.payload);
                return (
                  <div key={c.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{p.employeeCode}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>Day {p.day} · {p.monthYear}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        {p.currentType} → <strong style={{ color: 'var(--blue)' }}>{p.newType}</strong>
                        {' · '}{p.reason}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                        Requested by {c.requestedBy} · {new Date(c.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }}
                        onClick={async () => { await reviewAttendanceCorrection(c.id, user.username, true); const ac = await getPendingAttendanceCorrections(); setAttendanceCorrections(ac); }}>
                        Approve
                      </button>
                      <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                        onClick={async () => { await reviewAttendanceCorrection(c.id, user.username, false); const ac = await getPendingAttendanceCorrections(); setAttendanceCorrections(ac); }}>
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ── LEAVE BALANCES ── */}
      {!loading && tab === 'balances' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>

          {/* Header with range picker */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>
              Leave Balances
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text2)', marginLeft: '8px' }}>
                {balances.length} employees
              </span>
            </div>

            {/* Range picker + export */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', fontWeight: 500 }}>Year</span>
              <select className="input-field" value={exportYear} onChange={e => setExportYear(Number(e.target.value))}
                style={{ width: '90px', padding: '6px 10px', fontSize: 'var(--fs-sm)' }}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>

              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', fontWeight: 500 }}>From</span>
              <select className="input-field" value={exportFrom} onChange={e => setExportFrom(Number(e.target.value))}
                style={{ width: '90px', padding: '6px 10px', fontSize: 'var(--fs-sm)' }}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>

              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', fontWeight: 500 }}>To</span>
              <select className="input-field" value={exportTo} onChange={e => setExportTo(Number(e.target.value))}
                style={{ width: '90px', padding: '6px 10px', fontSize: 'var(--fs-sm)' }}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>

              <button className="btn btn-primary" onClick={exportLeaveBalances} disabled={exporting}
                style={{ padding: '7px 18px', fontSize: 'var(--fs-sm)', opacity: exporting ? 0.7 : 1 }}>
                {exporting ? 'Exporting…' : '⬇ Export Excel'}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Employee', 'CL Avail', 'SL Avail', 'EL Avail', 'RL Avail', 'SH Avail', 'CL Used', 'SL Used', 'EL Used', 'RL Used', 'SH Used'].map(h => (
                    <th key={h} style={{ background: 'var(--surface2)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedBalances.map(({ code, name, balance }) => balance && (
                  <tr key={code} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 500 }}>{name} <span style={{ color: 'var(--text3)', fontSize: '11px' }}>#{code}</span></td>
                    {['cl', 'sl', 'el', 'rl', 'sh'].map(t => (
                      <td key={t} style={{ padding: '11px 14px', color: (balance[`${t}Avail`] ?? 0) <= 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                        {balance[`${t}Avail`] ?? 0}
                      </td>
                    ))}
                    {['cl', 'sl', 'el', 'rl', 'sh'].map(t => (
                      <td key={t} style={{ padding: '11px 14px', color: 'var(--text2)' }}>
                        {balance[`${t}Used`] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
            {totalBalancePages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                <button disabled={balancePage <= 1} onClick={() => setBalancePage(p => Math.max(1, p - 1))}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: balancePage <= 1 ? 'var(--text3)' : 'var(--text)', cursor: balancePage <= 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>Prev</button>
                {Array.from({ length: Math.min(totalBalancePages, 10) }, (_, i) => {
                  const start = Math.max(1, Math.min(balancePage - 5, totalBalancePages - 9));
                  return start + i;
                }).map(p => (
                  <button key={p} onClick={() => setBalancePage(p)}
                    style={{ padding: '4px 10px', borderRadius: '6px', border: p === balancePage ? '1px solid var(--blue)' : '1px solid var(--border)', background: p === balancePage ? 'rgba(0,113,227,0.1)' : 'transparent', color: p === balancePage ? 'var(--blue)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px', fontWeight: p === balancePage ? 600 : 400 }}>{p}</button>
                ))}
                <button disabled={balancePage >= totalBalancePages} onClick={() => setBalancePage(p => Math.min(totalBalancePages, p + 1))}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: balancePage >= totalBalancePages ? 'var(--text3)' : 'var(--text)', cursor: balancePage >= totalBalancePages ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>Next</button>
              </div>
            )}
          </div>
        )}

      {/* ── POLICY ── */}
      {!loading && tab === 'policy' && (
        <div className="card" style={{ padding: '24px', maxWidth: '480px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>Leave Policy — {year}</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>Annual leave quotas per IB HR Policy. Applied to all confirmed employees.</div>
          <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'cl', label: 'Casual Leave (CL)', hint: '12 days/yr · 1 per month · post confirmation' },
              { key: 'sl', label: 'Sick Leave (SL)', hint: '6 days/yr · medical cert required >1 day' },
              { key: 'el', label: 'Earned Leave (EL)', hint: '4 days/yr · quarterly after 1 yr service' },
              { key: 'rl', label: 'Restricted Holiday (RH)', hint: '2 days/yr · 1 per month · 1 month advance notice' },
              { key: 'sh', label: 'Short Leave (SH)', hint: '6/yr · 2 hrs each · 1 per 2-month window' },
            ].map(({ key, label, hint }) => (
              <div key={key}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{hint}</div>
                  </div>
                  <input type="number" min={0} max={60} className="input-field" style={{ width: '80px', padding: '8px 12px', textAlign: 'center' }}
                    value={policy[key]} onChange={e => setPolicy(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
            ))}
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: 'var(--text2)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>Shift:</strong> 10:00 AM – 7:00 PM · Late after 10:15 AM · Min 9 hrs · 3 lates = 1 HD · 3 short shifts = 1 HD
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>Save Policy</button>
          </form>
        </div>
      )}
    </div>
  );
}
