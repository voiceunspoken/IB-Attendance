"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { getAllEmployees, getMonths, fetchDashboardData } from '../actions/attendance';
import { getUpcomingHolidays } from '../actions/holidays';
import { getDepartments } from '../actions/departments';
import { getPendingPolicies } from '../actions/shiftPolicy';
import { getPendingSuperRegularizations, getAllLeaveRequests } from '../actions/leave';
import { FiUsers, FiCalendar, FiAlertTriangle, FiArrowRight, FiGift } from 'react-icons/fi';

export default function DashboardHome() {
  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();

  const [employees, setEmployees] = useState([]);
  const [, setDepartments] = useState([]);
  const [months, setMonths] = useState([]);
  const [, setMonthData] = useState(undefined);
  const [holidays, setHolidays] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({ policies: 0, regularizations: 0, leaves: 0 });
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
        setPendingCounts(prev => ({ ...prev, leaves: leaveReqs.filter(r => r.status === 'pending').length }));
      } catch { /* ignore */ }

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
          const [pp, sr] = await Promise.all([
            getPendingPolicies(),
            getPendingSuperRegularizations()
          ]);
          setPendingCounts({ policies: pp.length, regularizations: sr.length });
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
  const totalPending = pendingCounts.policies + pendingCounts.regularizations + pendingCounts.leaves;

  // Upcoming birthdays within next 14 days
  const upcomingBirthdays = employees
    .filter(e => e.birthday)
    .map(e => {
      const bd = new Date(e.birthday);
      const today = new Date();
      const thisYear = today.getFullYear();
      const next = new Date(thisYear, bd.getMonth(), bd.getDate());
      if (next < today) next.setFullYear(thisYear + 1);
      const diffDays = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
      return { ...e, nextBirthday: next, diffDays };
    })
    .filter(e => e.diffDays <= 14)
    .sort((a, b) => a.diffDays - b.diffDays)
    .slice(0, 5);
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
            Welcome back{user?.name ? `, ${user.name.split(' ')[0].replace(/\b\w/g, c => c.toUpperCase())}` : ''}
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
            {[...Array(2)].map((_, i) => (
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

          {/* ── Upcoming Birthdays + Upcoming Holidays ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--gap)', alignItems: 'start' }}>
            <div>
              <div className="text-base text-bold mb-12">Upcoming Birthdays</div>
              <div className="card card-body-sm">
                {upcomingBirthdays.length === 0 ? (
                  <div className="text-sm text-muted2 text-center" style={{ padding: '12px 0' }}>No upcoming birthdays</div>
                ) : (
                  <div className="flex-col gap-8">
                    {upcomingBirthdays.map((e, i) => {
                      const d = e.nextBirthday;
                      return (
                        <div key={e.code} className="flex items-center gap-12" style={{
                          paddingBottom: i < upcomingBirthdays.length - 1 ? '8px' : 0,
                          borderBottom: i < upcomingBirthdays.length - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <div className="flex-col items-center grid-center flex-shrink-0" style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            background: 'rgba(255,159,10,0.08)',
                          }}>
                            <FiGift size={18} style={{ color: '#ff9f0a' }} />
                          </div>
                          <div>
                            <div className="text-sm text-semibold">{e.name.replace(/\b\w/g, c => c.toUpperCase())}</div>
                            <div className="text-xs text-muted2">{d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}{e.diffDays === 0 ? ' — Today!' : e.diffDays === 1 ? ' — Tomorrow!' : ` — in ${e.diffDays} days`}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
                              <div className="text-sm text-semibold" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {h.name}
                                <span style={{
                                  fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: '4px',
                                  background: (h.isRestricted || h.type === 'optional') ? 'rgba(175,82,222,0.1)' : 'rgba(0,113,227,0.1)',
                                  color: (h.isRestricted || h.type === 'optional') ? '#7b2d8b' : '#0071e3',
                                }}>{(h.isRestricted || h.type === 'optional') ? 'RL' : 'Gazetted'}</span>
                              </div>
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
