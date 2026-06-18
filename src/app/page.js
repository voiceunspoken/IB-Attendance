"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { getAllEmployees, getMonths, fetchDashboardData } from '../actions/attendance';
import { getUpcomingHolidays } from '../actions/holidays';
import { getDepartments } from '../actions/departments';
import { getPendingPolicies } from '../actions/shiftPolicy';
import { getPendingAttendanceCorrections } from '../actions/attendanceChanges';
import { getPendingSuperRegularizations, getAllLeaveRequests } from '../actions/leave';
import { FiUsers, FiCalendar, FiClipboard, FiActivity, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';

export default function DashboardHome() {
  const { isAuthenticated, isAdmin, isSuperAdmin, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [months, setMonths] = useState([]);
  const [monthData, setMonthData] = useState(undefined);
  const [holidays, setHolidays] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingCounts, setPendingCounts] = useState({ policies: 0, corrections: 0, regularizations: 0 });
  const [loading, setLoading] = useState(true);

  const [dataError, setDataError] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    async function load() {
      setLoading(true);
      setDataError(false);

      try {
        const emps = await getAllEmployees();
        setEmployees(emps);
      } catch { setEmployees([]); }

      try {
        const depts = await getDepartments();
        setDepartments(depts);
      } catch { setDepartments([]); }

      let mons = [];
      try {
        mons = await getMonths();
        setMonths(mons);
      } catch { setMonths([]); }

      try {
        const upHolidays = await getUpcomingHolidays();
        setHolidays(upHolidays);
      } catch { setHolidays([]); }

      try {
        const leaveReqs = await getAllLeaveRequests();
        setPendingLeaves(leaveReqs.filter(r => r.status === 'pending').length);
      } catch { setPendingLeaves(0); }

      if (mons.length > 0) {
        try {
          const data = await fetchDashboardData(mons[0]);
          setMonthData(data);
        } catch { setMonthData(null); setDataError(true); }
      } else {
        setMonthData(null);
      }

      if (isSuperAdmin) {
        try {
          const [pp, ac, sr] = await Promise.all([
            getPendingPolicies(),
            getPendingAttendanceCorrections(),
            getPendingSuperRegularizations()
          ]);
          setPendingCounts({ policies: pp.length, corrections: ac.length, regularizations: sr.length });
        } catch { /* ignore */ }
      }

      setLoading(false);
    }
    load();
  }, [isAuthenticated, isSuperAdmin]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !isAdmin && user?.code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, user, authLoading, router]);

  const activeEmployees = employees.filter(e => !e.disabled).length;
  const deptCount = departments.length;
  const attendanceRate = monthData && monthData.length
    ? (() => {
        const totalPresent = monthData.reduce((s, r) => s + (r.present || 0), 0);
        const totalDays = monthData.reduce((s, r) => s + (r.numDays || 0), 0);
        return totalDays > 0 ? ((totalPresent / totalDays) * 100).toFixed(1) : '—';
      })()
    : '—';
  const totalPending = pendingCounts.policies + pendingCounts.corrections + pendingCounts.regularizations;
  const hasNoMonths = months.length === 0;
  const headerMonth = months[0];
  const formatMonth = (m) => {
    if (!m) return '';
    const [month, year] = m.split('_');
    return new Date(year, parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  if (authLoading || !isAuthenticated) return null;
  if (!authLoading && isAuthenticated && !isAdmin) {
    if (user?.code) router.push(`/employee/${user.code}`);
    return null;
  }

  return (
    <div className="page-wrapper animate-fade-in">

      {/* ── Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0071e3 0%, #002d5a 100%)',
        borderRadius: '16px', padding: '32px 36px', marginBottom: '28px',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="text-xs text-medium" style={{ opacity: 0.75, marginBottom: '4px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em', margin: '0 0 4px' }}>
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm" style={{ opacity: 0.75, margin: 0 }}>
            {headerMonth ? `Attendance overview for ${formatMonth(headerMonth)}` : 'Attendance Portal'}
          </p>
        </div>
        <div style={{ position: 'absolute', top: '-40px', right: '-20px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '60px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {loading ? (
        <div className="animate-fade-in">
          <div className="kpi-grid" style={{ gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-24">
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '12px', marginBottom: '14px' }} />
                <div className="skeleton" style={{ width: '50%', height: '32px', borderRadius: '8px', marginBottom: '6px' }} />
                <div className="skeleton" style={{ width: '70%', height: '12px', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>

          {/* ── Top KPI Row ── */}
          <div className="kpi-grid" style={{ gap: 'var(--gap)', marginBottom: 'var(--gap)' }}>
            <div className="card flex items-center gap-16" style={{ padding: '20px 24px' }}>
              <div className="grid-center" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #0071e3, #40a0ff)', color: '#fff', flexShrink: 0 }}>
                <FiUsers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.2 }}>{activeEmployees}</div>
                <div className="text-sm text-muted">Active Employees</div>
              </div>
            </div>
            <div className="card flex items-center gap-16" style={{ padding: '20px 24px' }}>
              <div className="grid-center" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #34c759, #68e088)', color: '#fff', flexShrink: 0 }}>
                <FiActivity size={22} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.2 }}>{attendanceRate}{attendanceRate !== '—' ? '%' : ''}</div>
                <div className="text-sm text-muted">Attendance Rate</div>
              </div>
            </div>
            <div className="card flex items-center gap-16" style={{ padding: '20px 24px' }}>
              <div className="grid-center" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #ff9f0a, #ffc75a)', color: '#fff', flexShrink: 0 }}>
                <FiClipboard size={22} />
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.2 }}>{pendingLeaves}</div>
                <div className="text-sm text-muted">Pending Leave Requests</div>
              </div>
            </div>
            <div className="card flex items-center gap-16" style={{ padding: '20px 24px' }}>
              <div className="grid-center" style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #ff3b30, #ff6b6b)', color: '#fff', flexShrink: 0 }}>
                <FiAlertTriangle size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '24px', fontWeight: 700, lineHeight: 1.2 }}>
                  {totalPending}
                  {totalPending > 0 && (
                    <span className="badge" style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30', marginLeft: '8px', verticalAlign: 'middle' }}>
                      Needs review
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted">Pending Approvals</div>
              </div>
            </div>
          </div>

          {/* ── Pending Approvals (Super Admin) ── */}
          {isSuperAdmin && totalPending > 0 && (
            <div className="card p-22-24" style={{ marginBottom: 'var(--gap)' }}>
              <div className="flex-between mb-16">
                <div className="text-base text-bold flex items-center gap-8">
                  <FiAlertTriangle size={16} /> Pending Approvals
                </div>
                <button className="btn btn-outline" style={{ fontSize: '12px', padding: '4px 12px' }}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {pendingCounts.policies > 0 && (
                  <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.2)' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#ff9f0a' }}>{pendingCounts.policies}</div>
                    <div className="text-xs text-muted mb-6">Shift Polic{pendingCounts.policies !== 1 ? 'ies' : 'y'}</div>
                    <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '3px 10px' }} onClick={() => router.push('/settings')}>Review →</button>
                  </div>
                )}
                {pendingCounts.corrections > 0 && (
                  <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(175,82,222,0.08)', border: '1px solid rgba(175,82,222,0.2)' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#af52de' }}>{pendingCounts.corrections}</div>
                    <div className="text-xs text-muted mb-6">Attendance Corrections</div>
                    <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '3px 10px' }} onClick={() => router.push('/leaves')}>Review →</button>
                  </div>
                )}
                {pendingCounts.regularizations > 0 && (
                  <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(90,200,250,0.08)', border: '1px solid rgba(90,200,250,0.2)' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#5ac8fa' }}>{pendingCounts.regularizations}</div>
                    <div className="text-xs text-muted mb-6">Regularizations</div>
                    <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '3px 10px' }} onClick={() => router.push('/leaves')}>Review →</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Quick Access + Upcoming Holidays ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--gap)', alignItems: 'start' }}>
            <div>
              <div className="text-base text-bold mb-12">Quick Access</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div className="card" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => router.push('/attendance')}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div className="grid-center" style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,113,227,0.1)', color: '#0071e3', marginBottom: '12px' }}>
                    <FiCalendar size={18} />
                  </div>
                  <div className="text-md text-bold mb-2">Attendance</div>
                  <div className="text-xs text-muted2">{months.length > 0 ? `${months.length} month${months.length !== 1 ? 's' : ''} loaded` : 'Upload monthly data'}</div>
                </div>
                <div className="card" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => router.push('/team')}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div className="grid-center" style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(52,199,89,0.1)', color: '#34c759', marginBottom: '12px' }}>
                    <FiUsers size={18} />
                  </div>
                  <div className="text-md text-bold mb-2">Team</div>
                  <div className="text-xs text-muted2">{deptCount} department{deptCount !== 1 ? 's' : ''} · {activeEmployees} employees</div>
                </div>
                <div className="card" style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => router.push('/leaves')}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div className="grid-center" style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,159,10,0.1)', color: '#ff9f0a', marginBottom: '12px' }}>
                    <FiClipboard size={18} />
                  </div>
                  <div className="text-md text-bold mb-2">Leaves</div>
                  <div className="text-xs text-muted2">{pendingLeaves > 0 ? `${pendingLeaves} pending request${pendingLeaves !== 1 ? 's' : ''}` : 'No pending requests'}</div>
                </div>
              </div>
            </div>

            {/* ── Upcoming Holidays ── */}
            <div className="flex-col" style={{ gap: 'var(--gap)' }}>
              <div>
                <div className="text-base text-bold mb-12">Upcoming Holidays</div>
                <div className="card card-body-sm">
                  {holidays.length === 0 ? (
                    <div className="text-sm text-muted2 text-center" style={{ padding: '12px 0' }}>No upcoming holidays</div>
                  ) : (
                    <div className="flex-col gap-8">
                      {holidays.slice(0, 5).map((h, i) => {
                        const d = new Date(h.year, h.month - 1, h.day);
                        return (
                          <div key={`${h.year}-${h.month}-${h.day}`} className="flex items-center gap-12" style={{
                            paddingBottom: i < holidays.length - 1 ? '8px' : 0,
                            borderBottom: i < holidays.length - 1 ? '1px solid var(--border)' : 'none',
                          }}>
                            <div className="flex-col items-center grid-center flex-shrink-0" style={{
                              width: '40px', height: '40px', borderRadius: '10px',
                              background: 'rgba(0,113,227,0.06)',
                            }}>
                              <span className="text-xs text-semibold text-muted" style={{ lineHeight: 1 }}>{d.toLocaleString('en', { month: 'short' })}</span>
                              <span style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.2 }}>{h.day}</span>
                            </div>
                            <div>
                              <div className="text-sm text-semibold">{h.name}</div>
                              <div className="text-xs text-muted2">{d.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {hasNoMonths && (
            <div className="card text-center" style={{ padding: '36px', marginTop: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.3 }}><FiCalendar size={36} /></div>
              <div className="text-md text-semibold mb-2 text-muted">No attendance data yet</div>
              <div className="text-sm text-muted2 mb-16">Upload your first month of attendance data to get started.</div>
              <button className="btn btn-primary" onClick={() => router.push('/attendance')}><FiCalendar size={14} style={{ marginRight: '6px' }} /> Go to Attendance</button>
            </div>
          )}

          {!hasNoMonths && dataError && (
            <div className="card text-center" style={{ padding: '36px', marginTop: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.3 }}><FiAlertTriangle size={36} /></div>
              <div className="text-md text-semibold mb-2 text-muted">Could not load monthly data</div>
              <div className="text-sm text-muted2 mb-16">The monthly attendance data failed to load. Try refreshing the page.</div>
              <button className="btn btn-primary" onClick={() => window.location.reload()}><FiArrowRight size={14} style={{ marginRight: '6px' }} /> Refresh</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
