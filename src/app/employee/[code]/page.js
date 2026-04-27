"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { getEmployeeHistory, toggleOverride, clearAllOverrides } from '../../../actions/attendance';
import {
  getLeaveBalance, getLeaveRequests, submitLeaveRequest,
  getRegularizations, submitRegularization
} from '../../../actions/leave';
import { getUpcomingHolidays } from '../../../actions/holidays';
import EmployeeModal from '../../../components/EmployeeModal';

const LEAVE_LABELS = { cl: 'Casual Leave', sl: 'Sick Leave', el: 'Earned Leave', rl: 'Restricted Leave' };
const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de' };

export default function EmployeeDashboard({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { isAuthenticated, isAdmin, user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [emp, setEmp] = useState(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [overrides, setOverrides] = useState({});
  const [tab, setTab] = useState('attendance'); // attendance | leaves | regularize

  // Leave state
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [regularizations, setRegularizations] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);

  // Leave form
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'cl', fromDate: '', toDate: '', days: 1, reason: '' });
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Regularization form
  const [regForm, setRegForm] = useState({ date: '', requestedIn: '', requestedOut: '', reason: '' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && user?.employeeCode && user.employeeCode !== code) {
      router.push(`/employee/${user.employeeCode}`);
    }
  }, [isAuthenticated, isAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (isAuthenticated) loadAll();
  }, [isAuthenticated, code]);

  const loadAll = async () => {
    setLoading(true);
    const year = new Date().getFullYear();
    const [data, balance, requests, regs, holidays] = await Promise.all([
      getEmployeeHistory(code),
      getLeaveBalance(code, year),
      getLeaveRequests(code),
      getRegularizations(code),
      getUpcomingHolidays()
    ]);
    if (data) {
      setEmp(data);
      let ov = {};
      data.overrides.forEach(o => { ov[`${data.code}_${o.day}`] = o.type; });
      setOverrides(ov);
    }
    setLeaveBalance(balance);
    setLeaveRequests(requests);
    setRegularizations(regs);
    setUpcomingHolidays(holidays);
    setLoading(false);
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setLeaveError(''); setLeaveSuccess('');
    if (!leaveForm.fromDate) return setLeaveError('Please select a start date.');
    if (!leaveForm.reason.trim()) return setLeaveError('Please provide a reason.');
    setSubmittingLeave(true);
    const result = await submitLeaveRequest(code, {
      ...leaveForm,
      toDate: leaveForm.toDate || leaveForm.fromDate,
      days: parseFloat(leaveForm.days) || 1
    });
    setSubmittingLeave(false);
    if (result.error) return setLeaveError(result.error);
    setLeaveSuccess('Leave request submitted successfully.');
    setLeaveForm({ leaveType: 'cl', fromDate: '', toDate: '', days: 1, reason: '' });
    loadAll();
  };

  const handleSubmitReg = async (e) => {
    e.preventDefault();
    setRegError(''); setRegSuccess('');
    if (!regForm.date) return setRegError('Please select a date.');
    if (!regForm.reason.trim()) return setRegError('Please provide a reason.');
    setSubmittingReg(true);
    const result = await submitRegularization(code, regForm);
    setSubmittingReg(false);
    if (result.error) return setRegError(result.error);
    setRegSuccess('Regularization request submitted.');
    setRegForm({ date: '', requestedIn: '', requestedOut: '', reason: '' });
    loadAll();
  };

  if (authLoading || !isAuthenticated) return null;
  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>;
  if (!emp || emp.records.length === 0) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--red)', fontSize: '14px' }}>Employee not found.</div>;

  const currentRecord = emp.records[selectedMonthIndex];
  const [month, year] = currentRecord.monthYear.split('_');
  const modalCurrentMonth = { month: parseInt(month), year: parseInt(year) };

  const formattedEmployee = {
    code: emp.code, name: emp.name,
    present: currentRecord.present, absent: currentRecord.absent,
    late: currentRecord.late, shortShift: currentRecord.shortShift,
    days: emp.dailyLogs.filter(log => log.monthYear === currentRecord.monthYear).map(dl => ({
      d: dl.day, type: dl.type, raw: dl.raw, inT: dl.inT, outT: dl.outT,
      isLate: dl.isLate, isSS: dl.isSS, isSL: dl.isSL
    }))
  };

  const currentMonthOverrides = {};
  emp.overrides.filter(o => o.monthYear === currentRecord.monthYear)
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
  const handleClearAllOverrides = async (empCode) => {
    setEmp(prev => ({ ...prev, overrides: prev.overrides.filter(o => o.monthYear !== currentRecord.monthYear) }));
    setOverrides({});
    await clearAllOverrides(code, currentRecord.monthYear);
  };

  const formatMonth = (my) => {
    const [m, y] = my.split('_');
    return new Date(y, parseInt(m) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
  };

  const statusBadge = (status) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b' }
    };
    const s = map[status] || map.pending;
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{status}</span>;
  };

  const avgAbsent = (emp.records.reduce((s, r) => s + r.absent, 0) / emp.records.length).toFixed(1);

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }} className="animate-fade-in">

      {/* Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        {isAdmin
          ? <button className="btn btn-secondary" onClick={() => router.push('/')}>← Dashboard</button>
          : <div />
        }
        {!isAdmin && <button className="btn btn-outline" onClick={logout}>Sign Out</button>}
      </div>

      {/* Profile header */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'var(--surface3)', display: 'grid', placeItems: 'center', fontSize: '22px', fontWeight: 700, color: 'var(--text2)' }}>
              {emp.name.charAt(0)}
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em' }}>{emp.name}</h1>
              <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px' }}>Employee #{emp.code}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[
              { label: 'Months Tracked', value: emp.records.length, color: 'var(--text)' },
              { label: 'Avg Absent / mo', value: avgAbsent, color: parseFloat(avgAbsent) >= 3 ? 'var(--red)' : 'var(--text)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.04em', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave balance strip */}
        {leaveBalance && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            {['cl', 'sl', 'el', 'rl'].map(type => {
              const avail = leaveBalance[`${type}Avail`] ?? 0;
              const total = leaveBalance[`${type}Total`] ?? 0;
              const used = leaveBalance[`${type}Used`] ?? 0;
              const pct = total > 0 ? Math.max(0, Math.min(100, (avail / total) * 100)) : 0;
              return (
                <div key={type} style={{ background: 'var(--surface2)', borderRadius: '12px', padding: '14px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{LEAVE_LABELS[type]}</span>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: LEAVE_COLORS[type] }}>{avail}</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--surface3)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: LEAVE_COLORS[type], borderRadius: '2px', transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '5px' }}>{used} used · {total} total</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upcoming holidays */}
        {upcomingHolidays.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Upcoming Holidays</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {upcomingHolidays.map(h => (
                <span key={h.id} style={{ fontSize: '12px', background: 'rgba(255,159,10,0.1)', color: '#b36200', padding: '4px 10px', borderRadius: '980px', fontWeight: 500 }}>
                  🎉 {h.name} — {new Date(h.year, h.month - 1, h.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '20px', width: 'fit-content' }}>
        {[
          { key: 'attendance', label: 'Attendance' },
          { key: 'leaves', label: 'Leave Requests' },
          { key: 'regularize', label: 'Regularization' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'attendance' && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', alignItems: 'start' }}>
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {emp.records.map((r, i) => (
                <button key={r.id} onClick={() => setSelectedMonthIndex(i)} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '9px 12px', borderRadius: '9px', cursor: 'pointer', textAlign: 'left',
                  border: selectedMonthIndex === i ? '1px solid rgba(0,113,227,0.3)' : '1px solid transparent',
                  background: selectedMonthIndex === i ? 'var(--blue-light)' : 'transparent',
                  color: selectedMonthIndex === i ? 'var(--blue)' : 'var(--text2)',
                  fontFamily: 'inherit', fontSize: '13px', fontWeight: selectedMonthIndex === i ? 600 : 400, transition: 'all 0.15s'
                }}>
                  <span>{formatMonth(r.monthYear)}</span>
                  <span style={{ fontSize: '11px', display: 'flex', gap: '4px' }}>
                    {r.absent > 0 && <span style={{ color: 'var(--red)' }}>{r.absent}A</span>}
                    {r.late > 0 && <span style={{ color: 'var(--yellow)' }}>{r.late}L</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '20px' }}>
              {formatMonth(currentRecord.monthYear)}
            </div>
            <div style={{ position: 'relative', height: '760px', overflow: 'hidden' }}>
              <style>{`.emp-inline > div { position: absolute !important; inset: 0 !important; background: transparent !important; backdrop-filter: none !important; } .emp-inline > div > div { width: 100% !important; max-width: 100% !important; height: 100% !important; border: none !important; background: transparent !important; box-shadow: none !important; border-radius: 0 !important; }`}</style>
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
      )}

      {/* ── LEAVE REQUESTS TAB ── */}
      {tab === 'leaves' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          {/* Apply form */}
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>Apply for Leave</div>
            <form onSubmit={handleSubmitLeave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Leave Type</label>
                <select className="input-field" value={leaveForm.leaveType} onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value }))}>
                  <option value="cl">Casual Leave (CL)</option>
                  <option value="sl">Sick Leave (SL)</option>
                  <option value="el">Earned Leave (EL)</option>
                  <option value="rl">Restricted Leave (RL)</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">From Date</label>
                  <input className="input-field" type="date" value={leaveForm.fromDate} onChange={e => setLeaveForm(f => ({ ...f, fromDate: e.target.value, toDate: f.toDate || e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">To Date</label>
                  <input className="input-field" type="date" value={leaveForm.toDate} onChange={e => setLeaveForm(f => ({ ...f, toDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="input-label">Days</label>
                <select className="input-field" value={leaveForm.days} onChange={e => setLeaveForm(f => ({ ...f, days: parseFloat(e.target.value) }))}>
                  <option value={0.5}>Half Day (0.5)</option>
                  <option value={1}>1 Day</option>
                  {[2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} Days</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Reason</label>
                <textarea className="input-field" rows={3} placeholder="Brief reason for leave…" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              {leaveError && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{leaveError}</div>}
              {leaveSuccess && <div style={{ color: 'var(--green)', fontSize: '13px' }}>{leaveSuccess}</div>}
              <button type="submit" className="btn btn-primary" disabled={submittingLeave} style={{ opacity: submittingLeave ? 0.7 : 1 }}>
                {submittingLeave ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          </div>

          {/* Request history */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              My Requests ({leaveRequests.length})
            </div>
            <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {leaveRequests.length === 0
                ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No requests yet.</div>
                : leaveRequests.map(r => (
                  <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>{r.leaveType.toUpperCase()}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{r.days} day{r.days !== 1 ? 's' : ''}</span>
                      </div>
                      {statusBadge(r.status)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{r.reason}</div>
                    {r.reviewNote && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontStyle: 'italic' }}>Note: {r.reviewNote}</div>}
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── REGULARIZATION TAB ── */}
      {tab === 'regularize' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>Regularization Request</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>Missed a punch-in or punch-out? Request a correction here.</div>
            <form onSubmit={handleSubmitReg} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="input-label">Date</label>
                <input className="input-field" type="date" value={regForm.date} onChange={e => setRegForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Punch In (HH:MM)</label>
                  <input className="input-field" type="time" value={regForm.requestedIn} onChange={e => setRegForm(f => ({ ...f, requestedIn: e.target.value }))} />
                </div>
                <div>
                  <label className="input-label">Punch Out (HH:MM)</label>
                  <input className="input-field" type="time" value={regForm.requestedOut} onChange={e => setRegForm(f => ({ ...f, requestedOut: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="input-label">Reason</label>
                <textarea className="input-field" rows={3} placeholder="Why was the punch missed?" value={regForm.reason} onChange={e => setRegForm(f => ({ ...f, reason: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              {regError && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{regError}</div>}
              {regSuccess && <div style={{ color: 'var(--green)', fontSize: '13px' }}>{regSuccess}</div>}
              <button type="submit" className="btn btn-primary" disabled={submittingReg} style={{ opacity: submittingReg ? 0.7 : 1 }}>
                {submittingReg ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              My Regularizations ({regularizations.length})
            </div>
            <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
              {regularizations.length === 0
                ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No requests yet.</div>
                : regularizations.map(r => (
                  <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {statusBadge(r.status)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      {r.requestedIn && `In: ${r.requestedIn}`}{r.requestedIn && r.requestedOut && ' · '}{r.requestedOut && `Out: ${r.requestedOut}`}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>{r.reason}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
