"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { requestAdjustment, updatePunchTimes } from '../../../actions/attendanceChanges';
import { getWfhRequests } from '../../../actions/wfh';
import EmployeeModal from '../../../components/EmployeeModal';
import ClockWidget from '../../../components/ClockWidget';
import { useToast } from '../../../components/Toast';
import { useEmployeeData } from './context';
import { FiDownload } from 'react-icons/fi';

export default function AttendancePage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const { emp, rlHolidays } = useEmployeeData();
  const router = useRouter();
  const toast = useToast();

  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [hasWfhToday, setHasWfhToday] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!emp?.employeeType || emp.employeeType !== 'hybrid') {
      const today = new Date().toISOString().split('T')[0];
      getWfhRequests(code).then(requests => {
        const approved = requests.some(r =>
          r.status === 'approved' &&
          new Date(r.date).toISOString().split('T')[0] === today
        );
        setHasWfhToday(approved);
      }).catch(() => setHasWfhToday(false));
    } else {
      setHasWfhToday(true);
    }
  }, [emp, code]);

  if (!emp) return null;

  const showClockWidget = hasWfhToday || emp.employeeType === 'hybrid';

  const currentRecord = emp.records[selectedMonthIndex];
  const [month, year] = currentRecord.monthYear.split('_');
  const modalCurrentMonth = { month: parseInt(month), year: parseInt(year) };

  const formattedEmployee = {
    code: emp.code, name: emp.name,
    present: currentRecord.present, absent: currentRecord.absent,
    late: currentRecord.late, shortShift: currentRecord.shortShift,
    rl: currentRecord.rl,
    days: emp.dailyLogs.filter(log => log.monthYear === currentRecord.monthYear).map(dl => ({
      d: dl.day, type: dl.type, raw: dl.raw, inT: dl.inT, outT: dl.outT,
      isLate: dl.isLate, isSS: dl.isSS, isSL: dl.isSL, hdReason: dl.hdReason
    }))
  };

  const formatMonth = (my) => {
    const [m, y] = my.split('_');
    return new Date(y, parseInt(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
  };

  const handleAdjust = async (empCode, day, currentType, newType, reason) => {
    const monthYear = currentRecord.monthYear;
    const result = await requestAdjustment(empCode, monthYear, day, currentType, newType, reason, user?.username);
    if (result.error) return toast.error(result.error);
    if (result.warning) toast.warning(result.warning);
    toast.success('Adjustment request submitted for super admin approval.');
    return result;
  };

  const handlePunchUpdate = async (empCode, day, inTStr, outTStr, reason) => {
    const monthYear = currentRecord.monthYear;
    const result = await updatePunchTimes(empCode, monthYear, day, inTStr, outTStr, reason, user?.username);
    return result;
  };

  const downloadPDF = async (record, empData) => {
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
      const bx = 14 + col * cellW;

      let bg = [245, 245, 247], textCol = [29, 29, 31], label = '';
      if (info?.type === 'absent') { bg = [255, 235, 234]; textCol = [200, 50, 40]; label = 'A'; }
      else if (info?.type === 'present') { bg = [234, 248, 238]; label = 'P'; }
      else if (info?.type === 'holiday') { bg = [255, 245, 220]; label = 'H'; }
      else if (info?.type === 'wo') { bg = [240, 240, 240]; textCol = [180, 180, 180]; label = 'WO'; }
      else if (info?.type === 'rl') { bg = [240, 230, 250]; label = 'RL'; }
      else if (info?.type === 'half') { bg = [255, 245, 220]; label = 'HD'; }
      else if (['cl', 'sl', 'el', 'ul', 'sh'].includes(info?.type)) { bg = [230, 240, 255]; label = info.type.toUpperCase(); }
      else if (['wfh', 'wfm', 'wos'].includes(info?.type)) { bg = [240, 230, 250]; label = info.type.toUpperCase(); }
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
      <div style={{ marginBottom: '8px', padding: '0' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>{emp.name}</h1>
        <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px' }}>#{emp.code}</div>
      </div>
      {showClockWidget && <ClockWidget code={code} employeeType={emp.employeeType} />}
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
          {[
            { val: formattedEmployee.present, label: 'Present', color: 'var(--green)' },
            { val: formattedEmployee.absent, label: 'Absent', color: 'var(--red)' },
            { val: formattedEmployee.late, label: 'Late', color: 'var(--yellow)' },
            { val: formattedEmployee.shortShift, label: 'Short Shifts', color: 'var(--orange)' },
            { val: formattedEmployee.rl, label: 'RL', color: 'var(--purple)' },
          ].map(s => (
            <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontWeight: 700, color: s.color }}>{s.val}</span>
              <span>{s.label}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button className="btn btn-outline" style={{ fontSize: '10px', padding: '4px 10px' }}
            onClick={() => downloadPDF(currentRecord, emp)}>
            <FiDownload size={10} /> PDF
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <EmployeeModal
          employee={formattedEmployee}
          currentMonth={modalCurrentMonth}
          onClose={() => {}}
          readOnly={!isAdmin && !isSuperAdmin}
          onAdjust={isAdmin || isSuperAdmin ? handleAdjust : undefined}
          rlEligibleDays={rlHolidays}
          mode="inline"
          isAdmin={isAdmin || isSuperAdmin}
          onPunchUpdate={isAdmin || isSuperAdmin ? handlePunchUpdate : undefined}
        />
      </div>
    </div>
  );
}
