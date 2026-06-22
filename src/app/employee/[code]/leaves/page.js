"use client";

import { useEffect, useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../components/AuthProvider';
import { getLeaveRequests, submitLeaveRequest } from '../../../../actions/leave';
import { FiSun, FiAlertTriangle } from 'react-icons/fi';
import { useEmployeeData } from '../context';
import DatePickerInput from '../../../../components/DatePicker';

const LEAVE_LABELS = { cl: 'Casual Leave', sl: 'Sick Leave', el: 'Earned Leave', rl: 'Restricted Leave', sh: 'Short Leave', ul: 'Unpaid Leave' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b', ul: '#8e8e93' };

export default function LeavesPage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const { emp, leaveBalanceDetail, rlHolidays, triggerRefetch } = useEmployeeData();
  const router = useRouter();

  const [leaveRequests, setLeaveRequests] = useState([]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'cl', fromDate: null, toDate: null, days: 1, reason: '', shiftSlot: '10-12' });
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [prescriptionFile, setPrescriptionFile] = useState(null);

  const sandwichWarning = useMemo(() => {
    if (!leaveForm.fromDate) return '';
    const from = new Date(leaveForm.fromDate);
    const to = leaveForm.toDate ? new Date(leaveForm.toDate) : from;
    if (from > to) return '';
    const fromDay = from.getDay();
    const toDay = to.getDay();
    const isSandwich = (fromDay <= 5 && toDay >= 1 && toDay <= 2) && (to.getTime() - from.getTime()) > 86400000 * 2;
    if (isSandwich && (leaveForm.leaveType === 'cl' || leaveForm.leaveType === 'el')) {
      return 'This period spans a weekend (Fri–Mon). If approved, weekend days may be counted as sandwich leave.';
    }
    return '';
  }, [leaveForm.fromDate, leaveForm.toDate, leaveForm.leaveType]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!code) return;
    getLeaveRequests(code).then(setLeaveRequests).catch(() => setLeaveRequests([]));
  }, [code, triggerRefetch]);

  const availableLeaveTypes = ['cl', 'sl'];
  if (emp?.joiningDate && new Date(new Date(emp.joiningDate).getTime() + 365 * 24 * 60 * 60 * 1000) <= new Date()) {
    availableLeaveTypes.push('el');
  }
  availableLeaveTypes.push('rl', 'sh');

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setLeaveError(''); setLeaveSuccess('');
    if (!leaveForm.fromDate) return setLeaveError('Please select a start date.');
    if (leaveForm.fromDate < today) return setLeaveError('Leave cannot be applied for a past date.');
    if (!leaveForm.reason.trim()) return setLeaveError('Please provide a reason.');
    const fmt = (d) => d instanceof Date && !isNaN(d) ? d.toISOString().split('T')[0] : '';
    setSubmittingLeave(true);
    const result = await submitLeaveRequest(code, {
      ...leaveForm,
      fromDate: fmt(leaveForm.fromDate),
      toDate: leaveForm.toDate ? fmt(leaveForm.toDate) : fmt(leaveForm.fromDate),
      days: parseFloat(leaveForm.days) || 1,
      prescriptionFile: leaveForm.leaveType === 'sl' ? prescriptionFile : null,
      shiftSlot: leaveForm.leaveType === 'sh' ? leaveForm.shiftSlot : null
    });
    setSubmittingLeave(false);
    if (result.error) return setLeaveError(result.error);
    setLeaveSuccess('Leave request submitted successfully.');
    setLeaveForm({ leaveType: 'cl', fromDate: null, toDate: null, days: 1, reason: '', shiftSlot: '10-12' });
    setPrescriptionFile(null);
    triggerRefetch();
  };

  const statusBadge = (status) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'Pending' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' }
    };
    const s = map[status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: status.charAt(0).toUpperCase() + status.slice(1) };
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const StageBadge = ({ stage, approverName }) => {
    const map = {
      pending_mgr: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
      pending_l2: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
      pending_l1: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
      pending_super: { bg: 'rgba(175,82,222,0.1)', color: '#7b2d8b', label: 'Awaiting Super Admin' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
    };
    const s = map[stage] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)' };
    const label = (stage === 'pending_mgr' || stage === 'pending_l2' || stage === 'pending_l1') && approverName
      ? `With ${approverName}` : (map[stage]?.label || stage?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || stage);
    return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, background: s.bg, color: s.color }}>{label}</span>;
  };

  if (!emp) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>Apply for Leave</div>
        <form onSubmit={handleSubmitLeave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Leave Type</label>
            <select className="input-field" value={leaveForm.leaveType} onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value, shiftSlot: '10-12' }))}>
              {availableLeaveTypes.map(type => {
                const avail = leaveBalanceDetail ? (leaveBalanceDetail[`${type}Avail`] ?? 0) : '?';
                const total = leaveBalanceDetail ? (leaveBalanceDetail[`${type}Total`] ?? 0) : '?';
                return (
                  <option key={type} value={type}>
                    {LEAVE_LABELS[type]} ({type.toUpperCase()}) — {avail}/{total} remaining
                  </option>
                );
              })}
              <option value="ul" style={{ borderTop: '1px solid var(--border)' }}>Unpaid Leave (UL) — no limit</option>
            </select>
            {leaveForm.leaveType !== 'ul' && leaveBalanceDetail && leaveBalanceDetail[`${leaveForm.leaveType}Avail`] <= 0 && (
              <div style={{ fontSize: '12px', color: 'var(--orange)', marginTop: '6px', background: 'rgba(255,159,10,0.1)', borderRadius: '8px', padding: '8px 12px', fontWeight: 500 }}>
                You have no {LEAVE_LABELS[leaveForm.leaveType]} remaining. This will be treated as unpaid leave.
              </div>
            )}
            {leaveForm.leaveType === 'ul' && (
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px' }}>
                No leave balance tracking — this will be unpaid leave.
              </div>
            )}
          </div>

          {leaveForm.leaveType === 'rl' && rlHolidays.length > 0 && (
            <div style={{ background: 'rgba(175,82,222,0.08)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px' }}>
              <div style={{ fontWeight: 600, color: '#7b2d8b', marginBottom: '6px' }}>Eligible RL Dates</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {rlHolidays.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text2)' }}>
                      {new Date(2024, h.month - 1, h.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontWeight: 500 }}>{h.name}</span>
                    {h.isBirthday && <span style={{ fontSize: '10px', background: 'rgba(175,82,222,0.15)', color: '#7b2d8b', padding: '1px 6px', borderRadius: '980px' }}>Birthday</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {leaveForm.leaveType === 'sl' && (
            <div>
              <label className="input-label">Prescription (required for Sick Leave)</label>
              <input className="input-field" type="file" accept="image/*,.pdf"
                style={{ padding: '8px', fontSize: '12px' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const reader = new FileReader();
                    reader.onload = () => setPrescriptionFile(reader.result);
                    reader.readAsDataURL(f);
                  }
                }} />
              {prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '4px' }}>Prescription uploaded</div>}
            </div>
          )}

          {leaveForm.leaveType === 'sh' && (
            <div>
              <label className="input-label">Shift Slot (2 hours)</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                {['10-12', '5-7'].map(slot => (
                  <label key={slot} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                    border: leaveForm.shiftSlot === slot ? '2px solid #ff6b6b' : '2px solid var(--border)',
                    background: leaveForm.shiftSlot === slot ? 'rgba(255,107,107,0.08)' : 'var(--surface2)',
                    fontWeight: leaveForm.shiftSlot === slot ? 600 : 400, fontSize: '13px', transition: 'all 0.15s'
                  }}>
                    <input type="radio" name="shiftSlot" value={slot} checked={leaveForm.shiftSlot === slot}
                      onChange={e => setLeaveForm(f => ({ ...f, shiftSlot: e.target.value }))} style={{ display: 'none' }} />
                    <div>{slot === '10-12' ? <><FiSun size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> 10:00 AM – 12:00 PM</> : <><FiSun size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> 5:00 PM – 7:00 PM</>}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className="input-label">From Date</label>
              <DatePickerInput
                selected={leaveForm.fromDate}
                onChange={d => setLeaveForm(f => ({ ...f, fromDate: d, toDate: f.toDate || d }))}
                minDate={today}
                placeholder="Select start date"
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">To Date</label>
              <DatePickerInput
                selected={leaveForm.toDate}
                onChange={d => setLeaveForm(f => ({ ...f, toDate: d }))}
                minDate={leaveForm.fromDate || today}
                placeholder="Select end date"
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="input-label">Days</label>
            <select className="input-field" value={leaveForm.leaveType === 'sh' ? 0.5 : leaveForm.days}
              onChange={e => setLeaveForm(f => ({ ...f, days: parseFloat(e.target.value) }))}
              disabled={leaveForm.leaveType === 'sh'}
              style={{ opacity: leaveForm.leaveType === 'sh' ? 0.6 : 1 }}>
              <option value={0.5}>Half Day (0.5)</option>
              <option value={1}>1 Day</option>
              {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} Days</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Reason</label>
            <textarea className="input-field" rows={3} placeholder="Brief reason for leave…" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>

          {sandwichWarning && (
            <div style={{ background: 'rgba(255,159,10,0.1)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#b36200', fontWeight: 500 }}>
              {sandwichWarning}
            </div>
          )}

          {leaveBalanceDetail && (
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {availableLeaveTypes.map(type => {
                const avail = leaveBalanceDetail[`${type}Avail`] ?? 0;
                const total = leaveBalanceDetail[`${type}Total`] ?? 0;
                const used = leaveBalanceDetail[`${type}Used`] ?? 0;
                return (
                    <div key={type} style={{ borderLeft: `3px solid ${LEAVE_COLORS[type]}`, paddingLeft: '8px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '11px' }}>{LEAVE_LABELS[type]}</div>
                    <div style={{ color: 'var(--text2)' }}>{avail} avail · {used} used · {total} total</div>
                  </div>
                );
              })}
            </div>
          )}

          {leaveError && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{leaveError}</div>}
          {leaveSuccess && <div style={{ color: 'var(--green)', fontSize: '13px' }}>{leaveSuccess}</div>}
          <button type="submit" className="btn btn-primary" disabled={submittingLeave} style={{ opacity: submittingLeave ? 0.7 : 1 }}>
            {submittingLeave ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
          My Requests ({leaveRequests.length})
        </div>
        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
          {leaveRequests.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No requests yet.</div>
            : leaveRequests.map(r => (
              <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{r.leaveType.toUpperCase()}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                    {r.shiftSlot && <span style={{ fontSize: '11px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {r.approvalStage && r.status === 'pending' && <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} />}
                    {statusBadge(r.status)}
                  </div>
                </div>
                {r.sandwichCount > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--orange)', marginBottom: '2px', fontWeight: 500 }}>
                    <FiAlertTriangle size={11} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> {r.sandwichCount === 1 ? '1st sandwich' : `${r.sandwichCount} sandwich`} leave
                  </div>
                )}
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                  {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{r.reason}</div>
                {r.prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '2px' }}>Prescription attached</div>}
                {r.reviewNote && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontStyle: 'italic' }}>Note: {r.reviewNote}</div>}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
