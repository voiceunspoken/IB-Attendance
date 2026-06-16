"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { getEmployeeHistory, toggleOverride, clearAllOverrides } from '../../../actions/attendance';
import {
  getLeaveBalance, getLeaveRequests, submitLeaveRequest,
  getRegularizations, submitRegularization
} from '../../../actions/leave';
import { getUpcomingHolidays, getHolidays } from '../../../actions/holidays';
import { requestAttendanceCorrection } from '../../../actions/attendanceChanges';
import EmployeeModal from '../../../components/EmployeeModal';

const LEAVE_LABELS = { cl: 'Casual Leave', sl: 'Sick Leave', el: 'Earned Leave', rl: 'Restricted Leave', sh: 'Short Leave' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b' };

export default function EmployeeDashboard({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { isAuthenticated, isAdmin, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [emp, setEmp] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [, setOverrides] = useState({});
  const [tab, setTab] = useState('attendance'); // attendance | leaves | regularize

  // Leave state
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [regularizations, setRegularizations] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'cl', fromDate: '', toDate: '', days: 1, reason: '', shiftSlot: '10-12' });
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [sandwichWarning, setSandwichWarning] = useState('');
  const [rlHolidays, setRlHolidays] = useState([]);
  const [leaveBalanceDetail, setLeaveBalanceDetail] = useState(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Regularization form
  const [regForm, setRegForm] = useState({ date: '', requestedIn: '', requestedOut: '', reason: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && user?.employeeCode && user.employeeCode !== code) {
      router.push(`/employee/${user.employeeCode}`);
    }
    if (isAdmin) setTab('attendance');
  }, [isAuthenticated, isAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    (async () => {
    const year = new Date().getFullYear();
    const [data, balance, requests, regs, holidays, allHolidays] = await Promise.all([
      getEmployeeHistory(code),
      getLeaveBalance(code, year),
      getLeaveRequests(code),
      getRegularizations(code),
      getUpcomingHolidays(),
      getHolidays(year)
    ]);
    if (data) {
      setEmp(data);
      let ov = {};
      data.overrides.forEach(o => { ov[`${data.code}_${o.day}`] = o.type; });
      setOverrides(ov);
      // RL-eligible dates: restricted holidays + birthday
      const restricted = allHolidays.filter(h => h.isRestricted || h.type === 'optional');
      const empBirthday = data.birthday ? { month: new Date(data.birthday).getMonth() + 1, day: new Date(data.birthday).getDate() } : null;
      setRlHolidays(restricted.map(h => ({ ...h, isBirthday: false })).concat(
        empBirthday ? [{ month: empBirthday.month, day: empBirthday.day, name: '🎂 Birthday', type: 'optional', isBirthday: true }] : []
      ));
    }
    setLeaveBalance(balance);
    setLeaveBalanceDetail(balance);
    setLeaveRequests(requests);
    setRegularizations(regs);
    setUpcomingHolidays(holidays);
    setLoading(false);
    })();
  }, [isAuthenticated, code, fetchTrigger]);

  // Detect Fri+Mon span for sandwich warning
  useEffect(() => {
    if (!leaveForm.fromDate) return setSandwichWarning('');
    const from = new Date(leaveForm.fromDate);
    const to = leaveForm.toDate ? new Date(leaveForm.toDate) : from;
    if (from > to) return setSandwichWarning('');
    const fromDay = from.getDay();
    const toDay = to.getDay();
    // Sandwich = Thu/Fri start → Sat+Sun → Mon/Tue end
    const isSandwich = (fromDay <= 5 && toDay >= 1 && toDay <= 2) && (to.getTime() - from.getTime()) > 86400000 * 2;
    if (isSandwich && (leaveForm.leaveType === 'cl' || leaveForm.leaveType === 'el')) {
      setSandwichWarning('⚠ This period spans a weekend (Fri–Mon). If approved, weekend days may be counted as sandwich leave.');
    } else {
      setSandwichWarning('');
    }
  }, [leaveForm.fromDate, leaveForm.toDate, leaveForm.leaveType]);

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setLeaveError(''); setLeaveSuccess('');
    if (!leaveForm.fromDate) return setLeaveError('Please select a start date.');
    if (!leaveForm.reason.trim()) return setLeaveError('Please provide a reason.');
    setSubmittingLeave(true);
    const result = await submitLeaveRequest(code, {
      ...leaveForm,
      toDate: leaveForm.toDate || leaveForm.fromDate,
      days: parseFloat(leaveForm.days) || 1,
      prescriptionFile: leaveForm.leaveType === 'sl' ? prescriptionFile : null,
      shiftSlot: leaveForm.leaveType === 'sh' ? leaveForm.shiftSlot : null
    });
    setSubmittingLeave(false);
    if (result.error) return setLeaveError(result.error);
    setLeaveSuccess('Leave request submitted successfully.');
    setLeaveForm({ leaveType: 'cl', fromDate: '', toDate: '', days: 1, reason: '', shiftSlot: '10-12' });
    setPrescriptionFile(null);
    setFetchTrigger(t => t + 1);
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
    setFetchTrigger(t => t + 1);
  };

  if (authLoading || !isAuthenticated) return null;
  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>;
  if (!emp || emp.records.length === 0) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--red)', fontSize: '14px' }}>Employee not found.</div>;

  const currentRecord = emp.records[selectedMonthIndex];
  const [month, year] = currentRecord.monthYear.split('_');
  const modalCurrentMonth = { month: parseInt(month), year: parseInt(year) };

  const formattedEmployee = {
    code: emp.code, name: emp.name,
    present: currentRecord.present, absent: currentRecord.absent,
    late: currentRecord.late, shortShift: currentRecord.shortShift,
    days: emp.dailyLogs.filter(log => log.monthYear === currentRecord.monthYear).map(dl => ({
      d: dl.day, type: dl.type, raw: dl.raw, inT: dl.inT, outT: dl.outT,
      isLate: dl.isLate, isSS: dl.isSS, isSL: dl.isSL, hdReason: dl.hdReason
    }))
  };

  const currentMonthOverrides = {};
  emp.overrides.filter(o => o.monthYear === currentRecord.monthYear)
    .forEach(o => { currentMonthOverrides[`${emp.code}_${o.day}`] = o.type; });

  const handleApplyOverride = async (empCode, day, type) => {
    setOverrides(prev => {
      const n = { ...prev };
      if (type === 'clear') delete n[`${empCode}_${day}`];
      else n[`${empCode}_${day}`] = type;
      return n;
    });
    setEmp(prev => {
      const p = { ...prev };
      if (type === 'clear') p.overrides = p.overrides.filter(o => !(o.day === day && o.monthYear === currentRecord.monthYear));
      else {
        const existing = p.overrides.find(o => o.day === day && o.monthYear === currentRecord.monthYear);
        if (existing) existing.type = type;
        else p.overrides.push({ day, monthYear: currentRecord.monthYear, type });
      }
      return p;
    });
    await toggleOverride(code, currentRecord.monthYear, day, type);
  };

  const handleRemoveOverride = (empCode, day) => handleApplyOverride(empCode, day, 'clear');
  const handleClearAllOverrides = async () => {
    setEmp(prev => ({ ...prev, overrides: prev.overrides.filter(o => o.monthYear !== currentRecord.monthYear) }));
    setOverrides({});
    await clearAllOverrides(code, currentRecord.monthYear);
  };

  const handleProposeCorrection = async (empCode, day, currentType, newType, reason) => {
    const monthYear = currentRecord.monthYear;
    const result = await requestAttendanceCorrection(empCode, monthYear, day, currentType, newType, reason, user.username);
    if (result.error) return alert(result.error);
    alert('Correction request submitted for super admin approval.');
  };

  const formatMonth = (my) => {
    const [m, y] = my.split('_');
    return new Date(y, parseInt(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
  };

  const statusBadge = (status) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b' }
    };
    const s = map[status] || map.pending;
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
  };

  const avgAbsent = (emp.records.reduce((s, r) => s + r.absent, 0) / emp.records.length).toFixed(1);

  const StageBadge = ({ stage }) => {
    const map = {
      pending_l2: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'L2 Pending' },
      pending_l1: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'L1 Pending' },
      pending_super: { bg: 'rgba(175,82,222,0.1)', color: '#7b2d8b', label: 'Super Pending' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
    };
    const s = map[stage] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: stage };
    return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const downloadPDF = async (record, empData, ovs) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const [mo, yr] = record.monthYear.split('_');
    const monthLabel = new Date(yr, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    // Header
    doc.setFillColor(29, 29, 31);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Interactive Bees', 14, 12);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Attendance Report', 14, 20);
    doc.text(monthLabel, 196, 12, { align: 'right' });

    // Employee info
    doc.setTextColor(29, 29, 31);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(empData.name, 14, 40);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 115);
    doc.text(`Employee Code: ${empData.code}`, 14, 47);

    // Stats grid
    const stats = [
      ['Present', record.present, '#34c759'],
      ['Absent', record.absent, '#ff3b30'],
      ['Late Marks', record.late, '#ff9f0a'],
      ['Half Days', record.halfDay, '#ff9f0a'],
      ['HD (Late)', record.lateHD, '#ff6b35'],
      ['Short Shifts', record.shortShift, '#ff6b35'],
      ['HD (SS)', record.ssHD, '#ff3b30'],
      ['Short Leave', record.shortLeave, '#0071e3'],
    ];

    let x = 14, y = 58;
    stats.forEach(([label, value], i) => {
      if (i > 0 && i % 4 === 0) { x = 14; y += 22; }
      const bx = x + (i % 4) * 48;
      doc.setFillColor(245, 245, 247);
      doc.roundedRect(bx, y, 44, 18, 3, 3, 'F');
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.setTextColor(29, 29, 31);
      doc.text(String(value), bx + 22, y + 9, { align: 'center' });
      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 115);
      doc.text(label.toUpperCase(), bx + 22, y + 15, { align: 'center' });
    });

    // Calendar
    y += 30;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.setTextColor(29, 29, 31);
    doc.text('Daily Attendance', 14, y);
    y += 6;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cellW = 26, cellH = 10;
    dayNames.forEach((d, i) => {
      doc.setFillColor(232, 232, 237);
      doc.rect(14 + i * cellW, y, cellW, cellH, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.setTextColor(110, 110, 115);
      doc.text(d, 14 + i * cellW + cellW / 2, y + 7, { align: 'center' });
    });
    y += cellH;

    const firstDow = new Date(parseInt(yr), parseInt(mo) - 1, 1).getDay();
    const daysInMonth = new Date(parseInt(yr), parseInt(mo), 0).getDate();
    const dayMap = {};
    formattedEmployee.days.forEach(d => dayMap[d.d] = d);

    let col = firstDow;
    for (let d = 1; d <= daysInMonth; d++) {
      const info = dayMap[d];
      const ov = ovs[`${empData.code}_${d}`];
      const bx = 14 + col * cellW;

      let bg = [245, 245, 247], textCol = [29, 29, 31], label = '';
      if (ov) { bg = [52, 199, 89, 0.2]; bg = [220, 245, 225]; label = ov.toUpperCase(); }
      else if (info?.type === 'absent') { bg = [255, 235, 234]; textCol = [200, 50, 40]; label = 'A'; }
      else if (info?.type === 'present') { bg = [234, 248, 238]; label = 'P'; }
      else if (info?.type === 'holiday') { bg = [255, 245, 220]; label = 'H'; }
      else if (info?.type === 'wo') { bg = [240, 240, 240]; textCol = [180, 180, 180]; label = 'WO'; }
      else if (info?.type === 'rl') { bg = [240, 230, 250]; label = 'RL'; }
      else if (info?.type === 'half') { bg = [255, 245, 220]; label = 'HD'; }
      if (info?.isLate) label = 'L';
      if (info?.isSS) label = 'SS';

      doc.setFillColor(...bg);
      doc.rect(bx, y, cellW, cellH, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textCol);
      doc.text(String(d), bx + 4, y + 6);
      doc.setFontSize(6); doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 115);
      doc.text(label, bx + cellW - 3, y + 6, { align: 'right' });

      col++;
      if (col === 7) { col = 0; y += cellH; }
    }

    // Footer
    doc.setFontSize(8); doc.setTextColor(180, 180, 180);
    doc.text(`Generated on ${new Date().toLocaleDateString()} · IB Attendance Portal`, 105, 285, { align: 'center' });

    doc.save(`Attendance_${empData.code}_${record.monthYear}.pdf`);
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">

      {/* Profile header */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--surface3)', display: 'grid', placeItems: 'center', fontSize: '22px', fontWeight: 700, color: 'var(--text2)' }}>
              {emp.name.charAt(0)}
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em' }}>{emp.name}</h1>
              <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                Employee #{emp.code}
                {emp.employeeType && emp.employeeType !== 'regular' && (
                  <span style={{ background: emp.employeeType === 'wfh' ? 'rgba(175,82,222,0.1)' : 'rgba(52,199,89,0.1)', color: emp.employeeType === 'wfh' ? 'var(--purple)' : 'var(--green)', padding: '1px 8px', borderRadius: '980px', fontSize: '11px', fontWeight: 600 }}>{emp.employeeType.toUpperCase()}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                {emp.department && <span style={{ fontSize: '12px', background: 'rgba(0,113,227,0.08)', color: 'var(--blue)', padding: '2px 10px', borderRadius: '980px', fontWeight: 500 }}>{emp.department.name}</span>}
                {emp.designation && <span style={{ fontSize: '12px', background: 'var(--surface2)', color: 'var(--text2)', padding: '2px 10px', borderRadius: '980px', fontWeight: 500 }}>{emp.designation.name}</span>}
                {emp.managers && emp.managers.length > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 500 }}>
                    Manager{emp.managers.length > 1 ? 's' : ''}: {emp.managers.map(m => m.name).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[
              { label: 'Months Tracked', value: emp.records.length, color: 'var(--text)' },
              { label: 'Avg Absent / mo', value: avgAbsent, color: parseFloat(avgAbsent) >= 3 ? 'var(--red)' : 'var(--text)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.04em', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave balance strip */}
        {leaveBalance && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            {['cl', 'sl', 'el', 'rl', 'sh'].map(type => {
              const avail = leaveBalance[`${type}Avail`] ?? 0;
              const total = leaveBalance[`${type}Total`] ?? 0;
              const used = leaveBalance[`${type}Used`] ?? 0;
              const pct = total > 0 ? Math.max(0, Math.min(100, (avail / total) * 100)) : 0;
              return (
                <div key={type} style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{LEAVE_LABELS[type]}</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: LEAVE_COLORS[type] }}>{avail}</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--surface3)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: LEAVE_COLORS[type], borderRadius: '2px', transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '5px' }}>
                {used} used · {total} total
                {type === 'cl' && leaveBalance.clAccrued != null && <span> · {leaveBalance.clAccrued} accrued</span>}
                {type === 'el' && leaveBalance.elAccrued != null && <span> · {leaveBalance.elAccrued} accrued</span>}
                {type === 'sl' && leaveBalance.slTotal != null && <span> · {leaveBalance.slTotal} allotted</span>}
                {type === 'rl' && leaveBalance.rlTotal != null && <span> · {leaveBalance.rlTotal} allotted</span>}
                {type === 'sh' && leaveBalance.shTotal != null && <span> · {leaveBalance.shTotal} allotted</span>}
              </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upcoming holidays */}
        {upcomingHolidays.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Upcoming Holidays</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {upcomingHolidays.map(h => (
                <span key={h.id} style={{ fontSize: '12px', background: 'rgba(255,159,10,0.1)', color: '#b36200', padding: '4px 10px', borderRadius: '980px', fontWeight: 500 }}>
                  🎉 {h.name} — {new Date(h.year, h.month - 1, h.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs — only employee sees leaves/regularize; admin sees only attendance */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '20px', width: 'fit-content' }}>
        {[
          { key: 'attendance', label: 'Attendance' },
          ...(!isAdmin ? [
            { key: 'leaves', label: 'Leave Requests' },
            { key: 'regularize', label: 'Regularization' },
          ] : []),
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

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', alignItems: 'start' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {emp.records.map((r, i) => (
                <button key={r.id} onClick={() => setSelectedMonthIndex(i)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', borderRadius: '9px', cursor: 'pointer', textAlign: 'left',
                  border: selectedMonthIndex === i ? '1px solid rgba(0,113,227,0.3)' : '1px solid transparent',
                  background: selectedMonthIndex === i ? 'var(--blue-light)' : 'transparent',
                  color: selectedMonthIndex === i ? 'var(--blue)' : 'var(--text2)',
                  fontFamily: 'inherit', fontSize: '13px', fontWeight: selectedMonthIndex === i ? 600 : 400, transition: 'all 0.15s'
                }}>
                  <span>{formatMonth(r.monthYear)}</span>
                  <span style={{ fontSize: '11px', display: 'flex', gap: '4px' }}>
                    {r.absent > 0 && <span style={{ color: 'var(--red)' }}>{r.absent}A</span>}
                    {r.late > 0 && <span style={{ color: 'var(--yellow)' }}>{r.late}L</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.03em' }}>
                {formatMonth(currentRecord.monthYear)}
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={() => downloadPDF(currentRecord, emp, currentMonthOverrides)}
              >
                ↓ Download PDF
              </button>
            </div>
            <div style={{ position: 'relative', height: '760px', overflow: 'hidden' }}>
              <style>{`.emp-inline > div { position: absolute !important; inset: 0 !important; background: transparent !important; backdrop-filter: none !important; } .emp-inline > div > div { width: 100% !important; max-width: 100% !important; height: 100% !important; border: none !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; }`}</style>
              <div className="emp-inline">
                <EmployeeModal
                  employee={formattedEmployee}
                  currentMonth={modalCurrentMonth}
                  overrides={currentMonthOverrides}
                  onClose={() => {}}
                  onApplyOverride={handleApplyOverride}
                  onRemoveOverride={handleRemoveOverride}
                  onClearAllOverrides={handleClearAllOverrides}
                  readOnly={!isAdmin}
                  onProposeCorrection={isAdmin ? handleProposeCorrection : undefined}
                  rlEligibleDays={rlHolidays}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LEAVE REQUESTS TAB ── */}
      {tab === 'leaves' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          {/* Apply form */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>Apply for Leave</div>
            <form onSubmit={handleSubmitLeave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Leave Type</label>
                  <select className="input-field" value={leaveForm.leaveType} onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value, shiftSlot: '10-12' }))}>
                    <option value="cl">Casual Leave (CL) — 12 days/yr</option>
                    <option value="sl">Sick Leave (SL) — 6 days/yr</option>
                    <option value="el">Earned Leave (EL) — 4 days/yr</option>
                    <option value="rl">Restricted Holiday (RL) — 2 days/yr</option>
                    <option value="sh">Short Leave (SH) — 2 hrs · every 2 months</option>
                  </select>
              </div>

              {/* RL: show eligible dates */}
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

              {/* SL: prescription upload */}
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
                  {prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '4px' }}>✓ Prescription uploaded</div>}
                </div>
              )}

              {/* SH: shift slot selector */}
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
                        <div>{slot === '10-12' ? '🌅 10:00 AM – 12:00 PM' : '🌆 5:00 PM – 7:00 PM'}</div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">From Date</label>
                  <input className="input-field" type="date" value={leaveForm.fromDate} onChange={e => setLeaveForm(f => ({ ...f, fromDate: e.target.value, toDate: f.toDate || e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">To Date</label>
                  <input className="input-field" type="date" value={leaveForm.toDate} onChange={e => setLeaveForm(f => ({ ...f, toDate: e.target.value }))} />
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

              {/* Sandwich warning */}
              {sandwichWarning && (
                <div style={{ background: 'rgba(255,159,10,0.1)', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', color: '#b36200', fontWeight: 500 }}>
                  {sandwichWarning}
                </div>
              )}

              {/* Leave balance breakdown */}
              {leaveBalanceDetail && (
                <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['cl', 'sl', 'el', 'rl', 'sh'].map(type => {
                    const avail = leaveBalanceDetail[`${type}Avail`] ?? 0;
                    const total = leaveBalanceDetail[`${type}Total`] ?? 0;
                    const used = leaveBalanceDetail[`${type}Used`] ?? 0;
                    return (
                      <div key={type} style={{ borderLeft: `3px solid ${LEAVE_COLORS[type]}`, paddingLeft: '8px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '11px', textTransform: 'uppercase' }}>{type}</div>
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

          {/* Request history */}
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
                        {r.approvalStage && r.status === 'pending' && <StageBadge stage={r.approvalStage} />}
                        {statusBadge(r.status)}
                      </div>
                    </div>
                    {r.sandwichCount > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--orange)', marginBottom: '2px', fontWeight: 500 }}>
                        🥪 {r.sandwichCount === 1 ? '1st sandwich' : `${r.sandwichCount} sandwich`} leave
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{r.reason}</div>
                    {r.prescriptionFile && <div style={{ fontSize: '11px', color: 'var(--blue)', marginTop: '2px' }}>📎 Prescription attached</div>}
                    {r.reviewNote && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontStyle: 'italic' }}>Note: {r.reviewNote}</div>}
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── REGULARIZATION TAB ── */}
      {tab === 'regularize' && (
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
      )}
    </div>
  );
}
