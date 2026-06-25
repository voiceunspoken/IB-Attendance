"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/Toast';
import { FiAlertTriangle, FiCalendar, FiClock } from 'react-icons/fi';
import Modal from '../../components/Modal';
import {
  getAllLeaveRequests, reviewLeaveRequest,
  getAllPendingRegularizations, reviewRegularization,
  getPendingSuperRegularizations, reviewRegularizationSuper,
  getAllLeaveBalances, upsertLeavePolicy, getLeavePolicy,
  getLeaveBalancesForExport, getManagerLeaveRequests,
  adminUpdateLeaveBalance, getAllRegularizations,
  requestLeaveDeduction, reviewLeaveDeduction
} from '../../actions/leave';
import { getManagedEmployees } from '../../actions/departments';
import { getPendingChanges, getPendingChangesHistory, reviewAdminAction } from '../../actions/auth';
import { reviewAdjustment } from '../../actions/attendanceChanges';
import { getManagerWfhRequests, getAllWfhRequests, reviewWfhRequest, getWfhRequestsByStage } from '../../actions/wfh';

const LEAVE_LABELS = { cl: 'CL', sl: 'SL', el: 'EL', rl: 'RL', sh: 'SH' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b' };
const ATTENDANCE_TYPE_LABELS = {
  present: 'Present', absent: 'Absent', half: 'Half Day', holiday: 'Holiday', rl: 'Restricted Leave',
  wfh: 'WFH', wfm: 'WFM', wfo: 'WFO', wos: 'WOS',
};
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ADMIN_ACTION_LABELS = {
  create_user: 'Create Employee',
  delete_user: 'Delete Employee',
  update_user: 'Edit Employee (dept/designation/type/email)',
  toggle_user: 'Disable/Enable Employee',
  promote_user: 'Promote to Admin',
  upload_month: 'Upload Attendance CSV',
  delete_month: 'Delete Month Record',
  edit_month: 'Edit Month Record',
  edit_leave_balance: 'Edit Leave Balance',
  update_leave_policy: 'Save Leave Policy',
  manage_org: 'Manage Departments / Designations',
};
const formatMonthYear = (m) => {
  if (!m) return '';
  const [mo, yr] = m.split('_');
  return `${MONTH_NAMES[parseInt(mo) - 1] || mo} ${yr}`;
};

export default function LeavesPage() {
  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState(role === 'admin' || role === 'super_admin' ? 'overview' : 'manager_approval');

  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [managerLeaves, setManagerLeaves] = useState([]);
  const [regularizations, setRegularizations] = useState([]);
  const [superRegularizations, setSuperRegularizations] = useState([]);
  const [balances, setBalances] = useState([]);
  const [balancePage, setBalancePage] = useState(1);
  const balancePageSize = 20;
  const paginatedBalances = balances.slice((balancePage - 1) * balancePageSize, balancePage * balancePageSize);
  const totalBalancePages = Math.ceil(balances.length / balancePageSize);
  const [policy, setPolicy] = useState({ cl: 12, sl: 6, el: 4, rl: 2, sh: 6 });
  const [loading, setLoading] = useState(true);
  const [managerLoading, setManagerLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [pendingAdminActions, setPendingAdminActions] = useState([]);
  const [allRegularizations, setAllRegularizations] = useState([]);
  const [historyChanges, setHistoryChanges] = useState([]);
  const [collapsed, setCollapsed] = useState({ leaves: false, regs: false, adjustments: false, wfh: false });
  const [wfhRequests, setWfhRequests] = useState([]);
  const [managerWfhRequests, setManagerWfhRequests] = useState([]);
  const [superWfhRequests, setSuperWfhRequests] = useState([]);
  const [editBalanceTarget, setEditBalanceTarget] = useState(null);
  const [editBalanceForm, setEditBalanceForm] = useState({ clTotal: 0, slTotal: 0, elTotal: 0, rlTotal: 0, shTotal: 0 });
  const [deductModal, setDeductModal] = useState(false);
  const [deductForm, setDeductForm] = useState({ employeeCode: '', leaveType: 'cl', days: 1, reason: '' });
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
        'CL Remaining': balance?.clRemaining ?? 0,
        'SL Total': balance?.slTotal ?? 0,
        'SL Used (Period)': rangeUsed.sl,
        'SL Remaining': balance?.slRemaining ?? 0,
        'EL Total': balance?.elTotal ?? 0,
        'EL Used (Period)': rangeUsed.el,
        'EL Remaining': balance?.elRemaining ?? 0,
        'RL Total': balance?.rlTotal ?? 0,
        'RL Used (Period)': rangeUsed.rl,
        'RL Remaining': balance?.rlRemaining ?? 0,
        'SH Total': balance?.shTotal ?? 0,
        'SH Used (Period)': rangeUsed.sh,
        'SH Remaining': balance?.shRemaining ?? 0,
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

  const handleEditBalance = async (e) => {
    e.preventDefault();
    if (!editBalanceTarget) return;
    await adminUpdateLeaveBalance(editBalanceTarget.code, year, editBalanceForm, user?.username);
    toast.success('Leave balance updated for ' + editBalanceTarget.name);
    setEditBalanceTarget(null);
    setFetchTrigger(t => t + 1);
  };

  const openEditBalance = (entry) => {
    const b = entry.balance || {};
    setEditBalanceForm({
      clTotal: b.clTotal ?? 12,
      slTotal: b.slTotal ?? 6,
      elTotal: b.elTotal ?? 4,
      rlTotal: b.rlTotal ?? 2,
      shTotal: b.shTotal ?? 6,
    });
    setEditBalanceTarget(entry);
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (role === 'admin' || role === 'super_admin') return;
    (async () => {
      try {
        const [mgrEmps, leaves] = await Promise.all([
          getManagedEmployees(user?.code),
          getManagerLeaveRequests(user?.code)
        ]);
        setManagerLeaves(leaves || []);
        setManagerLoading(false);
        setLoading(false);
        if (!mgrEmps || mgrEmps.length === 0) router.push('/');
      } catch {
        setManagerLoading(false);
        setLoading(false);
        router.push('/');
      }
    })();
  }, [isAuthenticated, role, authLoading, user?.code, router, fetchTrigger]);

  useEffect(() => {
    if (role !== 'admin' && role !== 'super_admin') return;
    setLoading(true);
    (async () => {
      try {
        const [reqs, bal, pol, mgrLeaves, allWfh, mgrWfh, supWfh] = await Promise.all([
          getAllLeaveRequests(),
          getAllLeaveBalances(year),
          getLeavePolicy(year),
          user?.code ? getManagerLeaveRequests(user.code) : Promise.resolve([]),
          getAllWfhRequests(),
          user?.code ? getManagerWfhRequests(user.code) : Promise.resolve([]),
          getWfhRequestsByStage('pending_super'),
        ]);
        setLeaveRequests(reqs);
        setManagerLeaves(mgrLeaves);
        setRegularizations([]);
        setBalances(bal);
        setWfhRequests(allWfh);
        setManagerWfhRequests(mgrWfh);
        setSuperWfhRequests(supWfh);
        if (isSuperAdmin) {
          const [supRegs, pcs] = await Promise.all([
            getPendingSuperRegularizations(),
            getPendingChanges()
          ]);
          setSuperRegularizations(supRegs);
          setPendingChanges(pcs.filter(c => c.action === 'attendance_adjustment' || c.action === 'leave_deduction'));
          setPendingAdminActions(pcs.filter(c => c.action !== 'attendance_adjustment' && c.action !== 'leave_deduction' && c.action !== 'update_employee_name'));
        }
        if (role === 'admin') {
          const [regs, allRegs, allChanges] = await Promise.all([
            getAllPendingRegularizations(),
            getAllRegularizations(),
            getPendingChangesHistory()
          ]);
          setRegularizations(regs);
          setAllRegularizations(allRegs);
          setHistoryChanges(allChanges.filter(c => c.action === 'attendance_adjustment' || c.action === 'update_employee_name' || c.action === 'leave_deduction'));
        }
        if (pol) setPolicy({ cl: pol.cl, sl: pol.sl, el: pol.el, rl: pol.rl, sh: pol.sh ?? 6 });
      } catch {
        setLeaveRequests([]);
        setManagerLeaves([]);
        setRegularizations([]);
        setBalances([]);
        setSuperRegularizations([]);
        setPendingChanges([]);
        setWfhRequests([]);
        setManagerWfhRequests([]);
        setSuperWfhRequests([]);
      } finally {
        setLoading(false);
        setManagerLoading(false);
      }
    })();
  }, [role, isSuperAdmin, year, tab, fetchTrigger, user?.code]);

  const handleReviewLeave = async (id, approve) => {
    await reviewLeaveRequest(id, user.username, approve, reviewNote);
    setReviewModal(null);
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

  const handleReviewAdjustment = async (changeId, approve) => {
    await reviewAdjustment(changeId, user.username, approve);
    setFetchTrigger(t => t + 1);
  };

  const handleReviewDeduction = async (changeId, approve) => {
    await reviewLeaveDeduction(changeId, user.username, approve);
    toast.success(approve ? 'Deduction approved' : 'Deduction rejected');
    setFetchTrigger(t => t + 1);
  };

  const handleDeductLeave = async (e) => {
    e.preventDefault();
    if (!deductForm.employeeCode) return toast.error('Select an employee');
    if (deductForm.days < 1) return toast.error('Days must be at least 1');
    if (!deductForm.reason.trim()) return toast.error('Reason is required');
    const res = await requestLeaveDeduction(deductForm.employeeCode, deductForm.leaveType, deductForm.days, deductForm.reason, user.username);
    if (res.error) return toast.error(res.error);
    toast.success('Deduction request submitted for approval');
    setDeductModal(false);
    setDeductForm({ employeeCode: '', leaveType: 'cl', days: 1, reason: '' });
    setFetchTrigger(t => t + 1);
  };

  const handleReviewWfh = async (id, approve) => {
    await reviewWfhRequest(id, user.username, approve, reviewNote);
    setReviewModal(null);
    setReviewNote('');
    setFetchTrigger(t => t + 1);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    await upsertLeavePolicy(year, policy, user?.username);
    toast.success('Policy saved for ' + year);
    setFetchTrigger(t => t + 1);
  };

  if (authLoading || !isAuthenticated) return null;
  if (!isAdmin && !isSuperAdmin && managerLoading) return null;
  if (!isAdmin && !isSuperAdmin && !managerLoading && !user?.code) return null;

  const StageBadge = ({ stage, approverName, reviewerName }) => {
    const map = {
      pending_mgr: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
      pending_l2: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
      pending_l1: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
      pending_super: { bg: 'rgba(175,82,222,0.1)', color: '#7b2d8b', label: 'Awaiting Super Admin' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
      cancelled: { bg: 'rgba(142,142,147,0.1)', color: '#8e8e93', label: 'Cancelled' },
    };
    const s = map[stage] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)' };
    let label;
    if (stage === 'approved' && reviewerName) label = `Approved by ${reviewerName}`;
    else if (stage === 'rejected' && reviewerName) label = `Rejected by ${reviewerName}`;
    else if ((stage === 'pending_mgr' || stage === 'pending_l2' || stage === 'pending_l1') && approverName) label = `With ${approverName}`;
    else label = map[stage]?.label || stage?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || stage;
    return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, background: s.bg, color: s.color }}>{label}</span>;
  };

  const StatusBadge = ({ status }) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'Pending' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
      cancelled: { bg: 'rgba(142,142,147,0.1)', color: '#8e8e93', label: 'Cancelled' },
    };
    const s = map[status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: status.charAt(0).toUpperCase() + status.slice(1) };
    return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const WorkTypeBadge = ({ workType }) => {
    const map = { wfh: { bg: 'rgba(175,82,222,0.1)', color: '#af52de', label: 'WFH' }, wos: { bg: 'rgba(48,176,199,0.1)', color: '#30b0c7', label: 'WOS' }, wfm: { bg: 'rgba(52,199,89,0.1)', color: '#34c759', label: 'WFM' }, wfo: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'WFO' } };
    const s = map[workType] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: workType?.toUpperCase() || 'WFH' };
    return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <div className="page-wrapper animate-fade-in">
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Approvals</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Review requests, manage balances and configure policy.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', width: 'fit-content', flexWrap: 'wrap' }}>
        {(role === 'admin' ? [
          { key: 'overview', label: `Pending Approvals` },
          { key: 'regularize', label: `Regularizations${regularizations.length > 0 ? ` (${regularizations.length})` : ''}` },
          { key: 'wfh', label: `Work Mode${managerWfhRequests.length > 0 ? ` (${managerWfhRequests.length})` : ''}` },
          { key: 'history', label: 'History' },
          { key: 'balances', label: 'Leave Balances' },
          { key: 'policy', label: 'Policy' },
        ] : isSuperAdmin ? [
          { key: 'overview', label: `Pending Approvals` },
          { key: 'admin-actions', label: `Admin Actions${pendingAdminActions.length > 0 ? ` (${pendingAdminActions.length})` : ''}` },
          { key: 'regularize', label: `Regularizations${superRegularizations.length > 0 ? ` (${superRegularizations.length})` : ''}` },
          { key: 'wfh', label: `Work Mode${superWfhRequests.length > 0 ? ` (${superWfhRequests.length})` : ''}` },
          { key: 'history', label: 'History' },
          { key: 'balances', label: 'Leave Balances' },
          { key: 'policy', label: 'Policy' },
        ] : [
          { key: 'manager_approval', label: `My Approvals${managerLeaves.length > 0 ? ` (${managerLeaves.length})` : ''}` },
        ]).map(t => (
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

      {/* ── PENDING APPROVALS (unified overview) ── */}
      {!loading && tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Admin: Leave Approvals ── */}
          {role === 'admin' && (
            <div className="card overflow-hidden p-0">
              <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setCollapsed(c => ({ ...c, leaves: !c.leaves }))}>
                <span>Pending Leave Approvals</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: 'var(--surface3)', padding: '1px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, color: 'var(--text3)' }}>
                    {managerLeaves.length}
                  </span>
                  <span style={{ color: 'var(--text3)', fontSize: '10px', fontWeight: 500 }}>
                    {collapsed.leaves ? 'Show' : 'Hide'}
                  </span>
                </span>
              </div>
              {!collapsed.leaves && (
                managerLeaves.length === 0
                  ? <div className="p-32 text-center text-muted2 text-sm">No pending leave approvals.</div>
                  : <>
                      {/* Manager queue */}
                      {managerLeaves.length > 0 && (
                        <div style={{ padding: '8px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                          Awaiting Your Approval — {managerLeaves.length}
                        </div>
                      )}
                      {managerLeaves.map(r => (
                        <div key={r.id} className="p-14-20 border-bottom" style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                          onClick={() => { setReviewModal(r); setReviewNote(''); }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}>
                          <div className="flex-between items-start" style={{ gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name || 'Unknown'}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                                {r.shiftSlot && <span style={{ fontSize: '10px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 6px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                                <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                                {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                                {' · '}{r.reason}
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>Review →</div>
                          </div>
                        </div>
                      ))}
                    </>
              )}
            </div>
          )}

          {/* ── Super Admin: Super Queue ── */}
          {isSuperAdmin && leaveRequests.filter(r => r.approvalStage === 'pending_super' && r.status === 'pending').length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                Leave Approvals
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({leaveRequests.filter(r => r.approvalStage === 'pending_super' && r.status === 'pending').length})
                </span>
              </div>
              {leaveRequests.filter(r => r.approvalStage === 'pending_super' && r.status === 'pending').map(r => (
                <div key={r.id} className="p-14-20 border-bottom" style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => { setReviewModal(r); setReviewNote(''); }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div className="flex-between items-start" style={{ gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                        {r.shiftSlot && <span style={{ fontSize: '10px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 6px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                        <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                        {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        {' · '}{r.reason}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>Review →</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Admin: Regularizations ── */}
          {role === 'admin' && (
            <div className="card overflow-hidden p-0">
              <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setCollapsed(c => ({ ...c, regs: !c.regs }))}>
                <span>Pending Regularizations</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: 'var(--surface3)', padding: '1px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, color: 'var(--text3)' }}>
                    {regularizations.length}
                  </span>
                  <span style={{ color: 'var(--text3)', fontSize: '10px', fontWeight: 500 }}>
                    {collapsed.regs ? 'Show' : 'Hide'}
                  </span>
                </span>
              </div>
              {!collapsed.regs && (
                regularizations.length === 0
                  ? <div className="p-32 text-center text-muted2 text-sm">No pending regularizations.</div>
                  : <>
                      {regularizations.map(r => (
                        <div key={r.id} className="p-14-20 border-bottom flex-between" style={{ gap: '12px' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user.code}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                              {r.requestedIn && `In: ${r.requestedIn}`}{r.requestedIn && r.requestedOut && ' · '}{r.requestedOut && `Out: ${r.requestedOut}`}
                              {' · '}{r.reason}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--green)' }} onClick={() => handleReviewReg(r.id, true)}>Approve</button>
                            <button style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }} onClick={() => handleReviewReg(r.id, false)}>Reject</button>
                          </div>
                        </div>
                      ))}
                    </>
              )}
            </div>
          )}

          {/* ── Admin: Work Mode Requests ── */}
          {role === 'admin' && managerWfhRequests.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setCollapsed(c => ({ ...c, wfh: !c.wfh }))}>
                <span>Work Mode Requests</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: 'var(--surface3)', padding: '1px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, color: 'var(--text3)' }}>
                    {managerWfhRequests.length}
                  </span>
                  <span style={{ color: 'var(--text3)', fontSize: '10px', fontWeight: 500 }}>
                    {collapsed.wfh ? 'Show' : 'Hide'}
                  </span>
                </span>
              </div>
              {!collapsed.wfh && (
                managerWfhRequests.length === 0
                  ? <div className="p-32 text-center text-muted2 text-sm">No requests awaiting your approval.</div>
                  : managerWfhRequests.map(r => (
                    <div key={r.id} className="p-14-20 border-bottom flex-between" style={{ gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name || 'Unknown'}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                          <WorkTypeBadge workType={r.workType} />
                          <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                            {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{r.reason}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--green)' }}
                          onClick={() => handleReviewWfh(r.id, true)}>Approve</button>
                        <button style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                          onClick={() => handleReviewWfh(r.id, false)}>Reject</button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* ── Super Admin: Super Regularizations ── */}
          {isSuperAdmin && superRegularizations.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                Super Admin — Regularizations
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({superRegularizations.length})
                </span>
              </div>
              {superRegularizations.map(r => {
                let acPayload = {};
                const isAc = r.type === 'attendance_change';
                try { if (isAc) acPayload = JSON.parse(r.reason); } catch { /* */ }
                return (
                  <div key={r.id} className="p-14-20 border-bottom flex-between" style={{ gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user.code}</span>
                        {isAc ? (
                          <span style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 600, padding: '2px 8px', borderRadius: '980px', background: 'rgba(255,159,10,0.1)' }}>Attendance Change</span>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                        {isAc ? (
                          <>{ATTENDANCE_TYPE_LABELS[acPayload.currentType] || acPayload.currentType} → {ATTENDANCE_TYPE_LABELS[acPayload.newType] || acPayload.newType} · Day {acPayload.day} · {formatMonthYear(acPayload.monthYear)}{acPayload.reason ? ` · ${acPayload.reason}` : ''}</>
                        ) : (
                          <>{r.requestedIn && `In: ${r.requestedIn}`}{r.requestedIn && r.requestedOut && ' · '}{r.requestedOut && `Out: ${r.requestedOut}`} · {r.reason}</>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--green)' }} onClick={() => handleSuperReviewReg(r.id, true)}>Final Approve</button>
                      <button style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }} onClick={() => handleSuperReviewReg(r.id, false)}>Reject</button>
                    </div>
                  </div>
                );})}
            </div>
          )}

          {/* ── Super Admin: Work Mode Requests ── */}
          {isSuperAdmin && superWfhRequests.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setCollapsed(c => ({ ...c, wfh: !c.wfh }))}>
                <span>Work Mode Requests — Super Admin</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: 'var(--surface3)', padding: '1px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, color: 'var(--text3)' }}>
                    {superWfhRequests.length}
                  </span>
                  <span style={{ color: 'var(--text3)', fontSize: '10px', fontWeight: 500 }}>
                    {collapsed.wfh ? 'Show' : 'Hide'}
                  </span>
                </span>
              </div>
              {!collapsed.wfh && (
                superWfhRequests.length === 0
                  ? <div className="p-32 text-center text-muted2 text-sm">No requests awaiting super admin approval.</div>
                  : superWfhRequests.map(r => (
                    <div key={r.id} className="p-14-20 border-bottom flex-between" style={{ gap: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                          <WorkTypeBadge workType={r.workType} />
                          <span style={{ fontSize: '11px', color: 'var(--text2)' }}>
                            {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{r.reason}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--green)' }}
                          onClick={() => handleReviewWfh(r.id, true)}>Final Approve</button>
                        <button style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                          onClick={() => handleReviewWfh(r.id, false)}>Reject</button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* ── Section 3: Attendance Adjustments (super_admin only) ── */}
          {isSuperAdmin && (
            <div className="card overflow-hidden p-0">
              <div className="card-header" style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setCollapsed(c => ({ ...c, adjustments: !c.adjustments }))}>
                <span>Adjustments & Deductions</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: 'var(--surface3)', padding: '1px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, color: 'var(--text3)' }}>
                    {pendingChanges.length}
                  </span>
                  <span style={{ color: 'var(--text3)', fontSize: '10px', fontWeight: 500 }}>
                    {collapsed.adjustments ? 'Show' : 'Hide'}
                  </span>
                </span>
              </div>
              {!collapsed.adjustments && (
                pendingChanges.length === 0
                  ? <div className="p-32 text-center text-muted2 text-sm">No pending approvals.</div>
                  : pendingChanges.map(c => {
                      let payload = {};
                      try { payload = JSON.parse(c.payload); } catch { /* */ }
                      const isDeduction = c.action === 'leave_deduction';
                      return (
                        <div key={c.id} className="p-14-20 border-bottom flex-between" style={{ gap: '12px' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px' }}>{payload.employeeName || payload.employeeCode}</span>
                              {payload.employeeCode && <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{payload.employeeCode}</span>}
                              {isDeduction ? (
                                <>
                                  <span style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 600 }}>Leave Deduction</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{payload.days}d {LEAVE_LABELS[payload.leaveType] || payload.leaveType?.toUpperCase() || payload.leaveType}</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>Day {payload.day} · {formatMonthYear(payload.monthYear)}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{ATTENDANCE_TYPE_LABELS[payload.currentType] || payload.currentType} → {ATTENDANCE_TYPE_LABELS[payload.newType] || payload.newType}</span>
                                </>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                              <span style={{ color: 'var(--text3)' }}>by </span><strong>{c.requestedBy}</strong>
                              <span style={{ color: 'var(--text3)' }}> · {new Date(c.createdAt).toLocaleString()}</span>
                            </div>
                            {payload.reason && <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>Reason: {payload.reason}</div>}
                            {payload.warning && <div style={{ fontSize: '11px', color: 'var(--orange)', marginTop: '2px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}><FiAlertTriangle size={12} /> {payload.warning}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '11px', background: 'var(--green)' }}
                              onClick={() => isDeduction ? handleReviewDeduction(c.id, true) : handleReviewAdjustment(c.id, true)}>Approve</button>
                            <button style={{ padding: '5px 12px', fontSize: '11px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                              onClick={() => isDeduction ? handleReviewDeduction(c.id, false) : handleReviewAdjustment(c.id, false)}>Reject</button>
                          </div>
                        </div>
                      );
                    })
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MY APPROVALS (manager + super admin) ── */}
      {!loading && tab === 'manager_approval' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Pending Your Approval — super admins skip this; they see super admin section below */}
          {!isSuperAdmin && (
          <div className="card overflow-hidden p-0">
            <div className="card-header">
              Pending Your Approval
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({managerLeaves.length})
                </span>
              </div>
              {managerLeaves.length === 0
                ? <div className="p-32 text-center text-muted2 text-sm">No leave requests awaiting your approval.</div>
              : managerLeaves.map(r => (
                <div key={r.id} className="p-16-20 border-bottom" style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                  onClick={() => { setReviewModal(r); setReviewNote(''); }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div className="flex-between items-start" style={{ gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name || 'Unknown'}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                        {r.shiftSlot && <span style={{ fontSize: '11px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                        <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                      </div>
                      {r.sandwichCount > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--orange)', marginBottom: '2px', fontWeight: 500 }}>
                          <FiAlertTriangle size={11} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> {r.sandwichCount === 1 ? '1st sandwich' : `${r.sandwichCount} sandwich`} leave
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        {' · '}{r.reason}
                      </div>
                      {r.prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '2px' }}>📎 Prescription attached</div>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                      Click to review →
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
          )}
          {/* Super admin also sees pending_super leaves here */}
          {isSuperAdmin && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                Pending Super Admin Approval
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({leaveRequests.filter(r => r.approvalStage === 'pending_super' && r.status === 'pending').length})
                </span>
              </div>
              {leaveRequests.filter(r => r.approvalStage === 'pending_super' && r.status === 'pending').length === 0
                ? <div className="p-32 text-center text-muted2 text-sm">No leave requests awaiting super admin approval.</div>
                : leaveRequests.filter(r => r.approvalStage === 'pending_super' && r.status === 'pending').map(r => (
                  <div key={r.id} className="p-16-20 border-bottom" style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                    onClick={() => { setReviewModal(r); setReviewNote(''); }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <div className="flex-between items-start" style={{ gap: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{LEAVE_LABELS[r.leaveType]}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                          {r.shiftSlot && <span style={{ fontSize: '11px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                          <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                        </div>
                        {r.sandwichCount > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--orange)', marginBottom: '2px', fontWeight: 500 }}>
                            <FiAlertTriangle size={11} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> {r.sandwichCount === 1 ? '1st sandwich' : `${r.sandwichCount} sandwich`} leave
                          </div>
                        )}
                        <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                          {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                          {' · '}{r.reason}
                        </div>
                      {r.prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '2px' }}>📎 Prescription attached</div>}
                      {/* Manager approval chain */}
                      {r.user?.managers && r.user.managers.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {r.user.managers.map((m, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓</span>
                              <span>{m.manager.name}</span>
                              {i < r.user.managers.length - 1 && <span style={{ color: 'var(--text3)' }}>→</span>}
                            </span>
                          ))}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--blue)', fontWeight: 500 }}>
                            <span>⏳</span>
                            <span>You</span>
                          </span>
                        </div>
                      )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                        Click to review →
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN ACTIONS (super_admin only) ── */}
      {!loading && tab === 'admin-actions' && isSuperAdmin && (
        <div className="card overflow-hidden p-0">
          <div className="card-header">
            Pending Admin Actions ({pendingAdminActions.length})
          </div>
          {pendingAdminActions.length === 0
            ? <div className="p-32 text-center text-muted2 text-sm">No pending admin actions requiring your approval.</div>
            : pendingAdminActions.map(c => (
              <div key={c.id} className="flex-between border-bottom gap-12" style={{ padding: '14px 20px' }}>
                <div>
                  <div className="text-sm text-semibold">
                    {ADMIN_ACTION_LABELS[c.action] || c.action.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-muted2" style={{ marginTop: '2px' }}>
                    By {c.requestedBy} · {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-6">
                  <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }}
                    onClick={async () => {
                      await reviewAdminAction(c.id, user.username, true);
                      const pcs = await getPendingChanges();
                      setPendingAdminActions(pcs.filter(p => p.action !== 'attendance_adjustment' && p.action !== 'leave_deduction' && p.action !== 'update_employee_name'));
                      toast.success('Action approved.');
                    }}>Approve</button>
                  <button className="btn border-none" style={{ padding: '6px 14px', fontSize: '12px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                    onClick={async () => {
                      await reviewAdminAction(c.id, user.username, false);
                      const pcs = await getPendingChanges();
                      setPendingAdminActions(pcs.filter(p => p.action !== 'attendance_adjustment' && p.action !== 'leave_deduction' && p.action !== 'update_employee_name'));
                      toast.success('Action rejected.');
                    }}>Reject</button>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── REGULARIZATIONS ── */}
      {!loading && tab === 'regularize' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Admin review — only admin sees this */}
          {role === 'admin' && (
          <div className="card overflow-hidden p-0">
            <div className="card-header">
              Pending Admin Review
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({regularizations.length})
                </span>
              </div>
              {regularizations.length === 0
                ? <div className="p-32 text-center text-muted2 text-sm">No pending regularizations.</div>
              : regularizations.map(r => {
                let acPayload = {};
                const isAc = r.type === 'attendance_change';
                try { if (isAc) acPayload = JSON.parse(r.reason); } catch { /* */ }
                return (
                <div key={r.id} className="p-16-20 border-bottom flex-between" style={{ gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user.code}</span>
                      {isAc ? (
                        <span style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 600, padding: '2px 8px', borderRadius: '980px', background: 'rgba(255,159,10,0.1)' }}>
                          Attendance Change
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                          {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      {isAc ? (
                        <>{ATTENDANCE_TYPE_LABELS[acPayload.currentType] || acPayload.currentType} → {ATTENDANCE_TYPE_LABELS[acPayload.newType] || acPayload.newType} · Day {acPayload.day} · {formatMonthYear(acPayload.monthYear)}{acPayload.reason ? ` · ${acPayload.reason}` : ''}</>
                      ) : (
                        <>{r.requestedIn && `In: ${r.requestedIn}`}{r.requestedIn && r.requestedOut && ' · '}{r.requestedOut && `Out: ${r.requestedOut}`} · {r.reason}</>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }} onClick={() => handleReviewReg(r.id, true)}>Approve</button>
                    <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }} onClick={() => handleReviewReg(r.id, false)}>Reject</button>
                  </div>
                </div>
              );})
            }
          </div>
          )}

          {/* Super admin final approval — only super admin sees this */}
          {isSuperAdmin && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                Pending Super Admin Approval
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({superRegularizations.length})
                </span>
              </div>
              {superRegularizations.length === 0
                ? <div className="p-32 text-center text-muted2 text-sm">No regularizations awaiting final approval.</div>
              : superRegularizations.map(r => {
                let acPayload = {};
                const isAc = r.type === 'attendance_change';
                try { if (isAc) acPayload = JSON.parse(r.reason); } catch { /* */ }
                return (
                  <div key={r.id} className="p-16-20 border-bottom flex-between" style={{ gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user.code}</span>
                        {isAc ? (
                          <span style={{ fontSize: '11px', color: 'var(--orange)', fontWeight: 600, padding: '2px 8px', borderRadius: '980px', background: 'rgba(255,159,10,0.1)' }}>Attendance Change</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        {isAc ? (
                          <>{ATTENDANCE_TYPE_LABELS[acPayload.currentType] || acPayload.currentType} → {ATTENDANCE_TYPE_LABELS[acPayload.newType] || acPayload.newType} · Day {acPayload.day} · {formatMonthYear(acPayload.monthYear)}{acPayload.reason ? ` · ${acPayload.reason}` : ''}</>
                        ) : (
                          <>{r.requestedIn && `In: ${r.requestedIn}`}{r.requestedIn && r.requestedOut && ' · '}{r.requestedOut && `Out: ${r.requestedOut}`} · {r.reason}</>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }} onClick={() => handleSuperReviewReg(r.id, true)}>Final Approve</button>
                      <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }} onClick={() => handleSuperReviewReg(r.id, false)}>Reject</button>
                    </div>
                  </div>
                );})
              }
            </div>
          )}
        </div>
      )}

      {/* ── WFH TAB ── */}
      {!loading && tab === 'wfh' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Manager WFH queue */}
          {role === 'admin' && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                Pending Your Approval — Work Mode
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({managerWfhRequests.length})
                </span>
              </div>
              {managerWfhRequests.length === 0
                ? <div className="p-32 text-center text-muted2 text-sm">No requests awaiting your approval.</div>
                : managerWfhRequests.map(r => (
                  <div key={r.id} className="p-16-20 border-bottom flex-between" style={{ gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name || 'Unknown'}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                        <WorkTypeBadge workType={r.workType} />
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                          {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.reason}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }}
                        onClick={() => handleReviewWfh(r.id, true)}>Approve</button>
                      <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                        onClick={() => handleReviewWfh(r.id, false)}>Reject</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Super Admin WFH queue */}
          {isSuperAdmin && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                Pending Super Admin Approval — Work Mode
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({superWfhRequests.length})
                </span>
              </div>
              {superWfhRequests.length === 0
                ? <div className="p-32 text-center text-muted2 text-sm">No requests awaiting super admin approval.</div>
                : superWfhRequests.map(r => (
                  <div key={r.id} className="p-16-20 border-bottom flex-between" style={{ gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                        <WorkTypeBadge workType={r.workType} />
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                          {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.reason}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }}
                        onClick={() => handleReviewWfh(r.id, true)}>Final Approve</button>
                      <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                        onClick={() => handleReviewWfh(r.id, false)}>Reject</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* All WFH requests */}
          <div className="card overflow-hidden p-0">
            <div className="card-header">
              All Work Mode Requests
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400, marginLeft: '8px' }}>
                  ({wfhRequests.length})
                </span>
              </div>
              {wfhRequests.length === 0
                ? <div className="p-32 text-center text-muted2 text-sm">No requests yet.</div>
              : wfhRequests.map(r => (
                <div key={r.id} className="p-16-20 border-bottom" style={{ gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{r.user?.name || 'Unknown'}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                        <WorkTypeBadge workType={r.workType} />
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                          {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {r.approvalStage && r.status === 'pending' && <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.reason}</div>
                      {r.reviewNote && (
                        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px', fontStyle: 'italic' }}>Note: {r.reviewNote}</div>
                      )}
                    </div>
                    {(!r.approvalStage || r.status !== 'pending') && <StatusBadge status={r.status} />}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── LEAVE BALANCES ── */}
      {!loading && tab === 'balances' && (
        <div className="card overflow-hidden p-0">

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
              {(isAdmin || isSuperAdmin) && (
                <button className="btn btn-primary" onClick={() => setDeductModal(true)}
                  style={{ padding: '7px 18px', fontSize: 'var(--fs-sm)', background: 'var(--orange)' }}>
                  − Deduct Leave
                </button>
              )}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Employee', 'CL Remaining', 'SL Remaining', 'EL Remaining', 'RL Remaining', 'SH Remaining', 'CL Used', 'SL Used', 'EL Used', 'RL Used', 'SH Used', 'Actions'].map(h => (
                    <th key={h} style={{ background: 'var(--surface2)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedBalances.map((entry) => {
                  const { code, name, balance } = entry;
                  if (!balance) return null;
                  return (
                    <tr key={code} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 500 }}>{name} <span style={{ color: 'var(--text3)', fontSize: '11px' }}>#{code}</span></td>
                      {['cl', 'sl', 'el', 'rl', 'sh'].map(t => (
                        <td key={t} style={{ padding: '11px 14px', color: (balance[`${t}Remaining`] ?? 0) <= 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                          {balance[`${t}Remaining`] ?? 0}
                        </td>
                      ))}
                      {['cl', 'sl', 'el', 'rl', 'sh'].map(t => (
                        <td key={t} style={{ padding: '11px 14px', color: 'var(--text2)' }}>
                          {balance[`${t}Used`] ?? 0}
                        </td>
                      ))}
                      <td style={{ padding: '11px 14px' }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}
                          onClick={() => openEditBalance(entry)}>Edit</button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* ── HISTORY (admin only — all requests with statuses) ── */}
      {!loading && tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* ── Section A: Leave Requests ── */}
          <div className="card overflow-hidden p-0">
            <div className="card-header">
              <span>Leave Requests</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', background: 'var(--surface3)', padding: '1px 8px', borderRadius: '980px', marginLeft: '8px', lineHeight: 1.5 }}>
                {leaveRequests.length}
              </span>
            </div>
            {leaveRequests.length === 0 ? (
              <div className="p-32 text-center text-muted2 text-sm">No leave requests found.</div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {leaveRequests.map(r => (
                  <div key={r.id} className="p-14-20 border-bottom">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name || 'Unknown'}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType], padding: '2px 8px', borderRadius: '980px', background: `${LEAVE_COLORS[r.leaveType]}15` }}>
                        {LEAVE_LABELS[r.leaveType]}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                      <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                      {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      {' · '}{r.reason}
                      {r.reviewNote && <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}> · Note: {r.reviewNote}</span>}
                    </div>
                  </div>
                ))
              }
            </div>
            )}
          </div>

          {/* ── Section B: Regularizations ── */}
          {allRegularizations.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                <span>Regularizations</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400 }}>{allRegularizations.length}</span>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {allRegularizations.map(r => {
                  const regStatus = r.status === 'approved' && r.superStatus === 'approved' ? 'approved'
                    : r.status === 'rejected' || r.superStatus === 'rejected' ? 'rejected' : 'pending';
                  return (
                    <div key={r.id} className="p-14-20 border-bottom">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name || 'Unknown'}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text2)' }}>#{r.user?.code}</span>
                        <StatusBadge status={regStatus} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                        {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}In: {r.requestedIn} · Out: {r.requestedOut}
                        {' · '}{r.reason}
                        {r.reviewNote && <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}> · Note: {r.reviewNote}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Section C: Adjustments & Changes ── */}
          {historyChanges.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                <span>Adjustments & Changes</span>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 400 }}>{historyChanges.length}</span>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {historyChanges.map(c => {
                  let payload = {};
                  try { payload = JSON.parse(c.payload); } catch { /* */ }
                  const changeType = c.action === 'attendance_adjustment' ? 'Attendance Adjustment' : c.action === 'leave_deduction' ? 'Leave Deduction' : 'Name Change';
                  const detail = c.action === 'attendance_adjustment'
                    ? `${payload.employeeName || payload.employeeCode} · Day ${payload.day} · ${ATTENDANCE_TYPE_LABELS[payload.currentType] || payload.currentType || ''} → ${ATTENDANCE_TYPE_LABELS[payload.newType] || payload.newType || ''}`
                    : c.action === 'leave_deduction'
                    ? `${payload.employeeName || payload.employeeCode} · ${payload.days}d ${LEAVE_LABELS[payload.leaveType] || (payload.leaveType?.toUpperCase()) || payload.leaveType} deducted`
                    : `${payload.currentName || ''} → ${payload.newName || ''}`;
                  return (
                    <div key={c.id} className="p-14-20 border-bottom">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>{payload.employeeName || payload.code || 'Unknown'}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{payload.employeeCode && `#${payload.employeeCode}`}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--blue)', padding: '2px 8px', borderRadius: '980px', background: 'rgba(0,113,227,0.1)' }}>
                          {changeType}
                        </span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
                        {detail}
                        {payload.reason && <span> · {payload.reason}</span>}
                        {c.createdAt && <span style={{ color: 'var(--text3)' }}> · {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REVIEW MODAL ── */}
      <Modal open={!!reviewModal} onClose={() => { setReviewModal(null); setReviewNote(''); }} title="Review Leave Request" width="480px">
        {reviewModal && (<>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>{reviewModal.user?.name || 'Unknown'}</span>
              <span style={{ fontSize: '13px', color: 'var(--text2)' }}>#{reviewModal.user?.code}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: LEAVE_COLORS[reviewModal.leaveType], padding: '2px 10px', borderRadius: '980px', background: `${LEAVE_COLORS[reviewModal.leaveType]}15` }}>
                {LEAVE_LABELS[reviewModal.leaveType]}
              </span>
              <StageBadge stage={reviewModal.approvalStage} approverName={reviewModal.currentApprover?.name} reviewerName={reviewModal.reviewerName} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiCalendar size={11} /> Duration
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {new Date(reviewModal.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {reviewModal.fromDate !== reviewModal.toDate && ` – ${new Date(reviewModal.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                </div>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiClock size={11} /> Days
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{reviewModal.days} day{reviewModal.days !== 1 ? 's' : ''}</div>
              </div>
            </div>

            {reviewModal.shiftSlot && (
              <div style={{ background: 'rgba(255,107,107,0.06)', borderRadius: '10px', padding: '10px 14px', marginBottom: '10px', fontSize: '13px' }}>
                <span style={{ fontWeight: 600 }}>Slot:</span> {reviewModal.shiftSlot}
              </div>
            )}

            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px', lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>Reason:</span> {reviewModal.reason}
            </div>

            {reviewModal.sandwichCount > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--orange)', marginBottom: '10px', fontWeight: 500 }}>
                <FiAlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                {reviewModal.sandwichCount === 1 ? '1st sandwich' : `${reviewModal.sandwichCount} sandwich`} leave
              </div>
            )}

            {reviewModal.prescriptionFile && (
              <div style={{ fontSize: '12px', color: 'var(--blue)', marginBottom: '10px' }}>📎 Prescription attached</div>
            )}

            {/* Approval Progress */}
            {reviewModal.user?.managers && reviewModal.user.managers.length > 0 && (
              <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>Approval Progress</div>
                {(() => {
                  const managers = reviewModal.user.managers;
                  const currentIdx = reviewModal.currentApproverId
                    ? managers.findIndex(m => m.managerUserId === reviewModal.currentApproverId)
                    : -1;
                  const stage = reviewModal.approvalStage;
                  const isMgr = i => `Manager ${i + 1}`;
                  return (
                    <>
                      {managers.map((m, i) => {
                        let status, color, icon;
                        if (stage === 'approved') {
                          status = 'Approved'; color = 'var(--green)'; icon = '✓';
                        } else if (stage === 'rejected') {
                          if (i < currentIdx) { status = 'Approved'; color = 'var(--green)'; icon = '✓'; }
                          else { status = '—'; color = 'var(--text3)'; icon = '○'; }
                        } else if (i < currentIdx) {
                          status = 'Approved'; color = 'var(--green)'; icon = '✓';
                        } else if (i === currentIdx) {
                          status = 'Pending your approval'; color = 'var(--blue)'; icon = '→';
                        } else {
                          status = 'Pending'; color = 'var(--text3)'; icon = '○';
                        }
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', fontSize: '12px', borderBottom: i < managers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <span style={{ color, fontWeight: 600, width: '16px' }}>{icon}</span>
                            <span style={{ fontWeight: 500, color: status === 'Pending your approval' || status === 'Approved' ? 'var(--text)' : 'var(--text3)', minWidth: '90px' }}>{isMgr(i)}</span>
                            <span style={{ color: 'var(--text2)', flex: 1 }}>{m.manager.name}</span>
                            <span style={{ color, fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap' }}>{status}</span>
                          </div>
                        );
                      })}
                      {(stage === 'pending_super' || stage === 'approved' || stage === 'pending_mgr' || stage === 'pending_l2' || stage === 'pending_l1') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', fontSize: '12px' }}>
                          <span style={{ color: stage === 'pending_super' ? 'var(--blue)' : stage === 'approved' ? 'var(--green)' : 'var(--text3)', fontWeight: 600, width: '16px' }}>
                            {stage === 'approved' ? '✓' : stage === 'pending_super' ? '→' : '○'}
                          </span>
                          <span style={{ fontWeight: 500, minWidth: '90px', color: stage === 'pending_super' || stage === 'approved' ? 'var(--text)' : 'var(--text3)' }}>Super Admin</span>
                          <span style={{ color: 'var(--text2)', flex: 1 }}>{stage === 'approved' ? '—' : 'You'}</span>
                          <span style={{ color: stage === 'pending_super' ? 'var(--blue)' : stage === 'approved' ? 'var(--green)' : 'var(--text3)', fontSize: '11px', fontWeight: 500 }}>
                            {stage === 'pending_super' ? 'Pending your approval' : stage === 'approved' ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            <div style={{ marginTop: '16px' }}>
              <label className="input-label" style={{ marginBottom: '6px' }}>Review Note <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
              <input className="input-field" placeholder="Add a note for the employee…" value={reviewNote}
                onChange={e => setReviewNote(e.target.value)} style={{ padding: '10px 14px', fontSize: '13px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '14px', background: 'var(--green)' }}
              onClick={() => handleReviewLeave(reviewModal.id, true)}>
              Approve
            </button>
            <button style={{ flex: 1, padding: '12px', fontSize: '14px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.3)', background: 'rgba(255,59,48,0.08)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
              onClick={() => handleReviewLeave(reviewModal.id, false)}>
              Reject
            </button>
          </div>
        </>)}
        </Modal>

      {/* ── EDIT BALANCE MODAL ── */}
      <Modal open={!!editBalanceTarget} onClose={() => setEditBalanceTarget(null)} title={editBalanceTarget ? `Edit Leave Balance — ${editBalanceTarget.name}` : ''} width="440px">
        {editBalanceTarget && (
          <form onSubmit={handleEditBalance}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {['clTotal', 'slTotal', 'elTotal', 'rlTotal', 'shTotal'].map(k => {
                const labels = { clTotal: 'CL (Casual Leave)', slTotal: 'SL (Sick Leave)', elTotal: 'EL (Earned Leave)', rlTotal: 'RL (Restricted Holiday)', shTotal: 'SH (Short Leave)' };
                return (
                  <div key={k}>
                    <label className="input-label">{labels[k]}</label>
                    <input className="input-field" type="number" min={0} max={60}
                      value={editBalanceForm[k]}
                      onChange={e => setEditBalanceForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))}
                      style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box' }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '14px', background: 'var(--green)' }}>
                Save
              </button>
              <button type="button" style={{ flex: 1, padding: '12px', fontSize: '14px', borderRadius: '980px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                onClick={() => setEditBalanceTarget(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}
        </Modal>

      {/* ── DEDUCT LEAVE MODAL ── */}
      <Modal open={deductModal} onClose={() => setDeductModal(false)} title="Deduct Leave" width="440px">
        <form onSubmit={handleDeductLeave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            <div>
              <label className="input-label">Employee</label>
              <select className="input-field" value={deductForm.employeeCode}
                onChange={e => setDeductForm(f => ({ ...f, employeeCode: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box' }}>
                <option value="">— Select —</option>
                {balances.map(b => (
                  <option key={b.code} value={b.code}>{b.name} #{b.code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Leave Type</label>
              <select className="input-field" value={deductForm.leaveType}
                onChange={e => setDeductForm(f => ({ ...f, leaveType: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box' }}>
                {Object.entries(LEAVE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v} — {k === 'cl' ? 'Casual Leave' : k === 'sl' ? 'Sick Leave' : k === 'el' ? 'Earned Leave' : k === 'rl' ? 'Restricted Holiday' : 'Short Leave'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Days</label>
              <input className="input-field" type="number" min={1} max={30}
                value={deductForm.days}
                onChange={e => setDeductForm(f => ({ ...f, days: parseInt(e.target.value) || 1 }))}
                style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label className="input-label">Reason</label>
              <textarea className="input-field" value={deductForm.reason}
                onChange={e => setDeductForm(f => ({ ...f, reason: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box', minHeight: '60px', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '12px', fontSize: '14px', background: 'var(--orange)' }}>
              Submit for Approval
            </button>
            <button type="button" style={{ flex: 1, padding: '12px', fontSize: '14px', borderRadius: '980px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
              onClick={() => setDeductModal(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
