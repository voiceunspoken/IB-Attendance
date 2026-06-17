"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../../components/AuthProvider';
import { getEmployeeHistory, toggleOverride, clearAllOverrides } from '../../../actions/attendance';
import { updateEmployeeDetails, uploadAvatar, getAvatarUrl } from '../../../actions/employees';
import {
  getLeaveBalance, getLeaveRequests, submitLeaveRequest,
  getRegularizations, submitRegularization
} from '../../../actions/leave';
import { getUpcomingHolidays, getHolidays } from '../../../actions/holidays';
import { requestAttendanceCorrection } from '../../../actions/attendanceChanges';
import EmployeeModal from '../../../components/EmployeeModal';
import Modal from '../../../components/Modal';
import { useToast } from '../../../components/Toast';
import { FiCalendar, FiFileText, FiTool, FiDownload, FiSearch, FiArrowLeft, FiUser, FiUpload, FiCamera, FiAlertTriangle, FiSun } from 'react-icons/fi';

const LEAVE_LABELS = { cl: 'Casual Leave', sl: 'Sick Leave', el: 'Earned Leave', rl: 'Restricted Leave', sh: 'Short Leave', ul: 'Unpaid Leave' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b', ul: '#8e8e93' };


export default function EmployeeDashboard({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { isAuthenticated, isAdmin, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

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
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileBirthday, setProfileBirthday] = useState('');
  const [savingBirthday, setSavingBirthday] = useState(false);

  // Bulk override state
  const [bulkOverrideFrom, setBulkOverrideFrom] = useState('');
  const [bulkOverrideTo, setBulkOverrideTo] = useState('');
  const [bulkOverrideType, setBulkOverrideType] = useState('wfm');
  const [bulkOverrideModal, setBulkOverrideModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Regularization form
  const [regForm, setRegForm] = useState({ date: '', requestedIn: '', requestedOut: '', reason: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    (async () => {
    try {
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
        setProfileBirthday(data.birthday ? new Date(data.birthday).toISOString().split('T')[0] : '');
        let ov = {};
        data.overrides.forEach(o => { ov[`${data.code}_${o.day}`] = o.type; });
        setOverrides(ov);
        const restricted = allHolidays.filter(h => h.isRestricted || h.type === 'optional');
        const empBirthday = data.birthday ? { month: new Date(data.birthday).getMonth() + 1, day: new Date(data.birthday).getDate() } : null;
        setRlHolidays(restricted.map(h => ({ ...h, isBirthday: false })).concat(
          empBirthday ? [{ month: empBirthday.month, day: empBirthday.day, name: 'Birthday', type: 'optional', isBirthday: true }] : []
        ));
      }
      setLeaveBalance(balance);
      setLeaveBalanceDetail(balance);
      setLeaveRequests(requests);
      setRegularizations(regs);
      setUpcomingHolidays(holidays);
      try { const url = await getAvatarUrl(code); setAvatarUrl(url); } catch { setAvatarUrl(null); }
    } catch {
      setEmp(null);
      setOverrides({});
      setLeaveBalance(null);
      setLeaveBalanceDetail(null);
      setLeaveRequests([]);
      setRegularizations([]);
      setUpcomingHolidays([]);
    } finally {
      setLoading(false);
    }
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
  if (!emp || emp.records.length === 0) return (
    <div style={{ padding: '60px', textAlign: 'center' }}>
      <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25, color: 'var(--text3)' }}><FiSearch size={36} /></div>
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: 'var(--text2)' }}>Employee not found</div>
      <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>No employee matches this code or no records exist.</div>
      <Link href="/team" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}><FiArrowLeft size={14} /> Go Back</Link>
    </div>
  );

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

  // EL only available after 1 year from joining date
  const isELEligible = emp.joiningDate
    ? new Date(new Date(emp.joiningDate).getTime() + 365 * 24 * 60 * 60 * 1000) <= new Date()
    : false;
  const availableLeaveTypes = ['cl', 'sl', ...(isELEligible ? ['el'] : []), 'rl', 'sh'];

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
    if (result.error) return toast.error(result.error);
    toast.success('Correction request submitted for super admin approval.');
  };

  const handleBulkOverride = async () => {
    const f = parseInt(bulkOverrideFrom);
    const t = parseInt(bulkOverrideTo) || f;
    if (!f || isNaN(f)) return toast.error('Please enter a valid start date.');
    const dIM = new Date(modalCurrentMonth.year, modalCurrentMonth.month, 0).getDate();
    const start = Math.max(1, Math.min(f, dIM));
    const end = Math.max(start, Math.min(t, dIM));
    setBulkLoading(true);
    for (let d = start; d <= end; d++) {
      const info = formattedEmployee.days.find(x => x.d === d);
      if (info && info.type !== 'wo' && info.type !== 'holiday') {
        await handleApplyOverride(formattedEmployee.code, d, bulkOverrideType);
      }
    }
    setBulkLoading(false);
    setBulkOverrideFrom('');
    setBulkOverrideTo('');
    setBulkOverrideModal(false);
  };

  const handleSaveBirthday = async () => {
    setSavingBirthday(true);
    const result = await updateEmployeeDetails(code, { birthday: profileBirthday || null });
    setSavingBirthday(false);
    if (result.error) return toast.error(result.error);
    toast.success('Birthday saved.');
    setAvatarPreview(null);
    setAvatarFile(null);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = await uploadAvatar(code, e.target.result);
      setUploadingAvatar(false);
      if (result.error) return toast.error(result.error);
      setAvatarUrl(result.url);
      setAvatarPreview(null);
      setAvatarFile(null);
      toast.success('Profile picture updated.');
    };
    reader.readAsDataURL(avatarFile);
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

  const computeOverrideCounts = () => {
    let wfm = 0, wfmhd = 0, wfh = 0, wos = 0, woshd = 0;
    Object.keys(currentMonthOverrides).forEach(k => {
      const v = currentMonthOverrides[k];
      if (v === 'wfm') wfm++;
      else if (v === 'wfm-hd') wfmhd++;
      else if (v === 'wfh') wfh++;
      else if (v === 'wos') wos++;
      else if (v === 'wos-hd') woshd++;
    });
    return { wfm, wfmhd, wfh, wos, woshd };
  };
  const ovCounts = computeOverrideCounts();
  const kpiStats = [
    { val: formattedEmployee.present, label: 'Present', color: 'var(--green)' },
    { val: formattedEmployee.absent, label: 'Absent', color: 'var(--red)' },
    { val: formattedEmployee.late, label: 'Late', color: 'var(--yellow)' },
    { val: formattedEmployee.shortShift, label: 'Short Shifts', color: 'var(--orange)' },
    { val: ovCounts.wfm + ovCounts.wfmhd, label: 'WFM', color: 'var(--green)' },
    { val: ovCounts.wfh, label: 'WFH', color: 'var(--purple)' },
    { val: ovCounts.wos + ovCounts.woshd, label: 'WOS', color: 'var(--teal)' },
  ];

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
    <div className="page-wrapper animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Compact employee header */}
      <div style={{ padding: '10px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface3)', display: 'grid', placeItems: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text2)', flexShrink: 0, overflow: 'hidden' }}>
            {avatarUrl ? <Image src={avatarUrl} alt="" fill style={{ objectFit: 'cover' }} sizes="28px" /> : emp.name.charAt(0)}
          </div>
          <span style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.03em' }}>{emp.name}</span>
          <span style={{ fontSize: '10px', color: 'var(--text2)', fontFamily: 'monospace' }}>#{emp.code}</span>
          {emp.employeeType && emp.employeeType !== 'regular' && (
            <span style={{ background: emp.employeeType === 'wfh' ? 'rgba(175,82,222,0.1)' : 'rgba(52,199,89,0.1)', color: emp.employeeType === 'wfh' ? 'var(--purple)' : 'var(--green)', padding: '1px 6px', borderRadius: '980px', fontSize: '9px', fontWeight: 600 }}>{emp.employeeType.toUpperCase()}</span>
          )}
          {emp.department && <span style={{ fontSize: '10px', background: 'rgba(0,113,227,0.08)', color: 'var(--blue)', padding: '1px 6px', borderRadius: '980px', fontWeight: 500 }}>{emp.department.name}</span>}
          {emp.designation && <span style={{ fontSize: '10px', background: 'var(--surface2)', color: 'var(--text2)', padding: '1px 6px', borderRadius: '980px', fontWeight: 500 }}>{emp.designation.name}</span>}
          {emp.managers && emp.managers.length > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--text3)' }}>· {emp.managers.map(m => m.name).join(', ')}</span>
          )}
        </div>

        {/* Leave balance + upcoming holidays — inline */}
        {leaveBalance && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {availableLeaveTypes.map(type => {
              const avail = leaveBalance[`${type}Avail`] ?? 0;
              const total = leaveBalance[`${type}Total`] ?? 0;
              return (
                <span key={type} style={{ fontSize: '11px', color: 'var(--text2)' }}>
                  <span style={{ fontWeight: 600, color: LEAVE_COLORS[type] }}>{type.toUpperCase()}</span> {avail}/{total}
                </span>
              );
            })}
            {upcomingHolidays.length > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text3)', marginLeft: '2px' }}>
                · {upcomingHolidays.slice(0, 3).map(h => h.name).join(', ')}{upcomingHolidays.length > 3 ? ` +${upcomingHolidays.length - 3}` : ''}
              </span>
            )}
          </div>
        )}
      </div>
      

      {/* ── SIDEBAR + CONTENT ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '18px', alignItems: 'start', marginTop: '20px' }}>
          <div className="card" style={{ padding: '6px' }}>
            {[
              { key: 'attendance', label: 'Attendance', icon: <FiCalendar size={14} /> },
              { key: 'leaves', label: 'Leave Requests', icon: <FiFileText size={14} /> },
              { key: 'regularize', label: 'Regularization', icon: <FiTool size={14} /> },
              { key: 'profile', label: 'Profile', icon: <FiUser size={14} /> },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                width: '100%', padding: '10px 14px', borderRadius: '7px', fontSize: '13px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: 500,
                background: tab === t.key ? 'var(--surface)' : 'transparent',
                color: tab === t.key ? 'var(--text)' : 'var(--text2)',
                boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.12s',
                display: 'flex', alignItems: 'center', gap: '8px',
                borderLeft: tab === t.key ? '3px solid var(--blue)' : '3px solid transparent',
              }}>{t.icon} {t.label}</button>
            ))}
          </div>

          <div>
            {/* ── ATTENDANCE TAB ── */}
            {tab === 'attendance' && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => setSelectedMonthIndex(Math.max(0, selectedMonthIndex - 1))}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text2)', fontSize: '12px', lineHeight: 1 }}
                      disabled={selectedMonthIndex === 0}>◀</button>
                    <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.03em' }}>
                      {formatMonth(currentRecord.monthYear)}
                    </span>
                    <button onClick={() => setSelectedMonthIndex(Math.min(emp.records.length - 1, selectedMonthIndex + 1))}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text2)', fontSize: '12px', lineHeight: 1 }}
                      disabled={selectedMonthIndex === emp.records.length - 1}>▶</button>
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-evenly', fontSize: '11px', color: 'var(--text2)' }}>
                    {kpiStats.map(s => (
                      <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ fontWeight: 700, color: s.color }}>{s.val}</span>
                        <span>{s.label}</span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {isAdmin && (
                      <button className="btn btn-secondary" style={{ fontSize: '10px', padding: '4px 10px' }}
                        onClick={() => setBulkOverrideModal(true)}>
                        Override
                      </button>
                    )}
                    <button className="btn btn-outline" style={{ fontSize: '10px', padding: '4px 10px' }}
                      onClick={() => downloadPDF(currentRecord, emp, currentMonthOverrides)}>
                      <FiDownload size={10} /> PDF
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
                    mode="inline"
                  />
                </div>

                <Modal open={bulkOverrideModal} onClose={() => setBulkOverrideModal(false)} title="Manual Override" width="420px">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label className="input-label">From Date</label>
                        <input type="number" min="1" max="31" placeholder="5" value={bulkOverrideFrom}
                          onChange={e => setBulkOverrideFrom(e.target.value)} className="input-field"
                          style={{ padding: '8px 10px' }} />
                      </div>
                      <div>
                        <label className="input-label">To Date</label>
                        <input type="number" min="1" max="31" placeholder="same" value={bulkOverrideTo}
                          onChange={e => setBulkOverrideTo(e.target.value)} className="input-field"
                          style={{ padding: '8px 10px' }} />
                      </div>
                    </div>
                    <div>
                      <label className="input-label">Type</label>
                      <select value={bulkOverrideType} onChange={e => setBulkOverrideType(e.target.value)}
                        className="input-field" style={{ padding: '8px 10px' }}>
                        <option value="wfm">WFM — Full Day</option>
                        <option value="wfm-hd">WFM — Half Day</option>
                        <option value="wfh">WFH</option>
                        <option value="wos">WOS — Full Day</option>
                        <option value="wos-hd">WOS — Half Day</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button className="btn btn-primary" style={{ flex: 1, padding: '9px', opacity: bulkLoading ? 0.7 : 1 }}
                        disabled={bulkLoading}
                        onClick={() => handleBulkOverride()}>{bulkLoading ? 'Applying…' : 'Apply'}</button>
                      <button className="btn btn-secondary" style={{ flex: 1, padding: '9px' }}
                        onClick={() => { setBulkOverrideModal(false); }}>Cancel</button>
                    </div>
                  </div>
                </Modal>
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
                  {/* Balance warning */}
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
                        <div>{slot === '10-12' ? <><FiSun size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> 10:00 AM – 12:00 PM</> : <><FiSun size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> 5:00 PM – 7:00 PM</>}</div>
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
            {availableLeaveTypes.map(type => {
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
                        <FiAlertTriangle size={11} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> {r.sandwichCount === 1 ? '1st sandwich' : `${r.sandwichCount} sandwich`} leave
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
              {tab === 'profile' && (
                <div className="card" style={{ padding: '22px 24px', maxWidth: '500px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>My Profile</div>

                  {/* Read-only info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', background: 'var(--surface2)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text2)' }}>Name</span>
                      <span style={{ fontWeight: 600 }}>{emp.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text2)' }}>Code</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>#{emp.code}</span>
                    </div>
                    {emp.department && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text2)' }}>Department</span>
                      <span style={{ fontWeight: 600 }}>{emp.department.name}</span>
                    </div>}
                    {emp.designation && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text2)' }}>Designation</span>
                      <span style={{ fontWeight: 600 }}>{emp.designation.name}</span>
                    </div>}
                  </div>

                  {/* Birthday */}
                  <div style={{ marginBottom: '20px' }}>
                    <label className="input-label">Birthday</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px' }}>
                      <input className="input-field" type="date" style={{ flex: 1, padding: '8px 12px' }}
                        value={profileBirthday}
                        onChange={e => setProfileBirthday(e.target.value)} />
                      <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '13px', opacity: savingBirthday ? 0.7 : 1 }}
                        disabled={savingBirthday}
                        onClick={handleSaveBirthday}>{savingBirthday ? 'Saving…' : 'Save'}</button>
                    </div>
                  </div>

                  {/* Avatar upload */}
                  <div>
                    <label className="input-label">Profile Picture</label>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '8px' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--surface3)', display: 'grid', placeItems: 'center', fontSize: '20px', fontWeight: 700, color: 'var(--text2)', overflow: 'hidden', flexShrink: 0 }}>
                        {avatarUrl ? <Image src={avatarUrl} alt="" fill style={{ objectFit: 'cover' }} sizes="56px" /> : <FiCamera size={20} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <input type="file" accept="image/png,image/jpeg,image/webp" style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setAvatarFile(f);
                              const reader = new FileReader();
                              reader.onload = () => setAvatarPreview(reader.result);
                              reader.readAsDataURL(f);
                            }
                          }} />
                        {avatarPreview && <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '6px' }}>Preview ready</div>}
                        <button className="btn btn-outline" style={{ padding: '6px 14px', fontSize: '12px', opacity: uploadingAvatar ? 0.7 : 1 }}
                          disabled={!avatarFile || uploadingAvatar}
                          onClick={handleUploadAvatar}>{uploadingAvatar ? 'Uploading…' : <><FiUpload size={12} style={{ marginRight: '4px' }} /> Upload</>}</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
