"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import UploadSection from '../components/UploadSection';
import KPIStrip from '../components/KPIStrip';
import EmployeeTable from '../components/EmployeeTable';
import * as XLSX from 'xlsx';
import { parseAndAnalyze } from '../utils/attendanceParser';
import { getMonths, uploadMonthData, fetchDashboardData } from '../actions/attendance';
import { getActiveShiftPolicy } from '../actions/shiftPolicy';
import { getHolidays } from '../actions/holidays';
import { getDepartments } from '../actions/departments';
import { getPendingPolicies } from '../actions/shiftPolicy';
import { getPendingAttendanceCorrections } from '../actions/attendanceChanges';
import { getPendingSuperRegularizations } from '../actions/leave';
import { FiSearch, FiDownload, FiUpload, FiChevronDown } from 'react-icons/fi';

export default function DashboardHome() {
  const { isAuthenticated, isAdmin, isSuperAdmin, user, loading: authLoading } = useAuth();
  const router = useRouter();

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

  // Super admin — pending approvals
  const [pendingCounts, setPendingCounts] = useState({ policies: 0, corrections: 0, regularizations: 0 });

  // Filters
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSubDept, setSelectedSubDept] = useState('');
  const [currentFilter, setCurrentFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && user?.employeeCode) {
      router.push(`/employee/${user.employeeCode}`);
    }
  }, [isAuthenticated, isAdmin, user, authLoading, router]);

  const loadDashboardData = useCallback(async (monthYear) => {
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
      await loadDashboardData(m[0]);
    } else {
      setUploadView(true);
    }
    setLoading(false);
  }, [loadDashboardData]);

  useEffect(() => {
    if (isAuthenticated) {
      getDepartments().then(setDepartments);
      loadMonthsList();
      if (isSuperAdmin) {
        Promise.all([
          getPendingPolicies(),
          getPendingAttendanceCorrections(),
          getPendingSuperRegularizations()
        ]).then(([pp, ac, sr]) => {
          setPendingCounts({ policies: pp.length, corrections: ac.length, regularizations: sr.length });
        }).catch(() => {});
      }
    }
  }, [isAuthenticated, isSuperAdmin, loadMonthsList]);

  const handleMonthChange = async (e) => {
    const val = e.target.value;
    setSelectedMonth(val);
    await loadDashboardData(val);
  };

  // Compute unique sub-departments for selected department
  const subDepartments = useMemo(() => {
    if (!selectedDept) return [];
    const subs = new Set();
    allResults.forEach(r => {
      if (r.department === selectedDept && r.subDepartment) subs.add(r.subDepartment);
    });
    return [...subs].sort();
  }, [selectedDept, allResults]);

  // Filter logic
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
      { label: 'Employees', value: allResults.length, sub: 'Analyzed this month', color: '#0071e3', icon: '👥' },
      { label: 'Absences', value: allResults.reduce((s, x) => s + x.absent, 0), sub: 'Working days missed', color: '#ff3b30', icon: '📵' },
      { label: 'Late Marks', value: allResults.reduce((s, x) => s + x.late, 0), sub: 'After 10:15 AM', color: '#ff9f0a', icon: '⏰' },
      { label: 'Short Shifts', value: allResults.reduce((s, x) => s + x.shortShift, 0), sub: 'Under 9 hrs', color: '#ff6b35', icon: '⚡' },
      { label: 'WFM Days', value: totalWFM + totalWFMHD, sub: `Full: ${totalWFM} · Half: ${totalWFMHD}`, color: '#34c759', icon: '🏛️' },
      { label: 'WFH Days', value: totalWFH, sub: 'Work from home', color: '#af52de', icon: '🏠' },
      { label: 'Missed Punches', value: totalPunchMissing, sub: 'Present days w/o punch', color: '#ff6b35', icon: '⚠️', onClick: () => setCurrentFilter('punchmissing') },
      { label: 'HD Deductions', value: allResults.reduce((s, x) => s + x.lateHD + x.ssHD, 0), sub: 'Late + short shifts', color: '#ff3b30', icon: '📋' },
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
    { key: 'punchmissing', label: '⚠️ Punch Missing', count: allResults.filter(r => r.punchMissing >= 3).length },
  ];

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="page-wrapper animate-fade-in">

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

      {/* Loading skeleton */}
      {loading && !uploading && !uploadView && (
        <div className="animate-fade-in">
          {/* KPI skeleton */}
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 'var(--gap)', marginBottom: 'calc(var(--gap) * 1.5)' }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card" style={{ padding: '22px' }}>
                <div className="skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px', marginBottom: '12px' }} />
                <div className="skeleton" style={{ width: '60%', height: '28px', borderRadius: '6px', marginBottom: '8px' }} />
                <div className="skeleton" style={{ width: '80%', height: '12px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
          {/* Table skeleton */}
          <div className="card" style={{ padding: '16px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ width: '100%', height: '36px', borderRadius: '8px', marginBottom: '8px' }} />
            ))}
          </div>
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

          {/* Super admin approval banner */}
          {isSuperAdmin && (
            <div className="card" style={{
              padding: '12px 20px', marginBottom: 'var(--gap)',
              background: pendingCounts.policies > 0 || pendingCounts.corrections > 0 || pendingCounts.regularizations > 0
                ? 'rgba(255,159,10,0.06)' : 'var(--surface2)',
              border: pendingCounts.policies > 0 || pendingCounts.corrections > 0 || pendingCounts.regularizations > 0
                ? '1px solid rgba(255,159,10,0.25)' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚡ Pending Approvals
                {(pendingCounts.policies + pendingCounts.corrections + pendingCounts.regularizations) > 0 && (
                  <span style={{ fontSize: '12px', background: 'rgba(255,59,48,0.1)', color: 'var(--red)', padding: '1px 8px', borderRadius: '980px', fontWeight: 600 }}>
                    {pendingCounts.policies + pendingCounts.corrections + pendingCounts.regularizations}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {(pendingCounts.policies + pendingCounts.corrections + pendingCounts.regularizations) > 0 ? (
                  <>
                    {pendingCounts.policies > 0 && (
                      <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }}
                        onClick={() => router.push('/settings')}>
                        {pendingCounts.policies} Policy{pendingCounts.policies > 1 ? 'ies' : 'y'}
                      </button>
                    )}
                    {pendingCounts.regularizations > 0 && (
                      <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }}
                        onClick={() => router.push('/leaves')}>
                        {pendingCounts.regularizations} Regularization{pendingCounts.regularizations > 1 ? 's' : ''}
                      </button>
                    )}
                    {pendingCounts.corrections > 0 && (
                      <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }}
                        onClick={() => router.push('/leaves')}>
                        {pendingCounts.corrections} Correction{pendingCounts.corrections > 1 ? 's' : ''}
                      </button>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text3)' }}>All caught up</span>
                )}
                <button className="btn btn-outline" style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={async () => {
                    const [pp, ac, sr] = await Promise.all([
                      getPendingPolicies(),
                      getPendingAttendanceCorrections(),
                      getPendingSuperRegularizations()
                    ]);
                    setPendingCounts({ policies: pp.length, corrections: ac.length, regularizations: sr.length });
                  }}>
                  ↻ Refresh
                </button>
              </div>
            </div>
          )}

          <KPIStrip kpis={kpis()} />

          {/* Filter row */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 'var(--gap)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
              {/* Search */}
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

              {/* Department filter */}
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

              {/* Sub-department filter */}
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

              {/* Result count */}
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {filteredResults.length} of {allResults.length}
              </div>
            </div>

            {/* Filter pills */}
            <div className="filter-bar" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {filters.map(f => {
                const active = currentFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setCurrentFilter(f.key)}
                    style={{
                      padding: '6px 14px', borderRadius: '9px', fontSize: 'var(--fs-xs)', fontWeight: 500,
                      border: active ? '1px solid var(--blue)' : '1px solid transparent',
                      cursor: 'pointer', letterSpacing: '-0.01em',
                      background: active ? 'var(--blue-light)' : 'transparent',
                      color: active ? 'var(--blue)' : 'var(--text2)',
                      transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap',
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)'; }}}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text2)'; }}}
                  >
                    {f.label}
                    <span style={{
                      background: active ? 'var(--blue)' : 'var(--surface3)',
                      color: active ? '#fff' : 'var(--text2)',
                      borderRadius: '980px', padding: '1px 7px', fontSize: '10px', fontWeight: 700,
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
