"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getHolidays, addHoliday, deleteHoliday } from '../../actions/holidays';
import { getActiveShiftPolicy, saveShiftPolicy, getShiftPolicyHistory } from '../../actions/shiftPolicy';
import { getAuditLog } from '../../actions/audit';
import { getAllEmployees, addEmployee, deleteEmployee, deleteMonthRecord, getMonths } from '../../actions/attendance';
import { changePassword } from '../../actions/auth';
import { sendAllMonthlyReports } from '../../actions/notifications';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function SettingsPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('holidays');

  // Holidays
  const year = new Date().getFullYear();
  const [holidays, setHolidays] = useState([]);
  const [hForm, setHForm] = useState({ month: 1, day: 1, name: '', type: 'national' });
  const [hMsg, setHMsg] = useState('');

  // Shift policy
  const [policy, setPolicy] = useState({ shiftStartH: 10, shiftStartM: 0, graceMinutes: 15, minHours: 9, latesPerHD: 3, ssPerHD: 3 });
  const [policyHistory, setPolicyHistory] = useState([]);
  const [policyMsg, setPolicyMsg] = useState('');

  // Audit log
  const [auditLog, setAuditLog] = useState([]);

  // Employees
  const [employees, setEmployees] = useState([]);
  const [empForm, setEmpForm] = useState({ code: '', name: '' });
  const [empMsg, setEmpMsg] = useState('');
  const [months, setMonths] = useState([]);

  // Change password
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Notifications
  const [notifMonth, setNotifMonth] = useState('');
  const [notifMsg, setNotifMsg] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin]);

  const loadAll = async () => {
    setLoading(true);
    const [h, sp, hist, emps, ms] = await Promise.all([
      getHolidays(year),
      getActiveShiftPolicy(),
      getShiftPolicyHistory(),
      getAllEmployees(),
      getMonths()
    ]);
    setHolidays(h);
    setPolicy({ shiftStartH: sp.shiftStartH, shiftStartM: sp.shiftStartM, graceMinutes: sp.graceMinutes, minHours: sp.minHours, latesPerHD: sp.latesPerHD, ssPerHD: sp.ssPerHD });
    setPolicyHistory(hist);
    setEmployees(emps);
    setMonths(ms);
    if (ms.length > 0) setNotifMonth(ms[0]);
    if (isSuperAdmin) {
      const logs = await getAuditLog({ limit: 100 });
      setAuditLog(logs);
    }
    setLoading(false);
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!hForm.name.trim()) return setHMsg('Please enter a holiday name.');
    await addHoliday(year, hForm.month, hForm.day, hForm.name.trim(), hForm.type);
    setHMsg(`Added: ${hForm.name}`);
    setHForm(f => ({ ...f, name: '' }));
    const h = await getHolidays(year);
    setHolidays(h);
  };

  const handleDeleteHoliday = async (id) => {
    await deleteHoliday(id);
    const h = await getHolidays(year);
    setHolidays(h);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    await saveShiftPolicy(policy);
    setPolicyMsg('Policy saved and activated.');
    const hist = await getShiftPolicyHistory();
    setPolicyHistory(hist);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.code.trim() || !empForm.name.trim()) return setEmpMsg('Code and name are required.');
    const result = await addEmployee(empForm.code.trim(), empForm.name.trim(), user.username);
    if (result.error) return setEmpMsg(result.error);
    setEmpMsg(`Added: ${empForm.name}`);
    setEmpForm({ code: '', name: '' });
    const emps = await getAllEmployees();
    setEmployees(emps);
  };

  const handleDeleteEmployee = async (code, name) => {
    if (!confirm(`Delete ${name} and ALL their attendance data? This cannot be undone.`)) return;
    await deleteEmployee(code, user.username);
    const emps = await getAllEmployees();
    setEmployees(emps);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError(''); setPwMsg('');
    if (pwForm.newPw !== pwForm.confirm) return setPwError('New passwords do not match.');
    if (pwForm.newPw.length < 6) return setPwError('Password must be at least 6 characters.');
    const result = await changePassword(user.id, pwForm.current, pwForm.newPw);
    if (result.error) return setPwError(result.error);
    setPwMsg('Password changed successfully.');
    setPwForm({ current: '', newPw: '', confirm: '' });
  };

  const handleSendReports = async () => {
    if (!notifMonth) return;
    setNotifMsg('Sending…');
    const results = await sendAllMonthlyReports(notifMonth);
    const sent = results.filter(r => r.success).length;
    const skipped = results.filter(r => r.skipped).length;
    setNotifMsg(`Done. Sent: ${sent}, Skipped (no email): ${skipped}`);
  };

  const formatMonth = (m) => {
    const [mo, yr] = m.split('_');
    return new Date(yr, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const tabs = [
    { key: 'holidays', label: 'Holidays' },
    { key: 'shift', label: 'Shift Policy' },
    { key: 'employees', label: 'Employees' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'password', label: 'Change Password' },
    ...(isSuperAdmin ? [{ key: 'audit', label: 'Audit Log' }] : []),
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1000px', margin: '0 auto' }} className="animate-fade-in">
      <button className="btn btn-secondary" style={{ marginBottom: '20px' }} onClick={() => router.push('/')}>← Dashboard</button>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Settings</h1>
        <p style={{ color: 'var(--text2)', fontSize: '14px', marginTop: '4px' }}>Holidays, shift policy, employees, notifications and security.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>}

      {/* ── HOLIDAYS ── */}
      {!loading && tab === 'holidays' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Add Holiday — {year}</div>
            <form onSubmit={handleAddHoliday} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="input-label">Month</label>
                  <select className="input-field" value={hForm.month} onChange={e => setHForm(f => ({ ...f, month: parseInt(e.target.value) }))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Day</label>
                  <input className="input-field" type="number" min={1} max={31} value={hForm.day} onChange={e => setHForm(f => ({ ...f, day: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="input-label">Holiday Name</label>
                <input className="input-field" placeholder="e.g. Republic Day" value={hForm.name} onChange={e => setHForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Type</label>
                <select className="input-field" value={hForm.type} onChange={e => setHForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="national">National Holiday</option>
                  <option value="optional">Optional Holiday</option>
                </select>
              </div>
              {hMsg && <div style={{ fontSize: '13px', color: 'var(--green)' }}>{hMsg}</div>}
              <button type="submit" className="btn btn-primary">Add Holiday</button>
            </form>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              {year} Holidays ({holidays.length})
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {holidays.length === 0
                ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No holidays added yet.</div>
                : holidays.map(h => (
                  <div key={h.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{h.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)', marginLeft: '8px' }}>{MONTHS[h.month - 1]} {h.day}</span>
                      <span style={{ fontSize: '11px', color: h.type === 'national' ? 'var(--blue)' : 'var(--orange)', marginLeft: '8px', fontWeight: 500 }}>{h.type}</span>
                    </div>
                    <button onClick={() => handleDeleteHoliday(h.id)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── SHIFT POLICY ── */}
      {!loading && tab === 'shift' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Shift Configuration</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>Changes apply to new uploads only — existing data is not recalculated.</div>
            <form onSubmit={handleSavePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Shift Start Hour (0–23)', key: 'shiftStartH', min: 0, max: 23 },
                { label: 'Shift Start Minute (0–59)', key: 'shiftStartM', min: 0, max: 59 },
                { label: 'Grace Period (minutes)', key: 'graceMinutes', min: 0, max: 60 },
                { label: 'Minimum Working Hours', key: 'minHours', min: 1, max: 12, step: 0.5 },
                { label: 'Lates per Half-Day Deduction', key: 'latesPerHD', min: 1, max: 10 },
                { label: 'Short Shifts per Half-Day Deduction', key: 'ssPerHD', min: 1, max: 10 },
              ].map(({ label, key, min, max, step }) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', flex: 1 }}>{label}</label>
                  <input type="number" min={min} max={max} step={step || 1} className="input-field"
                    style={{ width: '80px', padding: '8px 12px', textAlign: 'center' }}
                    value={policy[key]} onChange={e => setPolicy(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
              <div style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: 'var(--text2)' }}>
                Current: Shift {String(policy.shiftStartH).padStart(2,'0')}:{String(policy.shiftStartM).padStart(2,'0')} · Late after +{policy.graceMinutes}min · Min {policy.minHours}h · {policy.latesPerHD} lates = 1 HD · {policy.ssPerHD} SS = 1 HD
              </div>
              {policyMsg && <div style={{ fontSize: '13px', color: 'var(--green)' }}>{policyMsg}</div>}
              <button type="submit" className="btn btn-primary">Save & Activate</button>
            </form>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>Policy History</div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {policyHistory.map((p, i) => (
                <div key={p.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>
                      {String(p.shiftStartH).padStart(2,'0')}:{String(p.shiftStartM).padStart(2,'0')} · {p.graceMinutes}min grace · {p.minHours}h min
                    </span>
                    {p.isActive && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--green)', background: 'rgba(52,199,89,0.1)', padding: '2px 8px', borderRadius: '980px' }}>Active</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>{new Date(p.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── EMPLOYEES ── */}
      {!loading && tab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Add Employee Manually</div>
            <form onSubmit={handleAddEmployee} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label className="input-label">Employee Code</label>
                <input className="input-field" placeholder="e.g. 1042" value={empForm.code} onChange={e => setEmpForm(f => ({ ...f, code: e.target.value }))} style={{ width: '120px' }} />
              </div>
              <div>
                <label className="input-label">Full Name</label>
                <input className="input-field" placeholder="e.g. John Doe" value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} style={{ width: '220px' }} />
              </div>
              <button type="submit" className="btn btn-primary">Add Employee</button>
              {empMsg && <span style={{ fontSize: '13px', color: empMsg.includes('already') ? 'var(--red)' : 'var(--green)', alignSelf: 'center' }}>{empMsg}</span>}
            </form>
          </div>

          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              All Employees ({employees.length})
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Code', 'Name', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={{ background: 'var(--surface2)', padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.code} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 16px', color: 'var(--text2)', fontSize: '12px' }}>{emp.code}</td>
                      <td style={{ padding: '11px 16px', fontWeight: 500 }}>{emp.name}</td>
                      <td style={{ padding: '11px 16px', color: 'var(--text2)', fontSize: '12px' }}>{new Date(emp.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <button onClick={() => handleDeleteEmployee(emp.code, emp.name)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {!loading && tab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Monthly Report Emails</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>
              Send attendance summary emails to all employees who have an email address linked to their account.
              Requires <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: '4px' }}>RESEND_API_KEY</code> and <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: '4px' }}>ADMIN_EMAIL</code> in environment variables.
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Select Month</label>
                <select className="input-field" value={notifMonth} onChange={e => setNotifMonth(e.target.value)}>
                  {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleSendReports}>Send Reports</button>
            </div>
            {notifMsg && <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--green)' }}>{notifMsg}</div>}
          </div>

          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Email Configuration</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 }}>
              Add these to your Vercel environment variables:
            </div>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'RESEND_API_KEY', desc: 'Your Resend API key (resend.com)' },
                { key: 'ADMIN_EMAIL', desc: 'Admin email for high-absence alerts' },
                { key: 'EMAIL_FROM', desc: 'From address (e.g. noreply@yourdomain.com)' },
                { key: 'NEXT_PUBLIC_APP_URL', desc: 'Your app URL (e.g. https://ibeesattendance.vercel.app)' },
              ].map(({ key, desc }) => (
                <div key={key} style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--blue)' }}>{key}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD ── */}
      {!loading && tab === 'password' && (
        <div className="card" style={{ padding: '24px', maxWidth: '400px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Change Password</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>Logged in as <strong>{user?.username}</strong></div>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="input-label">Current Password</label>
              <input className="input-field" type="password" value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">New Password</label>
              <input className="input-field" type="password" value={pwForm.newPw} onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))} />
            </div>
            <div>
              <label className="input-label">Confirm New Password</label>
              <input className="input-field" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
            {pwError && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{pwError}</div>}
            {pwMsg && <div style={{ color: 'var(--green)', fontSize: '13px' }}>{pwMsg}</div>}
            <button type="submit" className="btn btn-primary">Update Password</button>
          </form>
        </div>
      )}

      {/* ── AUDIT LOG (super_admin only) ── */}
      {!loading && tab === 'audit' && isSuperAdmin && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
            Audit Log (last 100 actions)
          </div>
          <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
            {auditLog.length === 0
              ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No audit entries yet.</div>
              : auditLog.map(log => (
                <div key={log.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, background: 'var(--surface2)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace', color: 'var(--blue)' }}>{log.action}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>by <strong>{log.performedBy}</strong></span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{log.detail}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
