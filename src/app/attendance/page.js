"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import UploadSection from '../../components/UploadSection';
import EmployeeTable from '../../components/EmployeeTable';
import * as XLSX from 'xlsx';
import { parseAndAnalyze } from '../../utils/attendanceParser';
import { getMonths, uploadMonthData, fetchDashboardData } from '../../actions/attendance';
import { getActiveShiftPolicy } from '../../actions/shiftPolicy';
import { getHolidays } from '../../actions/holidays';
import { getWorkingSaturdays } from '../../actions/workingSaturdays';
import { getDepartments } from '../../actions/departments';
import { getCombinedReportData } from '../../actions/reports';
import { FiSearch, FiDownload, FiUpload, FiChevronDown, FiX, FiCheck, FiFileText } from 'react-icons/fi';
import { useToast } from '../../components/Toast';

export default function AttendancePage() {
  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();
  const toast = useToast();

  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [allResults, setAllResults] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [filteredResults, setFilteredResults] = useState([]);
  const [uploadView, setUploadView] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSubDept, setSelectedSubDept] = useState('');
  const [currentFilter, setCurrentFilter] = useState('all');

  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, isSuperAdmin, authLoading, router]);

  const loadData = useCallback(async (monthYear) => {
    setLoading(true);
    try {
      const data = await fetchDashboardData(monthYear);
      setAllResults(data);
      let ov = {};
      data.forEach(r => { ov = { ...ov, ...r.overrides }; });
      setOverrides(ov);
      setSelectedDept('');
      setSelectedSubDept('');
      setCurrentFilter('all');
      setSearchQuery('');
      setCurrentPage(1);
    } catch {
      setAllResults([]);
      setOverrides({});
    } finally {
      setLoading(false);
      setUploadView(false);
    }
  }, []);

  const loadMonthsList = useCallback(async () => {
    setLoading(true);
    try {
      const m = await getMonths();
      setMonths(m);
      if (m.length > 0) {
        setSelectedMonth(m[0]);
        await loadData(m[0]);
      } else {
        setUploadView(true);
      }
    } catch {
      setMonths([]);
    } finally {
      setLoading(false);
    }
  }, [loadData]);

  useEffect(() => {
    if (isAuthenticated) {
      getDepartments().then(setDepartments).catch(() => setDepartments([]));
      loadMonthsList();
    }
  }, [isAuthenticated, loadMonthsList]);

  const handleMonthChange = async (e) => {
    const val = e.target.value;
    setSelectedMonth(val);
    await loadData(val);
  };

  const subDepartments = useMemo(() => {
    if (!selectedDept) return [];
    const subs = new Set();
    allResults.forEach(r => {
      if (r.department === selectedDept && r.subDepartment) subs.add(r.subDepartment);
    });
    return [...subs].sort();
  }, [selectedDept, allResults]);

  useEffect(() => {
    if (!allResults.length) { setFilteredResults([]); return; }
    const q = searchQuery.toLowerCase();
    const filtered = allResults.filter(r => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || String(r.code).includes(q);
      const matchDept = !selectedDept || r.department === selectedDept;
      const matchSubDept = !selectedSubDept || r.subDepartment === selectedSubDept;

      let wfm = 0, wfmhd = 0, wfh = 0, wos = 0, woshd = 0, wfo = 0, wfohd = 0;
      Object.keys(overrides).forEach(k => {
        if (k.startsWith(r.code + '_')) {
          if (overrides[k] === 'wfm') wfm++;
          else if (overrides[k] === 'wfm-hd') wfmhd++;
          else if (overrides[k] === 'wfh') wfh++;
          else if (overrides[k] === 'wos') wos++;
          else if (overrides[k] === 'wos-hd') woshd++;
          else if (overrides[k] === 'wfo') wfo++;
          else if (overrides[k] === 'wfo-hd') wfohd++;
        }
      });
      let matchFilter = true;
      if (currentFilter === 'absent') matchFilter = r.absent >= 5;
      if (currentFilter === 'late') matchFilter = r.late >= 6;
      if (currentFilter === 'deduction') matchFilter = r.lateHD > 0 || r.ssHD > 0;
      if (currentFilter === 'wfm') matchFilter = wfm > 0 || wfmhd > 0;
      if (currentFilter === 'wfh') matchFilter = wfh > 0;
      if (currentFilter === 'wos') matchFilter = wos > 0 || woshd > 0;
      if (currentFilter === 'wfo') matchFilter = wfo > 0 || wfohd > 0;
      if (currentFilter === 'punchmissing') matchFilter = r.punchMissing >= 3;
      return matchSearch && matchDept && matchSubDept && matchFilter;
    });
    setFilteredResults(filtered);
    setCurrentPage(1);
  }, [allResults, overrides, currentFilter, searchQuery, selectedDept, selectedSubDept]);

  const handleFile = (file) => {
    setUploadView(false);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellText: true, raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        if (!rows || rows.length < 2) {
          toast.error('File appears empty. Please check the format.');
          setUploadView(true);
          return;
        }

        const [policy, allHolidays, allWorkingSats] = await Promise.all([
          getActiveShiftPolicy(),
          getHolidays(new Date().getFullYear()),
          getWorkingSaturdays(new Date().getFullYear())
        ]);

        const { currentMonth: cm, numDays: nd } = parseAndAnalyze(rows, policy, allHolidays, allWorkingSats);
        const monthYearStr = `${cm.month}_${cm.year}`;

        const yearHolidays = cm.year !== new Date().getFullYear()
          ? await getHolidays(cm.year)
          : allHolidays;
        const yearWorkingSats = cm.year !== new Date().getFullYear()
          ? await getWorkingSaturdays(cm.year)
          : allWorkingSats;
        const { results: finalResults } = parseAndAnalyze(rows, policy, yearHolidays, yearWorkingSats);

        const deptCounts = {};
        finalResults.forEach(r => {
          const d = r.department || 'Unknown';
          deptCounts[d] = (deptCounts[d] || 0) + 1;
        });

        setPreviewData({
          fileName: file.name,
          monthYearStr,
          monthLabel: new Date(cm.year, cm.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' }),
          results: finalResults,
          numDays: nd,
          totalEmployees: finalResults.length,
          deptCounts,
        });
      } catch (err) {
        toast.error('Error reading file: ' + err.message);
        setUploadView(true);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmUpload = async () => {
    if (!previewData) return;
    setUploading(true);
    try {
      await uploadMonthData(previewData.monthYearStr, previewData.results, previewData.numDays, user?.username);
      setPreviewData(null);
      await loadMonthsList();
      setSelectedMonth(previewData.monthYearStr);
      await loadData(previewData.monthYearStr);
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
      setUploadView(true);
    } finally {
      setUploading(false);
    }
  };

  const cancelPreview = () => {
    setPreviewData(null);
    setUploadView(true);
  };

  const getExportData = async () => {
    const codes = filteredResults.map(r => r.code);
    return getCombinedReportData(selectedMonth, codes, user?.username);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const data = await getExportData();
      if (data.error) { toast.error(data.error); return; }

      const [mo, yr] = selectedMonth.split('_').map(Number);
      const XLSX = await import('xlsx');

      // Sheet 1: Summary
      const summaryHeaders = ['Emp Code','Name','Department','Designation','Type','Present','Absent','Half Days','Late','HD(Late)','Short Shifts','HD(SS)','Short Leaves','RL','Holiday','WFM','WFH','WOS','WFO','Punch Missing'];
      const summaryRows = data.map(r => {
        const rec = r.record || {};
        let wfm = 0, wfh = 0, wos = 0, wfo = 0;
        r.dailyLogs.forEach(dl => {
          if (dl.workLocation === 'wfm' || dl.type === 'wfm') wfm++;
          else if (dl.workLocation === 'wfh' || dl.type === 'wfh') wfh++;
          else if (dl.workLocation === 'wos' || dl.type === 'wos') wos++;
          else if (dl.workLocation === 'wfo' || dl.type === 'wfo') wfo++;
        });
        const punchMissing = r.dailyLogs.filter(d => d.type === 'present' && d.inT === null).length;
        return [r.code, r.name, r.department || '', r.designation || '', r.employeeType || '',
          rec.present || 0, rec.absent || 0, rec.halfDay || 0, rec.late || 0, rec.lateHD || 0,
          rec.shortShift || 0, rec.ssHD || 0, rec.shortLeave || 0, rec.rl || 0, rec.holi || 0,
          wfm, wfh, wos, wfo, punchMissing];
      });

      // Sheet 2: Daily Details
      const dailyHeaders = ['Emp Code','Name','Date','Day','Type','In Time','Out Time','Work Location','Late','Short Shift','Short Leave','Half Day','HD Reason','Source'];
      const dailyRows = [];
      data.forEach(r => {
        r.dailyLogs.forEach(dl => {
          const inTime = dl.inT !== null ? `${String(Math.floor(dl.inT / 60)).padStart(2, '0')}:${String(dl.inT % 60).padStart(2, '0')}` : '';
          const outTime = dl.outT !== null ? `${String(Math.floor(dl.outT / 60)).padStart(2, '0')}:${String(dl.outT % 60).padStart(2, '0')}` : '';
          const date = `${yr}-${String(mo).padStart(2, '0')}-${String(dl.day).padStart(2, '0')}`;
          const dayName = new Date(yr, mo - 1, dl.day).toLocaleDateString('en', { weekday: 'short' });
          dailyRows.push([r.code, r.name, date, dayName, dl.type, inTime, outTime, dl.workLocation || '',
            dl.isLate ? 'Yes' : 'No', dl.isSS ? 'Yes' : 'No', dl.isSL ? 'Yes' : 'No',
            dl.isHD ? 'Yes' : 'No', dl.hdReason || '', 'Biometric']);
        });
      });

      // Sheet 3: Punch Logs
      const punchHeaders = ['Emp Code','Name','Date','Punch In','Punch Out','Source','IP','User Agent','Work Location'];
      const punchRows = [];
      data.forEach(r => {
        r.punchLogs.forEach(pl => {
          const d = new Date(pl.date);
          const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          const punchIn = pl.punchIn ? new Date(pl.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
          const punchOut = pl.punchOut ? new Date(pl.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
          punchRows.push([r.code, r.name, dateStr, punchIn, punchOut, pl.source, pl.ip || '', pl.userAgent || '', pl.workLocation || '']);
        });
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]), 'Summary');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyRows]), 'Daily Details');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([punchHeaders, ...punchRows]), 'Punch Logs');

      const [m, y] = selectedMonth.split('_');
      const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' }).replace(' ', '_');
      XLSX.writeFile(wb, `Attendance_Report_${monthName}.xlsx`);
      toast.success('Excel report downloaded.');
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportMenuOpen(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const data = await getExportData();
      if (data.error) { toast.error(data.error); return; }

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const margin = 14;
      const contentW = pageW - margin * 2;

      const [m, y] = selectedMonth.split('_').map(Number);
      const monthLabel = new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

      data.forEach((emp, idx) => {
        if (idx > 0) doc.addPage();
        const rec = emp.record || {};

        // Header bar
        doc.setFillColor(29, 29, 31);
        doc.rect(0, 0, pageW, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('Interactive Bees', margin, 10);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text('Attendance Report', margin, 17);
        doc.text(monthLabel, pageW - margin, 10, { align: 'right' });

        // Employee name & code
        doc.setTextColor(29, 29, 31);
        doc.setFontSize(13); doc.setFont('helvetica', 'bold');
        doc.text(`${emp.name}`, margin, 34);
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 115);
        let infoLine = `Code: ${emp.code}`;
        if (emp.department) infoLine += `  |  Dept: ${emp.department}`;
        if (emp.designation) infoLine += `  |  Designation: ${emp.designation}`;
        doc.text(infoLine, margin, 40);

        // Summary stats
        const stats = [
          ['Present', rec.present || 0], ['Absent', rec.absent || 0],
          ['Late', rec.late || 0], ['Half Days', rec.halfDay || 0],
          ['HD (Late)', rec.lateHD || 0], ['Short Shifts', rec.shortShift || 0],
          ['HD (SS)', rec.ssHD || 0], ['Short Leave', rec.shortLeave || 0],
          ['RL', rec.rl || 0], ['Holiday', rec.holi || 0],
        ];

        let sx = margin, sy = 50;
        stats.forEach(([label, value], i) => {
          if (i > 0 && i % 5 === 0) { sx = margin; sy += 16; }
          const bx = sx + (i % 5) * (contentW / 5);
          doc.setFillColor(245, 245, 247);
          doc.roundedRect(bx, sy, contentW / 5 - 2, 13, 2, 2, 'F');
          doc.setFontSize(10); doc.setFont('helvetica', 'bold');
          doc.setTextColor(29, 29, 31);
          doc.text(String(value), bx + (contentW / 5 - 2) / 2, sy + 8, { align: 'center' });
          doc.setFontSize(5); doc.setFont('helvetica', 'normal');
          doc.setTextColor(110, 110, 115);
          doc.text(label.toUpperCase(), bx + (contentW / 5 - 2) / 2, sy + 12, { align: 'center' });
        });

        // Daily calendar
        sy += 22;
        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.setTextColor(29, 29, 31);
        doc.text('Daily Attendance', margin, sy);
        sy += 5;

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const cellW = (contentW) / 7;
        const cellH = 8;

        dayNames.forEach((d, i) => {
          doc.setFillColor(232, 232, 237);
          doc.rect(margin + i * cellW, sy, cellW, cellH, 'F');
          doc.setFontSize(5); doc.setFont('helvetica', 'bold');
          doc.setTextColor(110, 110, 115);
          doc.text(d, margin + i * cellW + cellW / 2, sy + 5, { align: 'center' });
        });
        sy += cellH;

        const firstDow = new Date(y, m - 1, 1).getDay();
        const daysInMonth = new Date(y, m, 0).getDate();
        const dayMap = {};
        emp.dailyLogs.forEach(dl => dayMap[dl.day] = dl);

        let col = firstDow;
        for (let d = 1; d <= daysInMonth; d++) {
          if (sy > 270) { doc.addPage(); sy = 20; }
          const info = dayMap[d];
          const bx = margin + col * cellW;

          let bg = [245, 245, 247], textCol = [29, 29, 31], label = '';
          if (info?.type === 'absent') { bg = [255, 235, 234]; textCol = [200, 50, 40]; label = 'A'; }
          else if (info?.type === 'present') { bg = [234, 248, 238]; label = 'P'; }
          else if (info?.type === 'holiday') { bg = [255, 245, 220]; label = 'H'; }
          else if (info?.type === 'wo') { bg = [240, 240, 240]; textCol = [180, 180, 180]; label = 'WO'; }
          else if (info?.type === 'rl') { bg = [240, 230, 250]; label = 'RL'; }
          else if (info?.type === 'half') { bg = [255, 245, 220]; label = 'HD'; }
          else if (['cl', 'sl', 'el', 'ul', 'sh', 'ewl'].includes(info?.type)) { bg = [230, 240, 255]; label = info.type.toUpperCase(); }
          else if (['wfh', 'wfm', 'wos', 'wfo'].includes(info?.type)) { bg = [240, 230, 250]; label = info.type.toUpperCase(); }
          if (info?.isLate) label = 'L';
          if (info?.isSS) label = 'SS';

          doc.setFillColor(...bg);
          doc.rect(bx, sy, cellW, cellH, 'F');
          doc.setFontSize(6); doc.setFont('helvetica', 'bold');
          doc.setTextColor(...textCol);
          doc.text(String(d), bx + 2, sy + 5);

          // Show in/out times if present
          if (info?.inT !== null) {
            const inStr = `${String(Math.floor(info.inT / 60)).padStart(2, '0')}:${String(info.inT % 60).padStart(2, '0')}`;
            doc.setFontSize(4); doc.setFont('helvetica', 'normal');
            doc.setTextColor(110, 110, 115);
            doc.text(inStr, bx + cellW - 1, sy + 3, { align: 'right' });
          }
          if (info?.outT !== null) {
            const outStr = `${String(Math.floor(info.outT / 60)).padStart(2, '0')}:${String(info.outT % 60).padStart(2, '0')}`;
            doc.setFontSize(4); doc.setFont('helvetica', 'normal');
            doc.setTextColor(142, 142, 147);
            doc.text(outStr, bx + cellW - 1, sy + 7, { align: 'right' });
          }

          doc.setFontSize(5); doc.setFont('helvetica', 'normal');
          doc.setTextColor(110, 110, 115);
          doc.text(label, bx + cellW - 2, sy + 5, { align: 'right' });

          col++;
          if (col === 7) { col = 0; sy += cellH; }
        }
      });

      const [mm, yy] = selectedMonth.split('_');
      const mn = new Date(parseInt(yy), parseInt(mm) - 1).toLocaleString('default', { month: 'short', year: 'numeric' }).replace(' ', '_');
      doc.save(`Attendance_Report_${mn}.pdf`);
      toast.success('PDF report downloaded.');
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setExporting(false);
      setExportMenuOpen(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Emp Code','Name','Department','Present','Absent','Half Days','Late','HD(Late)','Short Shifts','HD(SS)','Short Leaves','RL','Holiday','WFM','WFM Half','WFH','WOS','WOS Half','WFO','WFO Half','Punch Missing'];
    const rows = [headers.join(',')];
    filteredResults.forEach(r => {
      let wfm = 0, wfmhd = 0, wfh = 0, wos = 0, woshd = 0, wfo = 0, wfohd = 0;
      Object.keys(overrides).forEach(k => {
        if (k.startsWith(r.code + '_')) {
          if (overrides[k] === 'wfm') wfm++;
          else if (overrides[k] === 'wfm-hd') wfmhd++;
          else if (overrides[k] === 'wfh') wfh++;
          else if (overrides[k] === 'wos') wos++;
          else if (overrides[k] === 'wos-hd') woshd++;
          else if (overrides[k] === 'wfo') wfo++;
          else if (overrides[k] === 'wfo-hd') wfohd++;
        }
      });
      rows.push([r.code, `"${r.name}"`, r.department || '', r.present, r.absent, r.halfDay, r.late, r.lateHD, r.shortShift, r.ssHD, r.shortLeave, r.rl, r.holi, wfm, wfmhd, wfh, wos, woshd, wfo, wfohd, r.punchMissing].join(','));
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = `Attendance_${selectedMonth}.csv`;
    a.click();
  };

  const formatMonth = (m) => {
    const [month, year] = m.split('_');
    return new Date(year, parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const filters = [
    { key: 'all', label: 'All', count: allResults.length },
    { key: 'absent', label: 'High Absent', count: allResults.filter(r => r.absent >= 5).length },
    { key: 'late', label: 'Frequent Late', count: allResults.filter(r => r.late >= 6).length },
    { key: 'deduction', label: 'HD Deduction', count: allResults.filter(r => r.lateHD > 0 || r.ssHD > 0).length },
    { key: 'wfm', label: 'WFM', count: allResults.filter(r => { let w=0; Object.keys(overrides).forEach(k => { if(k.startsWith(r.code+'_') && (overrides[k]==='wfm'||overrides[k]==='wfm-hd')) w++; }); return w>0; }).length },
    { key: 'wfh', label: 'WFH', count: allResults.filter(r => { let w=0; Object.keys(overrides).forEach(k => { if(k.startsWith(r.code+'_') && overrides[k]==='wfh') w++; }); return w>0; }).length },
    { key: 'wos', label: 'WOS', count: allResults.filter(r => { let w=0; Object.keys(overrides).forEach(k => { if(k.startsWith(r.code+'_') && (overrides[k]==='wos'||overrides[k]==='wos-hd')) w++; }); return w>0; }).length },
    { key: 'wfo', label: 'WFO', count: allResults.filter(r => { let w=0; Object.keys(overrides).forEach(k => { if(k.startsWith(r.code+'_') && (overrides[k]==='wfo'||overrides[k]==='wfo-hd')) w++; }); return w>0; }).length },
    { key: 'punchmissing', label: 'Missed Punches', count: allResults.filter(r => r.punchMissing >= 3).length },
  ];

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="page-wrapper animate-fade-in">

      {uploading && (
        <div style={{ textAlign: 'center', padding: '100px 24px' }}>
          <div style={{
            width: '44px', height: '44px', border: '3px solid var(--surface3)',
            borderTopColor: 'var(--blue)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 20px'
          }} />
          <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '6px' }}>Processing Data</div>
          <div style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '24px' }}>Saving to database…</div>
          <button onClick={() => { setUploading(false); setUploadView(true); }} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 20px' }}>Cancel</button>
        </div>
      )}

      {!loading && !uploading && previewData && (
        <div className="card" style={{ maxWidth: '560px', margin: '40px auto', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '4px' }}>Review Data</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '24px' }}>Confirm the parsed data before saving.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text2)' }}>File</span>
              <span style={{ fontWeight: 600 }}>{previewData.fileName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text2)' }}>Month</span>
              <span style={{ fontWeight: 600 }}>{previewData.monthLabel}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text2)' }}>Employees</span>
              <span style={{ fontWeight: 600 }}>{previewData.totalEmployees}</span>
            </div>
            {Object.entries(previewData.deptCounts).length > 0 && (
              <div style={{ padding: '8px 14px', background: 'var(--surface2)', borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ color: 'var(--text2)', marginBottom: '6px' }}>Departments</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {Object.entries(previewData.deptCounts).map(([dept, count]) => (
                    <span key={dept} style={{ background: 'var(--surface3)', padding: '2px 10px', borderRadius: '980px', fontSize: '12px', fontWeight: 500 }}>
                      {dept}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={confirmUpload} className="btn btn-primary" style={{ padding: '10px 24px' }}><FiCheck size={14} style={{ marginRight: '6px' }} /> Confirm Upload</button>
            <button onClick={cancelPreview} className="btn btn-secondary" style={{ padding: '10px 24px' }}><FiX size={14} style={{ marginRight: '6px' }} /> Cancel</button>
          </div>
        </div>
      )}

      {loading && !uploading && !uploadView && (
        <div className="animate-fade-in">
          <div className="kpi-grid" style={{ display: 'grid', gap: 'var(--gap)', marginBottom: 'calc(var(--gap) * 1.5)' }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card" style={{ padding: '22px' }}>
                <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px', marginBottom: '12px' }} />
                <div className="skeleton" style={{ width: '60%', height: '28px', borderRadius: '6px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '80%', height: '12px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: '16px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ width: '100%', height: '36px', borderRadius: '8px', marginBottom: '8px' }} />
            ))}
          </div>
        </div>
      )}

      {!loading && !uploading && !previewData && uploadView && isAdmin && (
        <UploadSection onFileSelected={handleFile} />
      )}

      {!loading && !uploading && !uploadView && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 'calc(var(--gap) * 1.5)', gap: '12px', flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="input-field"
                  style={{ width: 'auto', minWidth: '180px', padding: '8px 32px 8px 14px', fontWeight: 600, fontSize: 'var(--fs-base)', appearance: 'none', cursor: 'pointer' }}
                >
                  {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                </select>
                <FiChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)', pointerEvents: 'none' }} />
              </div>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)', letterSpacing: '-0.01em', fontWeight: 500, background: 'var(--surface2)', padding: '4px 12px', borderRadius: '980px' }}>
                {allResults.length} employees
              </span>
            </div>
            <div className="toolbar-actions" style={{ display: 'flex', gap: '6px', position: 'relative' }}>
              {isAdmin && (
                <div style={{ position: 'relative' }}>
                  <button className="btn btn-secondary" onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={exporting || filteredResults.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {exporting ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : <FiDownload size={14} />}
                    {exporting ? 'Exporting…' : 'Export'}
                    <FiChevronDown size={12} />
                  </button>
                  {exportMenuOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setExportMenuOpen(false)} />
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, zIndex: 100, minWidth: '180px',
                        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden', marginTop: '4px',
                      }}>
                        <button onClick={() => { exportCSV(); setExportMenuOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', color: 'var(--text)', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <FiDownload size={13} /> CSV (Current)
                        </button>
                        <button onClick={exportExcel}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', color: 'var(--text)', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <FiFileText size={13} /> Excel Report
                        </button>
                        <button onClick={exportPDF}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', color: 'var(--text)', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <FiFileText size={13} /> PDF Report
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {isAdmin && <button className="btn btn-primary" onClick={() => setUploadView(true)}><FiUpload size={14} /> Upload New</button>}
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', marginBottom: 'var(--gap)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
                <FiSearch size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder="Search by name or code…"
                  style={{ width: '100%', padding: '8px 14px 8px 34px', fontSize: 'var(--fs-sm)' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <select
                  className="input-field"
                  value={selectedDept}
                  onChange={e => { setSelectedDept(e.target.value); setSelectedSubDept(''); }}
                  style={{ width: '180px', padding: '8px 32px 8px 12px', fontSize: 'var(--fs-sm)', appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
                <FiChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)', pointerEvents: 'none' }} />
              </div>

              <div style={{ position: 'relative' }}>
                <select
                  className="input-field"
                  value={selectedSubDept}
                  onChange={e => setSelectedSubDept(e.target.value)}
                  disabled={!selectedDept}
                  style={{ width: '180px', padding: '8px 32px 8px 12px', fontSize: 'var(--fs-sm)', appearance: 'none', cursor: selectedDept ? 'pointer' : 'not-allowed', opacity: selectedDept ? 1 : 0.5 }}
                >
                  <option value="">All Sub-Depts</option>
                  {subDepartments.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <FiChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)', pointerEvents: 'none' }} />
              </div>

              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {filteredResults.length} of {allResults.length}
              </div>
            </div>

            <div className="filter-bar" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {filters.map(f => {
                const active = currentFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setCurrentFilter(f.key)}
                    style={{
                      padding: '5px 12px', borderRadius: '980px', fontSize: 'var(--fs-xs)', fontWeight: 600,
                      cursor: 'pointer', letterSpacing: '-0.01em', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: active ? 'var(--blue)' : 'transparent',
                      color: active ? '#fff' : 'var(--text2)',
                      border: active ? '1px solid var(--blue)' : '1px solid var(--border)',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)'; }}}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)'; }}}
                  >
                    {f.label}
                    <span style={{
                      background: active ? 'rgba(255,255,255,0.2)' : 'var(--surface3)',
                      color: active ? '#fff' : 'var(--text2)',
                      borderRadius: '980px', padding: '1px 6px', fontSize: '10px', fontWeight: 700,
                    }}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <EmployeeTable
            results={filteredResults}
            overrides={overrides}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            onOpenDetail={(r) => router.push(`/employee/${r.code}`)}
            showMissingDays={currentFilter === 'punchmissing'}
          />

          <div style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'right', marginTop: '8px', letterSpacing: '-0.01em' }}>
            Click any row to open the employee&apos;s detailed dashboard.
          </div>
        </>
      )}
    </div>
  );
}
