"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { getEmployeeHistory, toggleOverride, clearAllOverrides } from '../../../actions/attendance';
import EmployeeModal from '../../../components/EmployeeModal';

export default function EmployeeDashboard({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { isAuthenticated, isAdmin, user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [emp, setEmp] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    // Employees can only view their own profile
    if (!authLoading && isAuthenticated && !isAdmin && user?.employeeCode && user.employeeCode !== code) {
      router.push(`/employee/${user.employeeCode}`);
    }
  }, [isAuthenticated, isAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, code]);

  const loadData = async () => {
    setLoading(true);
    const data = await getEmployeeHistory(code);
    if (data) {
      setEmp(data);
      let ov = {};
      data.overrides.forEach(o => { ov[`${data.code}_${o.day}`] = o.type; });
      setOverrides(ov);
    }
    setLoading(false);
  };

  if (authLoading || !isAuthenticated) return null;

  if (loading) return (
    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>
      Loading…
    </div>
  );

  if (!emp || emp.records.length === 0) return (
    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--red)', fontSize: '14px' }}>
      Employee not found.
    </div>
  );

  const currentRecord = emp.records[selectedMonthIndex];
  const [month, year] = currentRecord.monthYear.split('_');
  const modalCurrentMonth = { month: parseInt(month), year: parseInt(year) };

  const formattedEmployee = {
    code: emp.code,
    name: emp.name,
    present: currentRecord.present,
    absent: currentRecord.absent,
    late: currentRecord.late,
    shortShift: currentRecord.shortShift,
    days: emp.dailyLogs
      .filter(log => log.monthYear === currentRecord.monthYear)
      .map(dl => ({
        d: dl.day, type: dl.type, raw: dl.raw,
        inT: dl.inT, outT: dl.outT,
        isLate: dl.isLate, isSS: dl.isSS, isSL: dl.isSL
      }))
  };

  const currentMonthOverrides = {};
  emp.overrides
    .filter(o => o.monthYear === currentRecord.monthYear)
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
      if (type === 'clear') {
        p.overrides = p.overrides.filter(o => !(o.day === day && o.monthYear === currentRecord.monthYear));
      } else {
        const existing = p.overrides.find(o => o.day === day && o.monthYear === currentRecord.monthYear);
        if (existing) existing.type = type;
        else p.overrides.push({ day, monthYear: currentRecord.monthYear, type });
      }
      return p;
    });
    await toggleOverride(code, currentRecord.monthYear, day, type);
  };

  const handleRemoveOverride = (empCode, day) => handleApplyOverride(empCode, day, 'clear');

  const handleClearAllOverrides = async (empCode) => {
    setEmp(prev => ({ ...prev, overrides: prev.overrides.filter(o => o.monthYear !== currentRecord.monthYear) }));
    setOverrides({});
    await clearAllOverrides(code, currentRecord.monthYear);
  };

  const formatMonth = (my) => {
    const [m, y] = my.split('_');
    return new Date(y, parseInt(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
  };

  const avgAbsent = (emp.records.reduce((s, r) => s + r.absent, 0) / emp.records.length).toFixed(1);

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">

      {/* Back — admin only */}
      {isAdmin && (
        <button className="btn btn-secondary" style={{ marginBottom: '20px' }} onClick={() => router.push('/')}>
          ← Dashboard
        </button>
      )}
      {!isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button className="btn btn-outline" onClick={logout}>Sign Out</button>
        </div>
      )}

      {/* Profile header */}
      <div className="card" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '24px 28px', marginBottom: '20px', flexWrap: 'wrap', gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--surface3)', display: 'grid', placeItems: 'center',
            fontSize: '20px', fontWeight: 700, color: 'var(--text2)', letterSpacing: '-0.02em'
          }}>
            {emp.name.charAt(0)}
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>{emp.name}</h1>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px', letterSpacing: '-0.01em' }}>
              Employee #{emp.code}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px' }}>
          {[
            { label: 'Months Tracked', value: emp.records.length, color: 'var(--text)' },
            { label: 'Avg Absent / mo', value: avgAbsent, color: parseFloat(avgAbsent) >= 3 ? 'var(--red)' : 'var(--text)' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* Month sidebar */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            History
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {emp.records.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setSelectedMonthIndex(i)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', borderRadius: '9px', cursor: 'pointer', textAlign: 'left',
                  border: selectedMonthIndex === i ? '1px solid rgba(0,113,227,0.3)' : '1px solid transparent',
                  background: selectedMonthIndex === i ? 'var(--blue-light)' : 'transparent',
                  color: selectedMonthIndex === i ? 'var(--blue)' : 'var(--text2)',
                  fontFamily: 'inherit', fontSize: '13px', fontWeight: selectedMonthIndex === i ? 600 : 400,
                  transition: 'all 0.15s', letterSpacing: '-0.01em'
                }}
              >
                <span>{formatMonth(r.monthYear)}</span>
                <span style={{ fontSize: '11px', display: 'flex', gap: '4px' }}>
                  {r.absent > 0 && <span style={{ color: 'var(--red)' }}>{r.absent}A</span>}
                  {r.late > 0 && <span style={{ color: 'var(--yellow)' }}>{r.late}L</span>}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Month detail — inline modal */}
        <div className="card" style={{ padding: '24px', position: 'relative' }}>
          <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '20px', color: 'var(--text)' }}>
            {formatMonth(currentRecord.monthYear)}
          </div>
          <div style={{ position: 'relative', height: '760px', overflow: 'hidden' }}>
            <style>{`
              .emp-inline > div {
                position: absolute !important; inset: 0 !important;
                background: transparent !important; backdrop-filter: none !important;
              }
              .emp-inline > div > div {
                width: 100% !important; max-width: 100% !important;
                height: 100% !important; border: none !important;
                background: transparent !important; box-shadow: none !important;
                border-radius: 0 !important;
              }
            `}</style>
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
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
