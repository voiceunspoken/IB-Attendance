"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import UploadSection from '../../components/UploadSection';
import KPIStrip from '../../components/KPIStrip';
import EmployeeTable from '../../components/EmployeeTable';
import * as XLSX from 'xlsx';
import { parseAndAnalyze } from '../../utils/attendanceParser';
import { getMonths, uploadMonthData, fetchDashboardData } from '../../actions/attendance';
import { getActiveShiftPolicy } from '../../actions/shiftPolicy';
import { getHolidays } from '../../actions/holidays';
import { getDepartments } from '../../actions/departments';
import { FiSearch, FiDownload, FiUpload, FiChevronDown, FiUsers, FiAlertCircle, FiClock, FiZap, FiHome, FiMonitor, FiAlertTriangle, FiClipboard } from 'react-icons/fi';
import { useToast } from '../../components/Toast';

export default function AttendancePage() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSubDept, setSelectedSubDept] = useState('');
  const [currentFilter, setCurrentFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  const loadData = useCallback(async (monthYear) => {
    setLoading(true);
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
    setLoading(false);
    setUploadView(false);
  }, []);

  const loadMonthsList = useCallback(async () => {
    setLoading(true);
    const m = await getMonths();
    setMonths(m);
    if (m.length > 0) {
      setSelectedMonth(m[0]);
      await loadData(m[0]);
    } else {
      setUploadView(true);
    }
    setLoading(false);
  }, [loadData]);

  useEffect(() => {
    if (isAuthenticated) {
      getDepartments().then(setDepartments);
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

      let wfm = 0, wfmhd = 0, wfh = 0, wos = 0, woshd = 0;
      Object.keys(overrides).forEach(k => {
        if (k.startsWith(r.code + '_')) {
          if (overrides[k] === 'wfm') wfm++;
          else if (overrides[k] === 'wfm-hd') wfmhd++;
          else if (overrides[k] === 'wfh') wfh++;
          else if (overrides[k] === 'wos') wos++;
          else if (overrides[k] === 'wos-hd') woshd++;
        }
      });
      let matchFilter = true;
      if (currentFilter === 'absent') matchFilter = r.absent >= 5;
      if (currentFilter === 'late') matchFilter = r.late >= 6;
      if (currentFilter === 'deduction') matchFilter = r.lateHD > 0 || r.ssHD > 0;
      if (currentFilter === 'wfm') matchFilter = wfm > 0 || wfmhd > 0;
      if (currentFilter === 'wfh') matchFilter = wfh > 0;
      if (currentFilter === 'wos') matchFilter = wos > 0 || woshd > 0;
      if (currentFilter === 'punchmissing') matchFilter = r.punchMissing >= 3;
      return matchSearch && matchDept && matchSubDept && matchFilter;
    });
    setFilteredResults(filtered);
    setCurrentPage(1);
  }, [allResults, overrides, currentFilter, searchQuery, selectedDept, selectedSubDept]);

  const handleFile = (file) => {
    setUploadView(false);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellText: true, raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        const [policy, allHolidays] = await Promise.all([
          getActiveShiftPolicy(),
          getHolidays(new Date().getFullYear())
        ]);

        const { currentMonth: cm, numDays: nd } = parseAndAnalyze(rows, policy, allHolidays);
        const monthYearStr = `${cm.month}_${cm.year}`;

        const yearHolidays = cm.year !== new Date().getFullYear()
          ? await getHolidays(cm.year)
          : allHolidays;
        const { results: finalResults } = parseAndAnalyze(rows, policy, yearHolidays);

        await uploadMonthData(monthYearStr, finalResults, nd);
        await loadMonthsList();
        setSelectedMonth(monthYearStr);
        await loadData(monthYearStr);
      } catch (err) {
        toast.error('Error reading file: ' + err.message);
        setUploadView(true);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportCSV = () => {
    const headers = ['Emp Code','Name','Department','Present','Absent','Half Days','Late','HD(Late)','Short Shifts','HD(SS)','Short Leaves','RL','Holiday','WFM','WFM Half','WFH','WOS','WOS Half','Punch Missing'];
    const rows = [headers.join(',')];
    filteredResults.forEach(r => {
      let wfm = 0, wfmhd = 0, wfh = 0, wos = 0, woshd = 0;
      Object.keys(overrides).forEach(k => {
        if (k.startsWith(r.code + '_')) {
          if (overrides[k] === 'wfm') wfm++;
          else if (overrides[k] === 'wfm-hd') wfmhd++;
          else if (overrides[k] === 'wfh') wfh++;
          else if (overrides[k] === 'wos') wos++;
          else if (overrides[k] === 'wos-hd') woshd++;
        }
      });
      rows.push([r.code, `"${r.name}"`, r.department || '', r.present, r.absent, r.halfDay, r.late, r.lateHD, r.shortShift, r.ssHD, r.shortLeave, r.rl, r.holi, wfm, wfmhd, wfh, wos, woshd, r.punchMissing].join(','));
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = `Attendance_${selectedMonth}.csv`;
    a.click();
  };

  const totalPunchMissing = allResults.reduce((s, r) => s + r.punchMissing, 0);

  const kpis = () => {
    if (!allResults.length) return [];
    const totalWFM = Object.values(overrides).filter(v => v === 'wfm').length;
    const totalWFMHD = Object.values(overrides).filter(v => v === 'wfm-hd').length;
    const totalWFH = Object.values(overrides).filter(v => v === 'wfh').length;
    return [
      { label: 'Employees', value: allResults.length, sub: 'Analyzed this month', color: '#0071e3', icon: <FiUsers size={18} /> },
      { label: 'Absences', value: allResults.reduce((s, x) => s + x.absent, 0), sub: 'Working days missed', color: '#ff3b30', icon: <FiAlertCircle size={18} /> },
      { label: 'Late Marks', value: allResults.reduce((s, x) => s + x.late, 0), sub: 'After 10:15 AM', color: '#ff9f0a', icon: <FiClock size={18} /> },
      { label: 'Short Shifts', value: allResults.reduce((s, x) => s + x.shortShift, 0), sub: 'Under 9 hrs', color: '#ff6b35', icon: <FiZap size={18} /> },
      { label: 'WFM Days', value: totalWFM + totalWFMHD, sub: `Full: ${totalWFM} · Half: ${totalWFMHD}`, color: '#34c759', icon: <FiMonitor size={18} /> },
      { label: 'WFH Days', value: totalWFH, sub: 'Work from home', color: '#af52de', icon: <FiHome size={18} /> },
      { label: 'Missed Punches', value: totalPunchMissing, sub: 'Present days w/o punch', color: '#ff6b35', icon: <FiAlertTriangle size={18} />, onClick: () => setCurrentFilter('punchmissing') },
      { label: 'HD Deductions', value: allResults.reduce((s, x) => s + x.lateHD + x.ssHD, 0), sub: 'Late + short shifts', color: '#ff3b30', icon: <FiClipboard size={18} /> },
    ];
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
          <div style={{ color: 'var(--text2)', fontSize: '14px' }}>Saving to database…</div>
        </div>
      )}

      {loading && !uploading && !uploadView && (
        <div className="animate-fade-in">
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 'var(--gap)', marginBottom: 'calc(var(--gap) * 1.5)' }}>
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

      {!loading && !uploading && uploadView && isAdmin && (
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
            <div className="toolbar-actions" style={{ display: 'flex', gap: '6px' }}>
              {isAdmin && <button className="btn btn-secondary" onClick={exportCSV}><FiDownload size={14} /> Export CSV</button>}
              {isAdmin && <button className="btn btn-primary" onClick={() => setUploadView(true)}><FiUpload size={14} /> Upload New</button>}
            </div>
          </div>

          <KPIStrip kpis={kpis()} />

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
