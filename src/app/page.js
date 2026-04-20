"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import UploadSection from '../components/UploadSection';
import KPIStrip from '../components/KPIStrip';
import EmployeeTable from '../components/EmployeeTable';
import * as XLSX from 'xlsx';
import { parseAndAnalyze } from '../utils/attendanceParser';
import { getMonths, uploadMonthData, fetchDashboardData, toggleOverride, clearAllOverrides } from '../actions/attendance';

export default function DashboardHome() {
  const { isAuthenticated, isAdmin, user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [allResults, setAllResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [uploadView, setUploadView] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    // Employees with a linked code go straight to their profile
    if (!authLoading && isAuthenticated && !isAdmin && user?.employeeCode) {
      router.push(`/employee/${user.employeeCode}`);
    }
  }, [isAuthenticated, isAdmin, user, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadMonthsList();
  }, [isAuthenticated]);

  const loadMonthsList = async () => {
    setLoading(true);
    const m = await getMonths();
    setMonths(m);
    if (m.length > 0) {
      setSelectedMonth(m[0]);
      await loadDashboardData(m[0]);
    } else {
      setUploadView(true);
    }
    setLoading(false);
  };

  const loadDashboardData = async (monthYear) => {
    setLoading(true);
    const data = await fetchDashboardData(monthYear);
    setAllResults(data);
    let ov = {};
    data.forEach(r => { ov = { ...ov, ...r.overrides }; });
    setOverrides(ov);
    setLoading(false);
    setUploadView(false);
  };

  const handleMonthChange = async (e) => {
    const val = e.target.value;
    setSelectedMonth(val);
    await loadDashboardData(val);
  };

  useEffect(() => {
    if (!allResults.length) { setFilteredResults([]); return; }
    const q = searchQuery.toLowerCase();
    const filtered = allResults.filter(r => {
      const matchSearch = !q || r.name.toLowerCase().includes(q) || String(r.code).includes(q);
      let wfm = 0, wfmhd = 0, wfh = 0;
      Object.keys(overrides).forEach(k => {
        if (k.startsWith(r.code + '_')) {
          if (overrides[k] === 'wfm') wfm++;
          else if (overrides[k] === 'wfm-hd') wfmhd++;
          else if (overrides[k] === 'wfh') wfh++;
        }
      });
      let matchFilter = true;
      if (currentFilter === 'absent') matchFilter = r.absent >= 5;
      if (currentFilter === 'late') matchFilter = r.late >= 6;
      if (currentFilter === 'deduction') matchFilter = r.lateHD > 0 || r.ssHD > 0;
      if (currentFilter === 'wfm') matchFilter = wfm > 0 || wfmhd > 0;
      if (currentFilter === 'wfh') matchFilter = wfh > 0;
      return matchSearch && matchFilter;
    });
    setFilteredResults(filtered);
    setCurrentPage(1);
  }, [allResults, overrides, currentFilter, searchQuery]);

  const handleFile = (file) => {
    setUploadView(false);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellText: true, raw: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
        const { results, currentMonth: cm, numDays: nd } = parseAndAnalyze(rows);
        const monthYearStr = `${cm.month}_${cm.year}`;
        await uploadMonthData(monthYearStr, results, nd);
        await loadMonthsList();
        setSelectedMonth(monthYearStr);
        await loadDashboardData(monthYearStr);
      } catch (err) {
        alert('Error reading file: ' + err.message);
        setUploadView(true);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportCSV = () => {
    const headers = ['Emp Code','Name','Present','Absent','Half Days','Late','HD(Late)','Short Shifts','HD(SS)','Short Leaves','RL','Holiday','WFM','WFM Half','WFH'];
    const rows = [headers.join(',')];
    filteredResults.forEach(r => {
      let wfm = 0, wfmhd = 0, wfh = 0;
      Object.keys(overrides).forEach(k => {
        if (k.startsWith(r.code + '_')) {
          if (overrides[k] === 'wfm') wfm++;
          else if (overrides[k] === 'wfm-hd') wfmhd++;
          else if (overrides[k] === 'wfh') wfh++;
        }
      });
      rows.push([r.code, `"${r.name}"`, r.present, r.absent, r.halfDay, r.late, r.lateHD, r.shortShift, r.ssHD, r.shortLeave, r.rl, r.holi, wfm, wfmhd, wfh].join(','));
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = `Attendance_${selectedMonth}.csv`;
    a.click();
  };

  const kpis = () => {
    if (!allResults.length) return [];
    const totalWFM = Object.values(overrides).filter(v => v === 'wfm').length;
    const totalWFMHD = Object.values(overrides).filter(v => v === 'wfm-hd').length;
    const totalWFH = Object.values(overrides).filter(v => v === 'wfh').length;
    return [
      { label: 'Employees', value: allResults.length, sub: 'Analyzed this month', color: '#0071e3', icon: '👥' },
      { label: 'Absences', value: allResults.reduce((s, x) => s + x.absent, 0), sub: 'Working days missed', color: '#ff3b30', icon: '📵' },
      { label: 'Late Marks', value: allResults.reduce((s, x) => s + x.late, 0), sub: 'After 10:15 AM', color: '#ff9f0a', icon: '⏰' },
      { label: 'Short Shifts', value: allResults.reduce((s, x) => s + x.shortShift, 0), sub: 'Under 9 hrs', color: '#ff6b35', icon: '⚡' },
      { label: 'WFM Days', value: totalWFM + totalWFMHD, sub: `Full: ${totalWFM} · Half: ${totalWFMHD}`, color: '#34c759', icon: '🏛️' },
      { label: 'HD Deductions', value: allResults.reduce((s, x) => s + x.lateHD + x.ssHD, 0), sub: 'Late + short shifts', color: '#af52de', icon: '📋' },
    ];
  };

  const formatMonth = (m) => {
    const [month, year] = m.split('_');
    return new Date(year, parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'absent', label: 'High Absent' },
    { key: 'late', label: 'Frequent Late' },
    { key: 'deduction', label: 'HD Deduction' },
    { key: 'wfm', label: 'WFM' },
    { key: 'wfh', label: 'WFH' },
  ];

  if (authLoading || !isAuthenticated) return null;

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1400px', margin: '0 auto' }} className="animate-fade-in">

      {/* Uploading state */}
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

      {/* Loading state */}
      {loading && !uploading && !uploadView && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text2)', fontSize: '14px' }}>
          Loading…
        </div>
      )}

      {/* Upload view — admin only */}
      {!loading && !uploading && uploadView && isAdmin && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
            {months.length > 0 && (
              <button onClick={() => setUploadView(false)} className="btn btn-secondary">
                ← Back to Dashboard
              </button>
            )}
            <button onClick={logout} className="btn btn-outline">Sign Out</button>
          </div>
          <UploadSection onFileSelected={handleFile} />
        </>
      )}

      {/* Dashboard */}
      {!loading && !uploading && !uploadView && (
        <>
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '20px', gap: '12px', flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={selectedMonth}
                onChange={handleMonthChange}
                className="input-field"
                style={{ width: 'auto', minWidth: '170px', padding: '8px 12px', fontWeight: 500, fontSize: '14px' }}
              >
                {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
              </select>
              <span style={{ fontSize: '13px', color: 'var(--text2)', letterSpacing: '-0.01em' }}>
                {allResults.length} employees
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isAdmin && <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>}
              {isAdmin && <button className="btn btn-primary" onClick={() => setUploadView(true)}>Upload New</button>}
              {isAdmin && <button className="btn btn-secondary" onClick={() => router.push('/users')}>Manage Users</button>}
              <button className="btn btn-outline" onClick={logout}>Sign Out</button>
            </div>
          </div>

          <KPIStrip kpis={kpis()} />

          {/* Table header row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '14px', gap: '12px', flexWrap: 'wrap'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>
              Employee Breakdown
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Search employee…"
                style={{ width: '190px', padding: '8px 12px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px' }}>
                {filters.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setCurrentFilter(f.key)}
                    style={{
                      padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
                      border: 'none', cursor: 'pointer', letterSpacing: '-0.01em',
                      background: currentFilter === f.key ? 'var(--surface)' : 'transparent',
                      color: currentFilter === f.key ? 'var(--text)' : 'var(--text2)',
                      boxShadow: currentFilter === f.key ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.15s', fontFamily: 'inherit'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <EmployeeTable
            results={filteredResults}
            overrides={overrides}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            onOpenDetail={(r) => router.push(`/employee/${r.code}`)}
          />

          <div style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'right', marginTop: '8px', letterSpacing: '-0.01em' }}>
            Click any row to open the employee's detailed dashboard.
          </div>
        </>
      )}
    </div>
  );
}
