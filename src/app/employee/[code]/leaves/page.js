"use client";

import { useEffect, useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../../components/AuthProvider';
import { getLeaveRequests, submitLeaveRequest } from '../../../../actions/leave';
import { FiSun, FiAlertTriangle } from 'react-icons/fi';
import { useEmployeeData } from '../context';
import DatePickerInput from '../../../../components/DatePicker';

const LEAVE_LABELS = { cl: 'Casual Leave', sl: 'Sick Leave', el: 'Earned Leave', rl: 'Restricted Leave', sh: 'Short Leave', ul: 'Unpaid Leave' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b', ul: '#8e8e93' };

function daysBetween(from, to) {
  return Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
}

function countWeekends(from, to) {
  let c = 0;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) c++;
  }
  return c;
}

function countWeekdays(from, to) {
  let c = 0;
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) c++;
  }
  return c;
}

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
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'cl', fromDate: null, toDate: null, reason: '', shiftSlot: '10-12', isHalfDay: false });
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);

  const computedDays = useMemo(() => {
    if (!leaveForm.fromDate) return 1;
    if (leaveForm.isHalfDay || leaveForm.leaveType === 'sh') return 0.5;
    if (leaveForm.leaveType === 'rl') return 1;
    const from = new Date(leaveForm.fromDate);
    const to = leaveForm.toDate ? new Date(leaveForm.toDate) : from;
    if (from > to) return 1;
    return daysBetween(from, to);
  }, [leaveForm.fromDate, leaveForm.toDate, leaveForm.isHalfDay, leaveForm.leaveType]);

  const totalDays = useMemo(() => {
    if (!leaveForm.fromDate) return 0;
    const from = new Date(leaveForm.fromDate);
    const to = leaveForm.toDate ? new Date(leaveForm.toDate) : from;
    if (from > to) return 0;
    return daysBetween(from, to);
  }, [leaveForm.fromDate, leaveForm.toDate]);

  const weekends = useMemo(() => {
    if (!leaveForm.fromDate) return 0;
    const from = new Date(leaveForm.fromDate);
    const to = leaveForm.toDate ? new Date(leaveForm.toDate) : from;
    if (from > to) return 0;
    return countWeekends(from, to);
  }, [leaveForm.fromDate, leaveForm.toDate]);

  const weekdays = useMemo(() => {
    if (!leaveForm.fromDate) return 0;
    const from = new Date(leaveForm.fromDate);
    const to = leaveForm.toDate ? new Date(leaveForm.toDate) : from;
    if (from > to) return 0;
    return countWeekdays(from, to);
  }, [leaveForm.fromDate, leaveForm.toDate]);

  function weekendCount(from, to) {
    let c = 0;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day === 0 || day === 6) c++;
    }
    return c;
  }

  const sandwichWarning = useMemo(() => {
    if (!leaveForm.fromDate || leaveForm.isHalfDay || leaveForm.leaveType === 'sh' || leaveForm.leaveType === 'rl') return '';
    const from = new Date(leaveForm.fromDate);
    const to = leaveForm.toDate ? new Date(leaveForm.toDate) : from;
    if (from > to) return '';
    const wk = weekendCount(from, to);
    if (wk === 0 || (leaveForm.leaveType !== 'cl' && leaveForm.leaveType !== 'el')) return '';
    const usedSoFar = leaveBalanceDetail?.sandwichUsed ?? 0;
    if (usedSoFar > 0) return '';
    return `First leave spanning weekends — 2 weekend days free. Remaining weekends (if any) will be counted as sandwich leave.`;
  }, [leaveForm.fromDate, leaveForm.toDate, leaveForm.leaveType, leaveForm.isHalfDay, leaveBalanceDetail]);

  const sandwichInfo = useMemo(() => {
    if (!leaveForm.fromDate || leaveForm.isHalfDay || leaveForm.leaveType === 'sh' || leaveForm.leaveType === 'rl' || leaveForm.leaveType === 'ul') return null;
    const from = new Date(leaveForm.fromDate);
    const to = leaveForm.toDate ? new Date(leaveForm.toDate) : from;
    if (from > to) return null;
    const wk = weekendCount(from, to);
    if (wk === 0) return null;
    const usedSoFar = leaveBalanceDetail?.sandwichUsed ?? 0;
    const isFirst = usedSoFar === 0;
    const freeDays = Math.min(wk, 2);
    const deducted = computedDays - (isFirst ? freeDays : 0);
    return {
      count: usedSoFar + 1,
      deductedDays: deducted,
      weekendFree: isFirst,
      label: isFirst
        ? `1st leave spanning weekends — ${freeDays} weekend day${freeDays !== 1 ? 's' : ''} excluded`
        : `${usedSoFar + 1} leave spanning weekends — all ${Math.round(computedDays)} days counted`
    };
  }, [leaveForm.fromDate, leaveForm.toDate, leaveForm.leaveType, leaveForm.isHalfDay, computedDays, leaveBalanceDetail]);

  const leavePreview = useMemo(() => {
    if (!leaveForm.fromDate || totalDays <= 0) return null;
    const type = leaveForm.leaveType;
    if (type === 'rl') {
      return { totalDays: 1, weekends: 0, weekdays: 1, paid: 1, unpaid: 0, isHalfOrSH: false, isRL: true, sandwich: null };
    }
    const isHalfOrSH = leaveForm.isHalfDay || type === 'sh';
    if (isHalfOrSH) {
      const remaining = type !== 'ul' && type !== 'sh' && leaveBalanceDetail ? (leaveBalanceDetail[`${type}Remaining`] ?? 0) : null;
      const paid = type === 'sh' ? 0.5 : (type === 'ul' ? 0 : Math.min(0.5, remaining ?? 0));
      const unpaid = type === 'ul' ? 0.5 : (type === 'sh' ? 0 : Math.max(0, 0.5 - (remaining ?? 0)));
      return { totalDays: 0.5, weekends: 0, weekdays: 0, paid, unpaid, isHalfOrSH, sandwich: null };
    }
    // Use sandwich-reduced days if applicable
    const displayDays = sandwichInfo ? sandwichInfo.deductedDays : totalDays;
    const displayWeekends = sandwichInfo ? 0 : weekends;
    const displayWeekdays = sandwichInfo ? displayDays : weekdays;
    if (type === 'ul') {
      return { totalDays: displayDays, weekends: displayWeekends, weekdays: displayWeekdays, paid: 0, unpaid: displayDays, isHalfOrSH: false, sandwich: sandwichInfo };
    }
    const remaining = leaveBalanceDetail ? (leaveBalanceDetail[`${type}Remaining`] ?? 0) : 0;
    if (remaining <= 0) {
      return { totalDays: displayDays, weekends: displayWeekends, weekdays: displayWeekdays, paid: 0, unpaid: displayDays, isHalfOrSH: false, noBalance: true, sandwich: sandwichInfo };
    }
    const paid = Math.min(displayDays, remaining);
    const unpaid = Math.max(0, displayDays - remaining);
    return { totalDays: displayDays, weekends: displayWeekends, weekdays: displayWeekdays, paid, unpaid, isHalfOrSH: false, sandwich: sandwichInfo };
  }, [leaveForm.fromDate, leaveForm.leaveType, leaveForm.isHalfDay, totalDays, weekends, weekdays, leaveBalanceDetail, sandwichInfo]);

  const availableLeaveTypes = useMemo(() => {
    const types = ['cl', 'sl'];
    if (emp?.joiningDate && new Date(new Date(emp.joiningDate).getTime() + 365 * 24 * 60 * 60 * 1000) <= new Date()) {
      types.push('el');
    }
    types.push('rl', 'sh');
    return types;
  }, [emp]);

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

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setLeaveError('');
    setLeaveSuccess('');
    setSubmitResult(null);
    if (!leaveForm.fromDate) return setLeaveError('Please select a start date.');
    if (leaveForm.fromDate < today) return setLeaveError('Leave cannot be applied for a past date.');
    if (!leaveForm.reason.trim()) return setLeaveError('Please provide a reason.');
    if (leavePreview?.noBalance) return setLeaveError(`You have no ${leaveForm.leaveType.toUpperCase()} balance remaining. Please select Unpaid Leave (UL) instead.`);
    const fmt = (d) => d instanceof Date && !isNaN(d) ? d.toISOString().split('T')[0] : '';
    setSubmittingLeave(true);
    const result = await submitLeaveRequest(code, {
      leaveType: leaveForm.leaveType,
      fromDate: fmt(leaveForm.fromDate),
      toDate: leaveForm.toDate ? fmt(leaveForm.toDate) : fmt(leaveForm.fromDate),
      days: computedDays,
      reason: leaveForm.reason,
      prescriptionFile: leaveForm.leaveType === 'sl' ? prescriptionFile : null,
      shiftSlot: leaveForm.leaveType === 'sh' ? leaveForm.shiftSlot : null,
      isHalfDay: leaveForm.isHalfDay
    });
    setSubmittingLeave(false);
    if (result.error) return setLeaveError(result.error);
    setLeaveSuccess('Leave request submitted successfully.');
    setSubmitResult(result);
    setLeaveForm({ leaveType: 'cl', fromDate: null, toDate: null, reason: '', shiftSlot: '10-12', isHalfDay: false });
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

  const StageBadge = ({ stage, approverName, reviewerName }) => {
    const map = {
      pending_mgr: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
      pending_l2: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
      pending_l1: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
      pending_super: { bg: 'rgba(175,82,222,0.1)', color: '#7b2d8b', label: 'Awaiting Super Admin' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
    };
    const s = map[stage] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)' };
    let label;
    if (stage === 'approved' && reviewerName) label = `Approved by ${reviewerName}`;
    else if (stage === 'rejected' && reviewerName) label = `Rejected by ${reviewerName}`;
    else if ((stage === 'pending_mgr' || stage === 'pending_l2' || stage === 'pending_l1') && approverName) label = `With ${approverName}`;
    else label = map[stage]?.label || stage?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || stage;
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
            <select className="input-field" value={leaveForm.leaveType} onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value, shiftSlot: '10-12', isHalfDay: false }))}>
              {availableLeaveTypes.map(type => {
                const remaining = leaveBalanceDetail ? (leaveBalanceDetail[`${type}Remaining`] ?? 0) : '?';
                const total = leaveBalanceDetail ? (leaveBalanceDetail[`${type}Total`] ?? 0) : '?';
                return (
                  <option key={type} value={type}>
                    {LEAVE_LABELS[type]} ({type.toUpperCase()}) — {remaining}/{total} remaining
                  </option>
                );
              })}
              <option value="ul" style={{ borderTop: '1px solid var(--border)' }}>Unpaid Leave (UL) — no limit</option>
            </select>
            {leaveForm.leaveType !== 'ul' && leaveForm.leaveType !== 'sh' && leaveBalanceDetail && leaveBalanceDetail[`${leaveForm.leaveType}Remaining`] <= 0 && (
              <div style={{ fontSize: '12px', color: 'var(--orange)', marginTop: '6px', background: 'rgba(255,159,10,0.1)', borderRadius: '8px', padding: '8px 12px', fontWeight: 500 }}>
                You have no {LEAVE_LABELS[leaveForm.leaveType]} remaining. Please select Unpaid Leave (UL).
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
              <div style={{ fontWeight: 600, color: '#7b2d8b', marginBottom: '6px' }}>Select RL Date (click to pick)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {rlHolidays.map((h, i) => {
                  const yr = new Date().getFullYear();
                  const d = new Date(yr, h.month - 1, h.day);
                  const isSelected = leaveForm.fromDate && d.toDateString() === leaveForm.fromDate.toDateString();
                  return (
                    <div key={i} onClick={() => d >= today && setLeaveForm(f => ({ ...f, fromDate: d }))}
                      style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: d >= today ? 'pointer' : 'not-allowed', opacity: d < today ? 0.5 : 1,
                        background: isSelected ? 'rgba(175,82,222,0.15)' : 'transparent', borderRadius: '6px', padding: '4px 6px' }}>
                      <span style={{ color: 'var(--text2)' }}>
                        {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      <span style={{ fontWeight: isSelected ? 600 : 500 }}>{h.name}</span>
                      {h.isBirthday && <span style={{ fontSize: '10px', background: 'rgba(175,82,222,0.15)', color: '#7b2d8b', padding: '1px 6px', borderRadius: '980px' }}>Birthday</span>}
                      {isSelected && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#7b2d8b', fontWeight: 600 }}>Selected</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {leaveForm.leaveType === 'sl' && computedDays > 1 && (
            <div>
              <label className="input-label">Prescription (required for Sick Leave &gt; 1 day)</label>
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

          {leaveForm.leaveType === 'sl' && computedDays <= 1 && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px' }}>
              No prescription needed for single-day sick leave.
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

          {leaveForm.leaveType === 'rl' || leaveForm.isHalfDay || leaveForm.leaveType === 'sh' ? (
            <div>
              <label className="input-label">Date</label>
              <DatePickerInput
                selected={leaveForm.fromDate}
                onChange={d => setLeaveForm(f => ({ ...f, fromDate: d }))}
                minDate={today}
                placeholder="Select date"
                className="input-field"
              />
            </div>
          ) : (
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
          )}

          {leaveForm.leaveType !== 'sh' && leaveForm.leaveType !== 'rl' && computedDays > 0.5 && (
            <div>
              <label className="input-label">Duration</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                {['Full Day', 'Half Day'].map(opt => (
                  <label key={opt} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                    border: (opt === 'Half Day') === leaveForm.isHalfDay ? '2px solid #0071e3' : '2px solid var(--border)',
                    background: (opt === 'Half Day') === leaveForm.isHalfDay ? 'rgba(0,113,227,0.08)' : 'var(--surface2)',
                    fontWeight: (opt === 'Half Day') === leaveForm.isHalfDay ? 600 : 400, fontSize: '13px', transition: 'all 0.15s'
                  }}>
                    <input type="radio" name="duration" checked={(opt === 'Half Day') === leaveForm.isHalfDay}
                      onChange={() => setLeaveForm(f => ({ ...f, isHalfDay: opt === 'Half Day', toDate: opt === 'Half Day' ? null : f.toDate }))} style={{ display: 'none' }} />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          )}

          {leaveForm.leaveType !== 'sh' && (
            <div style={{ fontSize: '13px', background: 'var(--surface2)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--text2)' }}>Days:</span>
              <strong style={{ fontSize: '16px' }}>{computedDays}</strong>
              {sandwichInfo && <span style={{ fontSize: '11px', color: 'var(--blue)' }}>({sandwichInfo.deductedDays} counted)</span>}
              {computedDays === 0.5 && <span style={{ fontSize: '11px', color: 'var(--text3)' }}>Half day</span>}
            </div>
          )}

          <div>
            <label className="input-label">Reason</label>
            <textarea className="input-field" rows={3} placeholder="Brief reason for leave…" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>

          {leavePreview && (
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '12px' }}>Leave Preview</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                <div>Total days: <strong>{leavePreview.totalDays}</strong></div>
                {!leavePreview.isHalfOrSH && (
                  <div>Leave type: <strong style={{ color: LEAVE_COLORS[leaveForm.leaveType] }}>{LEAVE_LABELS[leaveForm.leaveType]} ({leaveForm.leaveType.toUpperCase()})</strong></div>
                )}
                {leaveForm.leaveType !== 'ul' && leaveForm.leaveType !== 'sh' && !leavePreview.isHalfOrSH && (
                  <>
                    <div style={{ color: 'var(--green)' }}>Paid: <strong>{leavePreview.paid}d</strong></div>
                    {leavePreview.unpaid > 0 && <div style={{ color: 'var(--orange)' }}>Unpaid: <strong>{leavePreview.unpaid}d</strong></div>}
                  </>
                )}
                {leaveForm.leaveType === 'ul' && (
                  <div style={{ color: 'var(--orange)' }}>All <strong>unpaid</strong></div>
                )}
                {leaveForm.leaveType === 'sh' && (
                  <div style={{ color: 'var(--text2)' }}>2-hour slot · <strong>half-day</strong></div>
                )}
                {leavePreview.isHalfOrSH && leaveForm.leaveType !== 'sh' && leaveForm.leaveType !== 'ul' && (
                  <>
                    <div style={{ color: 'var(--green)' }}>Paid: <strong>{leavePreview.paid}d</strong></div>
                    {leavePreview.unpaid > 0 && <div style={{ color: 'var(--orange)' }}>Unpaid: <strong>{leavePreview.unpaid}d</strong></div>}
                  </>
                )}
              </div>
            </div>
          )}

          {sandwichWarning && (
            <div style={{ background: 'rgba(255,159,10,0.1)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#b36200', fontWeight: 500 }}>
              <FiAlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {sandwichWarning}
            </div>
          )}

          {leaveBalanceDetail && (
            <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {availableLeaveTypes.map(type => {
                const remaining = leaveBalanceDetail[`${type}Remaining`] ?? 0;
                const total = leaveBalanceDetail[`${type}Total`] ?? 0;
                const used = leaveBalanceDetail[`${type}Used`] ?? 0;
                return (
                  <div key={type} style={{ borderLeft: `3px solid ${LEAVE_COLORS[type]}`, paddingLeft: '8px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '11px' }}>{LEAVE_LABELS[type]}</div>
                    <div style={{ color: 'var(--text2)' }}>{remaining} remaining · {used} used · {total} total</div>
                  </div>
                );
              })}
            </div>
          )}

          {leaveError && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{leaveError}</div>}
          {leaveSuccess && <div style={{ color: 'var(--green)', fontSize: '13px' }}>{leaveSuccess}</div>}
          {submitResult?.unpaidDays > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--orange)', background: 'rgba(255,159,10,0.1)', borderRadius: '8px', padding: '8px 12px', fontWeight: 500 }}>
              {submitResult.unpaidDays} day{submitResult.unpaidDays !== 1 ? 's' : ''} will be unpaid (auto-split).
            </div>
          )}
          {submitResult?.sandwichMessage && (
            <div style={{ fontSize: '12px', color: 'var(--orange)', background: 'rgba(255,159,10,0.1)', borderRadius: '8px', padding: '8px 12px', fontWeight: 500 }}>
              {submitResult.sandwichMessage}
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={submittingLeave || !!leavePreview?.noBalance} style={{ opacity: submittingLeave || leavePreview?.noBalance ? 0.7 : 1 }}>
            {submittingLeave ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
          My Requests ({leaveRequests.length})
        </div>
        {leaveRequests.length > 0 && (() => {
          const year = new Date().getFullYear();
          const yr = leaveRequests.filter(r => new Date(r.createdAt).getFullYear() === year);
          const approved = yr.filter(r => r.status === 'approved');
          const pending = yr.filter(r => r.status === 'pending');
          const rejected = yr.filter(r => r.status === 'rejected');
          const totalDays = approved.reduce((s, r) => s + (r.days || 0), 0);
          return (
            <div style={{ display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
              <span style={{ color: 'var(--text2)' }}>{year}</span>
              <span style={{ color: '#34c759' }}>{approved.length} approved</span>
              <span style={{ color: '#ff9f0a' }}>{pending.length} pending</span>
              <span style={{ color: '#ff3b30' }}>{rejected.length} rejected</span>
              <span style={{ color: 'var(--text2)' }}>{totalDays} days</span>
            </div>
          );
        })()}
        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
          {leaveRequests.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No requests yet.</div>
            : leaveRequests.map(r => (
              <Link key={r.id} href={`/leaves/${r.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{r.leaveType.toUpperCase()}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                      {r.unpaidDays > 0 && <span style={{ fontSize: '11px', color: 'var(--orange)', background: 'rgba(255,159,10,0.1)', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.unpaidDays} unpaid</span>}
                      {r.shiftSlot && <span style={{ fontSize: '11px', background: 'rgba(255,107,107,0.1)', color: '#d94a4a', padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{r.shiftSlot}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {r.approvalStage && r.status === 'pending' && <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} reviewerName={r.reviewerName} />}
                      {(!r.approvalStage || r.status !== 'pending') && statusBadge(r.status)}
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
              </Link>
            ))
          }
        </div>
      </div>
    </div>
  );
}
