"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { useToast } from '../../components/Toast';
import { getHolidays, deleteHoliday, seedIBHolidays } from '../../actions/holidays';
import {
  addHolidayPending, getPendingHolidays, approveHoliday, rejectHoliday,
  uploadHolidayXlsx
} from '../../actions/holidayAdmin';
import { getActiveShiftPolicy, saveShiftPolicy, getShiftPolicyHistory, getPendingPolicies, reviewPolicy } from '../../actions/shiftPolicy';

import { getSuperAdminConfig, setRequireSuperApproval } from '../../actions/superAdminConfig';
import { getMonths } from '../../actions/attendance';
import { changePassword } from '../../actions/auth';
import { sendAllMonthlyReports } from '../../actions/notifications';
import ConfirmModal from '../../components/ConfirmModal';
import { FiSun, FiClock, FiPlus } from 'react-icons/fi';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function SettingsPage() {
  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const toast = useToast();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const router = useRouter();
  const [tab, setTab] = useState('holidays');

  // Holidays
  const year = new Date().getFullYear();
  const [holidays, setHolidays] = useState([]);
  const [hForm, setHForm] = useState({ month: 1, day: 1, name: '', isRestricted: false });
  const [hMsg, setHMsg] = useState('');
  const [hSubTab, setHSubTab] = useState('gazette'); // gazette | restricted | pending
  const [pendingHolidays, setPendingHolidays] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);

  // Shift policy
  const [policy, setPolicy] = useState({ shiftStartH: 10, shiftStartM: 0, graceMinutes: 15, minHours: 9, latesPerHD: 3, ssPerHD: 3 });
  const [policyHistory, setPolicyHistory] = useState([]);
  const [pendingPolicies, setPendingPolicies] = useState([]);
  const [policyMsg, setPolicyMsg] = useState('');

  const [months, setMonths] = useState([]);

  // Change password
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Notifications
  const [notifMonth, setNotifMonth] = useState('');
  const [notifMsg, setNotifMsg] = useState('');

  const [approvalConfig, setApprovalConfig] = useState(null);
  const [approvalMsg, setApprovalMsg] = useState('');

  const [confirmState, setConfirmState] = useState({ show: false, message: '', confirmLabel: 'Delete', confirmLoadingLabel: 'Deleting…', variant: 'danger', onConfirm: null });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, isSuperAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) return;
    (async () => {
      try {
        const [h, sp, hist, ms] = await Promise.all([
          getHolidays(year),
          getActiveShiftPolicy(),
          getShiftPolicyHistory(),
          getMonths(),
        ]);
        setHolidays(h);
        if (isSuperAdmin) {
          const ph = await getPendingHolidays(year);
          setPendingHolidays(ph);
        }
        setPolicy({ shiftStartH: sp.shiftStartH, shiftStartM: sp.shiftStartM, graceMinutes: sp.graceMinutes, minHours: sp.minHours, latesPerHD: sp.latesPerHD, ssPerHD: sp.ssPerHD });
        setPolicyHistory(hist);
        setMonths(ms);
        if (ms.length > 0) setNotifMonth(ms[0]);
        if (isSuperAdmin) {
          const pp = await getPendingPolicies();
          setPendingPolicies(pp);
          const ac = await getSuperAdminConfig();
          setApprovalConfig(ac);
        }
      } catch {
        setHolidays([]);
        setMonths([]);
        setPendingPolicies([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, isSuperAdmin, year]);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!hForm.name.trim()) return setHMsg('Please enter a holiday name.');
    const result = await addHolidayPending(year, hForm.month, hForm.day, hForm.name.trim(), hForm.isRestricted, user.username);
    if (result.error) return setHMsg(result.error);
    setHMsg(`Added pending: ${hForm.name}`);
    setHForm(f => ({ ...f, name: '' }));
    const [h, ph] = await Promise.all([getHolidays(year), getPendingHolidays(year)]);
    setHolidays(h);
    setPendingHolidays(ph);
  };

  const handleDeleteHoliday = (id) => {
    setConfirmState({
      show: true,
      message: 'Remove this holiday?',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        const result = await deleteHoliday(id);
        if (result.error) { toast.error(result.error); return; }
        toast.success('Holiday removed.');
        const [h, ph] = await Promise.all([getHolidays(year), getPendingHolidays(year)]);
        setHolidays(h);
        setPendingHolidays(ph);
      },
    });
  };

  const handleSeedHolidays = () => {
    setConfirmState({
      show: true,
      message: `Seed all IB official holidays for ${year}? Existing entries will be updated.`,
      confirmLabel: 'Seed',
      confirmLoadingLabel: 'Seeding…',
      variant: 'default',
      onConfirm: async () => {
        await seedIBHolidays(year);
        const [h, ph] = await Promise.all([getHolidays(year), getPendingHolidays(year)]);
        setHolidays(h);
        setPendingHolidays(ph);
        setHMsg(`Seeded IB holidays for ${year}.`);
      },
    });
  };

  const handleUploadHolidays = async () => {
    if (!uploadFile) return setHMsg('Please select a file.');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rows = text.split('\n').filter(Boolean).map(line => line.split(','));
      const result = await uploadHolidayXlsx(rows, year, user.username);
      setHMsg(`Uploaded: ${result.added} added, ${result.skipped} skipped${result.errors.length ? `, ${result.errors.length} errors` : ''}`);
      setUploadFile(null);
      const [h, ph] = await Promise.all([getHolidays(year), getPendingHolidays(year)]);
      setHolidays(h);
      setPendingHolidays(ph);
    };
    reader.readAsText(uploadFile);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    await saveShiftPolicy(policy);
    setPolicyMsg('Policy saved and activated.');
    const hist = await getShiftPolicyHistory();
    setPolicyHistory(hist);
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

  if (authLoading || !isAuthenticated || (!isAdmin && !isSuperAdmin)) return null;

  const tabs = [
    { key: 'holidays', label: 'Holidays' },
    { key: 'shift', label: 'Shift Policy' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'password', label: 'Change Password' },
    ...(isSuperAdmin ? [{ key: 'approvals', label: 'Approvals' }] : []),
  ];

  return (
    <div className="animate-fade-in" style={{ padding: '24px 28px', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="mb-20">
        <h1 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.04em' }}>Settings</h1>
        <p className="text-muted text-base" style={{ marginTop: '4px' }}>Holidays, shift policy, employees, notifications and security.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 bg-surface2" style={{ borderRadius: '10px', padding: '3px', marginBottom: '24px', border: '1px solid var(--border)', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className="btn border-none" style={{
            padding: '6px 16px', borderRadius: '7px', fontSize: '13px',
            background: tab === t.key ? 'var(--surface)' : 'transparent',
            color: tab === t.key ? 'var(--text)' : 'var(--text2)',
            boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {loading && <div className="p-32 text-center text-muted text-base">Loading…</div>}

      {/* ── HOLIDAYS ── */}
      {!loading && tab === 'holidays' && (
        <div className="flex-col gap-16">
          {/* Sub-tabs */}
          <div className="flex gap-4 bg-surface2" style={{ borderRadius: '10px', padding: '3px', width: 'fit-content' }}>
            {[
              { key: 'gazette', label: `Gazette (${holidays.filter(h => !h.isRestricted && h.type === 'national').length})` },
              { key: 'restricted', label: `Restricted (${holidays.filter(h => h.isRestricted || h.type === 'optional').length})` },
              ...(isSuperAdmin ? [{ key: 'pending', label: `Pending (${pendingHolidays.length})` }] : []),
            ].map(t => (
              <button key={t.key} onClick={() => setHSubTab(t.key)} className="btn border-none" style={{
                padding: '6px 16px', borderRadius: '7px', fontSize: '13px',
                background: hSubTab === t.key ? 'var(--surface)' : 'transparent',
                color: hSubTab === t.key ? 'var(--text)' : 'var(--text2)',
                boxShadow: hSubTab === t.key ? 'var(--shadow-sm)' : 'none',
              }}>{t.label}</button>
            ))}
          </div>

          {/* Gazette / Restricted list */}
          {(hSubTab === 'gazette' || hSubTab === 'restricted') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
              <div className="card card-body">
                <div className="text-md text-bold mb-12">Add {hSubTab === 'gazette' ? 'Gazette' : 'Restricted'} Holiday — {year}</div>
                <form onSubmit={handleAddHoliday} className="flex-col gap-12">
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
                  {hSubTab === 'restricted' && (
                    <div className="text-xs text-muted" style={{ background: 'rgba(175,82,222,0.08)', borderRadius: '10px', padding: '10px 14px' }}>
                      This will be added as a restricted holiday (RL-eligible, pending super admin approval).
                    </div>
                  )}
                  {hMsg && <div className="text-sm" style={{ color: hMsg.startsWith('Added') ? 'var(--green)' : 'var(--red)' }}>{hMsg}</div>}
                  <button type="submit" className="btn btn-primary">Submit for Approval</button>
                  <button type="button" className="btn btn-secondary" onClick={handleSeedHolidays}>
                    Seed IB Holidays {year}
                  </button>
                </form>

                {/* CSV Upload */}
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div className="text-sm text-semibold mb-6">Bulk Upload (CSV)</div>
                  <div className="text-xs text-muted mb-10">
                    Format: Date (DD/MM/YYYY), Name, Type (gazette/restricted). One per line.
                  </div>
                  <input type="file" accept=".csv,.xlsx" className="input-field" style={{ padding: '8px', fontSize: '12px' }}
                    onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  <button type="button" className="btn btn-secondary" style={{ marginTop: '8px', fontSize: '12px', padding: '6px 14px' }}
                    onClick={handleUploadHolidays} disabled={!uploadFile}>
                    Upload & Submit for Approval
                  </button>
                </div>
              </div>

              <div className="card overflow-hidden p-0">
                <div className="card-header">
                  {hSubTab === 'gazette' ? 'Gazette' : 'Restricted'} Holidays ({holidays.filter(h => hSubTab === 'gazette' ? (!h.isRestricted || h.type === 'national') : (h.isRestricted || h.type === 'optional')).length})
                </div>
                <div className="scroll-y" style={{ maxHeight: '400px' }}>
                  {holidays.filter(h => hSubTab === 'gazette' ? (!h.isRestricted || h.type === 'national') : (h.isRestricted || h.type === 'optional')).length === 0
                    ? <div className="p-32 text-center">
                        <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25, color: 'var(--text3)' }}><FiSun size={36} /></div>
                        <div className="text-md text-semibold mb-2 text-muted">No holidays added yet</div>
                        <div className="text-sm text-muted2 mb-16">Add your first holiday to get started.</div>
<button className="btn btn-primary btn-sm" onClick={() => setHSubTab('add')}><FiPlus size={14} /> Add Your First Holiday</button>
                      </div>
                    : holidays.filter(h => hSubTab === 'gazette' ? (!h.isRestricted || h.type === 'national') : (h.isRestricted || h.type === 'optional')).map(h => (
                      <div key={h.id} className="flex-between border-bottom" style={{ padding: '12px 20px' }}>
                        <div>
                          <span className="text-sm text-medium">{h.name}</span>
                          <span className="text-xs text-muted" style={{ marginLeft: '8px' }}>{MONTHS[h.month - 1]} {h.day}</span>
                          {h.status === 'pending' && <span className="badge" style={{ background: 'rgba(255,159,10,0.1)', color: '#b36200', marginLeft: '6px' }}>Pending</span>}
                        </div>
                        <button onClick={() => handleDeleteHoliday(h.id)} className="btn btn-outline btn-xs" style={{ color: 'var(--red)', borderColor: 'rgba(255,59,48,0.25)' }}>Remove</button>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* Pending Holidays — super admin approval */}
          {hSubTab === 'pending' && isSuperAdmin && (
            <div className="card overflow-hidden p-0">
              <div className="card-header">
                Pending Holiday Approvals ({pendingHolidays.length})
              </div>
              {pendingHolidays.length === 0
                ? <div className="p-32 text-center">
                    <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25, color: 'var(--text3)' }}><FiSun size={36} /></div>
                    <div className="text-md text-semibold mb-2 text-muted">No pending holidays</div>
                    <div className="text-sm text-muted2 mb-16">Add a holiday proposal for super admin approval.</div>
                    <button onClick={() => setHSubTab('add')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--blue)', color: '#fff' }}><FiPlus size={14} /> Add Your First Holiday</button>
                  </div>
                : pendingHolidays.map(h => (
                  <div key={h.id} className="flex-between border-bottom gap-12" style={{ padding: '14px 20px' }}>
                    <div>
                      <span className="text-sm text-medium">{h.name}</span>
                      <span className="text-xs text-muted" style={{ marginLeft: '8px' }}>{MONTHS[h.month - 1]} {h.day}</span>
                      <span className="text-xs text-semibold" style={{ color: h.isRestricted ? 'var(--purple)' : 'var(--blue)', marginLeft: '6px' }}>
                        {h.isRestricted ? 'Restricted' : 'Gazette'}
                      </span>
                      <div className="text-xs text-muted2" style={{ marginTop: '2px' }}>By {h.createdBy || 'admin'} · {new Date(h.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-6">
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }}
                        onClick={async () => {
                          await approveHoliday(h.id, user.username);
                          const [hd, ph] = await Promise.all([getHolidays(year), getPendingHolidays(year)]);
                          setHolidays(hd); setPendingHolidays(ph);
                        }}>Approve</button>
                      <button className="btn border-none" style={{ padding: '6px 14px', fontSize: '12px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                        onClick={async () => {
                          await rejectHoliday(h.id, user.username);
                          const [hd, ph] = await Promise.all([getHolidays(year), getPendingHolidays(year)]);
                          setHolidays(hd); setPendingHolidays(ph);
                        }}>Reject</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ── SHIFT POLICY ── */}
      {!loading && tab === 'shift' && (
        <div className="flex-col gap-16">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
          <div className="card card-body">
            <div className="text-md text-bold mb-6">Shift Configuration</div>
            <div className="text-sm text-muted mb-20">Changes apply to new uploads only — existing data is not recalculated.</div>
            <form onSubmit={handleSavePolicy} className="flex-col gap-14">
              {[
                { label: 'Shift Start Hour (0–23)', key: 'shiftStartH', min: 0, max: 23 },
                { label: 'Shift Start Minute (0–59)', key: 'shiftStartM', min: 0, max: 59 },
                { label: 'Grace Period (minutes)', key: 'graceMinutes', min: 0, max: 60 },
                { label: 'Minimum Working Hours', key: 'minHours', min: 1, max: 12, step: 0.5 },
                { label: 'Lates per Half-Day Deduction', key: 'latesPerHD', min: 1, max: 10 },
                { label: 'Short Shifts per Half-Day Deduction', key: 'ssPerHD', min: 1, max: 10 },
              ].map(({ label, key, min, max, step }) => (
                <div key={key} className="flex-between gap-16">
                  <label className="text-base text-medium" style={{ flex: 1 }}>{label}</label>
                  <input type="number" min={min} max={max} step={step || 1} className="input-field text-center"
                    style={{ width: '80px', padding: '8px 12px' }}
                    value={policy[key]} onChange={e => setPolicy(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
              <div className="text-sm text-muted" style={{ background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px' }}>
                Current: Shift {String(policy.shiftStartH).padStart(2,'0')}:{String(policy.shiftStartM).padStart(2,'0')} · Late after +{policy.graceMinutes}min · Min {policy.minHours}h · {policy.latesPerHD} lates = 1 HD · {policy.ssPerHD} SS = 1 HD
              </div>
              {policyMsg && <div className="text-sm" style={{ color: 'var(--green)' }}>{policyMsg}</div>}
              <button type="submit" className="btn btn-primary">Save & Activate</button>
            </form>
          </div>

          <div className="card overflow-hidden p-0">
            <div className="card-header">Policy History</div>
            <div className="scroll-y" style={{ maxHeight: '400px' }}>
              {policyHistory.length === 0
                ? <div className="p-32 text-center">
                    <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25, color: 'var(--text3)' }}><FiClock size={36} /></div>
                    <div className="text-md text-semibold mb-2 text-muted">Policy has never been changed</div>
                    <div className="text-sm text-muted2">Create a new policy above and activate it to see history here.</div>
                  </div>
                : policyHistory.map((p) => (
                <div key={p.id} className="border-bottom p-12-20">
                  <div className="flex-between">
                    <span className="text-sm text-medium">
                      {String(p.shiftStartH).padStart(2,'0')}:{String(p.shiftStartM).padStart(2,'0')} · {p.graceMinutes}min grace · {p.minHours}h min
                    </span>
                    {p.isActive && <span className="badge" style={{ background: 'rgba(52,199,89,0.1)', color: 'var(--green)' }}>Active</span>}
                  </div>
                  <div className="text-xs text-muted2" style={{ marginTop: '3px' }}>{new Date(p.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
        )}

        {isSuperAdmin && pendingPolicies.length > 0 && (
          <div className="card overflow-hidden p-0">
            <div className="card-header">
              Pending Policy Approvals ({pendingPolicies.length})
            </div>
            {pendingPolicies.map(p => (
              <div key={p.id} className="flex-between border-bottom gap-12" style={{ padding: '14px 20px' }}>
                <div>
                  <div className="text-sm text-medium">
                    {String(p.shiftStartH).padStart(2,'0')}:{String(p.shiftStartM).padStart(2,'0')} · {p.graceMinutes}min grace · {p.minHours}h min · {p.latesPerHD} lates = 1 HD · {p.ssPerHD} SS = 1 HD
                  </div>
                  <div className="text-xs text-muted2" style={{ marginTop: '2px' }}>
                    By {p.createdBy || 'admin'} · {new Date(p.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-6">
                  <button className="btn btn-primary btn-sm"
                    onClick={async () => { await reviewPolicy(p.id, user.username, true); const pp = await getPendingPolicies(); setPendingPolicies(pp); }}>
                    Approve
                  </button>
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--red)', borderColor: 'rgba(255,59,48,0.25)' }}
                    onClick={async () => { await reviewPolicy(p.id, user.username, false); const pp = await getPendingPolicies(); setPendingPolicies(pp); }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* ── NOTIFICATIONS ── */}
      {!loading && tab === 'notifications' && (
        <div className="flex-col gap-16" style={{ maxWidth: '560px' }}>
          <div className="card card-body">
            <div className="text-md text-bold mb-6">Monthly Report Emails</div>
            <div className="text-sm text-muted mb-20">
              Send attendance summary emails to all employees who have an email on their account.
            </div>
            <div className="flex gap-10 items-end">
              <div style={{ flex: 1 }}>
                <label className="input-label">Select Month</label>
                <select className="input-field" value={notifMonth} onChange={e => setNotifMonth(e.target.value)}>
                  {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleSendReports}>Send Reports</button>
            </div>
            {notifMsg && <div className="text-sm mt-12" style={{ color: notifMsg.includes('error') ? 'var(--red)' : 'var(--green)' }}>{notifMsg}</div>}
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD ── */}
      {!loading && tab === 'password' && (
        <div className="card p-24" style={{ maxWidth: '400px' }}>
          <div className="text-md text-bold mb-6">Change Password</div>
          <div className="text-sm text-muted mb-20">Logged in as <strong>{user?.username}</strong></div>
          <form onSubmit={handleChangePassword} className="flex-col gap-14">
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
            {pwError && <div className="text-sm" style={{ color: 'var(--red)' }}>{pwError}</div>}
            {pwMsg && <div className="text-sm" style={{ color: 'var(--green)' }}>{pwMsg}</div>}
            <button type="submit" className="btn btn-primary">Update Password</button>
          </form>
        </div>
      )}

      {/* ── APPROVALS (super_admin only) ── */}
      {!loading && tab === 'approvals' && isSuperAdmin && (
        <div className="flex-col gap-16" style={{ maxWidth: '560px' }}>
          <div className="card card-body">
            <div className="text-md text-bold mb-6">Super Admin Approval</div>
            <div className="text-sm text-muted mb-20">
              Controls whether leave requests and other items require final approval from a Super Admin after manager approval.
            </div>
            <div className="flex-between gap-16" style={{ padding: '14px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <div className="text-sm text-semibold">Require Super Admin Approval</div>
                <div className="text-xs text-muted" style={{ marginTop: '2px' }}>
                  {approvalConfig?.requireSuperApproval
                    ? 'Leave requests need super admin final approval after managers approve.'
                    : 'Leave requests are fully approved once managers approve; no super admin step.'}
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} checked={!!approvalConfig?.requireSuperApproval}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setApprovalConfig(c => c ? { ...c, requireSuperApproval: val } : { requireSuperApproval: val, id: '' });
                    await setRequireSuperApproval(val, user.username);
                    setApprovalMsg(val ? 'Super admin approval required.' : 'Super admin approval not required.');
                  }} />
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '12px', transition: '0.2s',
                  background: approvalConfig?.requireSuperApproval ? 'var(--green)' : 'var(--border)',
                }}>
                  <span style={{
                    position: 'absolute', top: '2px', left: approvalConfig?.requireSuperApproval ? '22px' : '2px',
                    width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: '0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </span>
              </label>
            </div>
            {approvalMsg && <div className="text-sm" style={{ color: 'var(--green)', marginTop: '8px' }}>{approvalMsg}</div>}
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmState.show && (
        <ConfirmModal
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          confirmLoadingLabel={confirmState.confirmLoadingLabel}
          variant={confirmState.variant}
          onConfirm={async () => {
            await confirmState.onConfirm();
            setConfirmState(s => ({ ...s, show: false }));
          }}
          onCancel={() => setConfirmState(s => ({ ...s, show: false }))}
        />
      )}
    </div>
  );
}
