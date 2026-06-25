"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../components/AuthProvider';
import { getTeamMembers } from '../../../../actions/employees';
import { getWfhRequests } from '../../../../actions/wfh';
import { getLeaveRequests, getRegularizations } from '../../../../actions/leave';
import { useEmployeeData } from '../context';
import ClockWidget from '../../../../components/ClockWidget';
import { FiCalendar, FiFileText, FiHome, FiTool, FiArrowRight } from 'react-icons/fi';

export default function EmployeeDashboard({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const { emp, leaveBalance, upcomingHolidays } = useEmployeeData();
  const router = useRouter();

  const [approvedLocation, setApprovedLocation] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({ leaves: 0, wfh: 0, regularizations: 0 });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}/dashboard`);
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!code) return;
    const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today = fmtLocal(new Date());
    getWfhRequests(code).then(requests => {
      const approvedToday = requests.find(r =>
        r.status === 'approved' && fmtLocal(new Date(r.date)) === today
      );
      if (approvedToday) setApprovedLocation(approvedToday.workType);
      setPendingCounts(prev => ({ ...prev, wfh: requests.filter(r => r.status === 'pending').length }));
    }).catch(() => {});
  }, [code]);

  useEffect(() => {
    if (!code) return;
    getLeaveRequests(code).then(requests => {
      setPendingCounts(prev => ({ ...prev, leaves: requests.filter(r => r.status === 'pending').length }));
    }).catch(() => {});
  }, [code]);

  useEffect(() => {
    if (!code) return;
    getRegularizations(code).then(requests => {
      setPendingCounts(prev => ({ ...prev, regularizations: requests.filter(r => r.status === 'pending').length }));
    }).catch(() => {});
  }, [code]);

  useEffect(() => {
    getTeamMembers(code).then(setTeamMembers).catch(() => setTeamMembers([]));
  }, [code]);

  if (!emp) return null;

  const showClockWidget = true;
  const clockLocations = approvedLocation ? [approvedLocation] : null;

  const leaveCards = leaveBalance ? [
    { label: 'CL', remaining: leaveBalance.clRemaining, total: leaveBalance.clTotal || leaveBalance.clAccrued, color: '#0071e3' },
    { label: 'SL', remaining: leaveBalance.slRemaining, total: leaveBalance.slTotal, color: '#34c759' },
    { label: 'EL', remaining: leaveBalance.elRemaining, total: leaveBalance.elTotal, color: '#af52de' },
    { label: 'RL', remaining: leaveBalance.rlRemaining, total: leaveBalance.rlTotal, color: '#ff9f0a' },
    { label: 'SH', remaining: leaveBalance.shRemaining, total: leaveBalance.shTotal, color: '#ff6b35' },
  ] : [];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: 'linear-gradient(135deg, #0071e3 0%, #002d5a 100%)',
        borderRadius: '16px', padding: '24px 28px', marginBottom: '20px',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: 500, opacity: 0.75, marginBottom: '4px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', margin: '0' }}>
            Welcome, {emp.name.replace(/\b\w/g, c => c.toUpperCase())}
          </h1>
        </div>
        <div style={{ position: 'absolute', top: '-30px', right: '-20px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: '-50px', right: '40px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {showClockWidget && (
        <ClockWidget code={code} employeeType={emp.employeeType} allowedLocations={clockLocations} />
      )}

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Leave Balance</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {leaveCards.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text3)' }}>No leave data available</div>
          ) : leaveCards.map(c => (
            <div key={c.label} className="card" style={{
              flex: '1 0 100px', padding: '14px 16px', textAlign: 'center',
              minWidth: '100px', maxWidth: '140px',
            }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: c.color }}>{c.remaining}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', marginTop: '2px' }}>{c.label}</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>of {c.total}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignContent: 'start' }}>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Pending Requests</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Leave Requests', icon: FiFileText, color: '#0071e3', count: pendingCounts.leaves },
              { label: 'Work Mode Requests', icon: FiHome, color: '#af52de', count: pendingCounts.wfh },
              { label: 'Regularizations', icon: FiTool, color: '#ff6b35', count: pendingCounts.regularizations },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', borderRadius: '8px', background: 'var(--surface2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <item.icon size={14} style={{ color: item.color }} />
                  <span>{item.label}</span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: item.count > 0 ? 'var(--orange)' : 'var(--text3)' }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'View Attendance', icon: FiCalendar, route: `/employee/${code}`, color: '#0071e3' },
              { label: 'Apply Leave', icon: FiFileText, route: `/employee/${code}/leaves`, color: '#34c759' },
              { label: 'Request Work Mode', icon: FiHome, route: `/employee/${code}/wfh`, color: '#af52de' },
              { label: 'Regularize', icon: FiTool, route: `/employee/${code}/regularize`, color: '#ff6b35' },
            ].map(a => (
              <button key={a.label} onClick={() => router.push(a.route)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px',
                  fontWeight: 600, color: 'var(--text)', textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface3)'; e.currentTarget.style.borderColor = a.color + '40'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: a.color + '15', display: 'grid', placeItems: 'center',
                }}>
                  <a.icon size={15} style={{ color: a.color }} />
                </div>
                <span style={{ flex: 1 }}>{a.label}</span>
                <FiArrowRight size={14} style={{ color: 'var(--text3)' }} />
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Upcoming Holidays</div>
          {!upcomingHolidays || upcomingHolidays.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text3)', padding: '8px 0' }}>No upcoming holidays</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {upcomingHolidays.slice(0, 5).map((h, i) => {
                const d = new Date(h.year, h.month - 1, h.day);
                return (
                  <div key={`${h.year}-${h.month}-${h.day}`} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    paddingBottom: i < upcomingHolidays.slice(0, 5).length - 1 ? '8px' : 0,
                    borderBottom: i < upcomingHolidays.slice(0, 5).length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      width: '38px', height: '38px', borderRadius: '8px',
                      background: 'rgba(0,113,227,0.06)', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text3)', lineHeight: 1 }}>{d.toLocaleString('en', { month: 'short' })}</span>
                      <span style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.2 }}>{h.day}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {h.name}
                        <span style={{
                          fontSize: '9px', fontWeight: 600, padding: '1px 6px', borderRadius: '3px',
                          background: (h.isRestricted || h.type === 'optional') ? 'rgba(175,82,222,0.1)' : 'rgba(0,113,227,0.1)',
                          color: (h.isRestricted || h.type === 'optional') ? '#7b2d8b' : '#0071e3',
                        }}>{(h.isRestricted || h.type === 'optional') ? 'RL' : 'Gazetted'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{d.toLocaleDateString('en-US', { weekday: 'long' })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Team Today</div>
          {teamMembers.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text3)', padding: '8px 0' }}>No team members found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {teamMembers.map(m => (
                <div key={m.code} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', background: 'var(--surface2)' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: m.statusColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text3)' }}>
                      {m.department && <span>{m.department}{m.designation && ' · '}</span>}
                      {m.designation && <span>{m.designation}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: m.statusColor, whiteSpace: 'nowrap' }}>{m.statusLabel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
