"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { toggleOverride, clearAllOverrides } from '../../../actions/attendance';
import { requestAttendanceCorrection } from '../../../actions/attendanceChanges';
import EmployeeModal from '../../../components/EmployeeModal';
import Modal from '../../../components/Modal';
import { useToast } from '../../../components/Toast';
import { useEmployeeData } from './context';
import { FiDownload } from 'react-icons/fi';

export default function AttendancePage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { isAuthenticated, isAdmin, user, loading: authLoading } = useAuth();
  const { emp, rlHolidays, setEmp } = useEmployeeData();
  const router = useRouter();
  const toast = useToast();

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [bulkOverrideFrom, setBulkOverrideFrom] = useState('');
  const [bulkOverrideTo, setBulkOverrideTo] = useState('');
  const [bulkOverrideType, setBulkOverrideType] = useState('wfm');
  const [bulkOverrideModal, setBulkOverrideModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, user, authLoading, router, code]);

  if (!emp) return null;

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

  const formatMonth = (my) => {
    const [m, y] = my.split('_');
    return new Date(y, parseInt(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
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

  const handleApplyOverride = async (empCode, day, type) => {
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
    await clearAllOverrides(code, currentRecord.monthYear);
  };

  const handleProposeCorrection = async (empCode, day, currentType, newType, reason) => {
    const monthYear = currentRecord.monthYear;
    const result = await requestAttendanceCorrection(empCode, monthYear, day, currentType, newType, reason, user?.username);
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

  const downloadPDF = async (record, empData, ovs) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const [mo, yr] = record.monthYear.split('_');
    const monthLabel = new Date(yr, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

    doc.setFillColor(29, 29, 31);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('Interactive Bees', 14, 12);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Attendance Report', 14, 20);
    doc.text(monthLabel, 196, 12, { align: 'right' });

    doc.setTextColor(29, 29, 31);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(empData.name, 14, 40);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 115);
    doc.text(`Employee Code: ${empData.code}`, 14, 47);

    const stats = [
      ['Present', record.present, '#34c759'], ['Absent', record.absent, '#ff3b30'],
      ['Late Marks', record.late, '#ff9f0a'], ['Half Days', record.halfDay, '#ff9f0a'],
      ['HD (Late)', record.lateHD, '#ff6b35'], ['Short Shifts', record.shortShift, '#ff6b35'],
      ['HD (SS)', record.ssHD, '#ff3b30'], ['Short Leave', record.shortLeave, '#0071e3'],
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
      if (ov) { bg = [220, 245, 225]; label = ov.toUpperCase(); }
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

    doc.setFontSize(8); doc.setTextColor(180, 180, 180);
    doc.text(`Generated on ${new Date().toLocaleDateString()} · IB Attendance Portal`, 105, 285, { align: 'center' });

    doc.save(`Attendance_${empData.code}_${record.monthYear}.pdf`);
  };

  return (
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
  );
}
