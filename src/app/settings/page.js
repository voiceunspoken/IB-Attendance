"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/AuthProvider';
import { getHolidays, deleteHoliday, seedIBHolidays } from '../../actions/holidays';
import {
  addHolidayPending, getPendingHolidays, approveHoliday, rejectHoliday,
  deletePendingHoliday, uploadHolidayXlsx
} from '../../actions/holidayAdmin';
import { getActiveShiftPolicy, saveShiftPolicy, getShiftPolicyHistory, getPendingPolicies, reviewPolicy } from '../../actions/shiftPolicy';
import { getAuditLog } from '../../actions/audit';
import { getMonths } from '../../actions/attendance';
import { changePassword } from '../../actions/auth';
import { sendAllMonthlyReports } from '../../actions/notifications';
import ConfirmModal from '../../components/ConfirmModal';
import { FiSun, FiClock, FiPlus, FiUser, FiCalendar, FiFileText, FiSettings, FiAward, FiRefreshCw, FiFilter, FiChevronDown } from 'react-icons/fi';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function SettingsPage() {
  const { isAdmin, isSuperAdmin, isAuthenticated, user, loading: authLoading } = useAuth();
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

  // Audit log
  const [auditLog, setAuditLog] = useState([]);
  const [auditFilterEntity, setAuditFilterEntity] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterPerformer, setAuditFilterPerformer] = useState('');

  const [months, setMonths] = useState([]);

  // Change password
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Notifications
  const [notifMonth, setNotifMonth] = useState('');
  const [notifMsg, setNotifMsg] = useState('');

  const [confirmState, setConfirmState] = useState({ show: false, message: '', confirmLabel: 'Delete', confirmLoadingLabel: 'Deleting…', variant: 'danger', onConfirm: null });

  const [loading, setLoading] = useState(true);

  const fetchAuditLog = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const logs = await getAuditLog({ limit: 200 });
      setAuditLog(logs);
    } catch { setAuditLog([]); }
  }, [isSuperAdmin]);

  const ENTITY_META = {
    user: { icon: <FiUser size={14} />, color: '#0071e3', bg: 'rgba(0,113,227,0.08)', label: 'User' },
    employee: { icon: <FiCalendar size={14} />, color: '#34c759', bg: 'rgba(52,199,89,0.08)', label: 'Employee' },
    leave_request: { icon: <FiFileText size={14} />, color: '#ff9f0a', bg: 'rgba(255,159,10,0.08)', label: 'Leave' },
    attendance_policy: { icon: <FiSettings size={14} />, color: '#af52de', bg: 'rgba(175,82,222,0.08)', label: 'Policy' },
    holiday: { icon: <FiSun size={14} />, color: '#ff6b35', bg: 'rgba(255,107,53,0.08)', label: 'Holiday' },
    pending_change: { icon: <FiAward size={14} />, color: '#5ac8fa', bg: 'rgba(90,200,250,0.08)', label: 'Change' },
    super_admin_config: { icon: <FiSettings size={14} />, color: '#ff3b30', bg: 'rgba(255,59,48,0.08)', label: 'Config' },
  };

  const getEntityMeta = (entity) => ENTITY_META[entity] || { icon: <FiFileText size={14} />, color: 'var(--text2)', bg: 'var(--surface2)', label: entity };

  const groupByDate = (entries) => {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const groups = { today: [], yesterday: [], week: [], older: [] };
    entries.forEach(e => {
      const d = new Date(e.createdAt); d.setHours(0,0,0,0);
      if (+d === +today) groups.today.push(e);
      else if (+d === +yesterday) groups.yesterday.push(e);
      else if (d >= weekStart) groups.week.push(e);
      else groups.older.push(e);
    });
    return groups;
  };

  const filteredLog = useMemo(() => {
    let items = auditLog;
    if (auditFilterEntity) items = items.filter(l => l.entity === auditFilterEntity);
    if (auditFilterAction) items = items.filter(l => l.action === auditFilterAction);
    if (auditFilterPerformer) items = items.filter(l => l.performedBy === auditFilterPerformer);
    return groupByDate(items);
  }, [auditLog, auditFilterEntity, auditFilterAction, auditFilterPerformer]);

  const filterOptions = useMemo(() => {
    const entities = [...new Set(auditLog.map(l => l.entity))].sort();
    const actions = [...new Set(auditLog.map(l => l.action))].sort();
    const performers = [...new Set(auditLog.map(l => l.performedBy))].sort();
    return { entities, actions, performers };
  }, [auditLog]);

  const getDateGroupLabel = (key) => {
    const labels = { today: 'Today', yesterday: 'Yesterday', week: 'This Week', older: 'Older' };
    return labels[key] || key;
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin) router.push('/');
  }, [isAuthenticated, isAdmin, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
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
          const logs = await getAuditLog({ limit: 200 });
          setAuditLog(logs);
          const pp = await getPendingPolicies();
          setPendingPolicies(pp);
        }
      } catch {
        setHolidays([]);
        setMonths([]);
        setAuditLog([]);
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
        if (isSuperAdmin) {
          await deletePendingHoliday(id, user.username);
        } else {
          await deleteHoliday(id);
        }
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

  if (authLoading || !isAuthenticated || !isAdmin) return null;

  const tabs = [
    { key: 'holidays', label: 'Holidays' },
    { key: 'shift', label: 'Shift Policy' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'password', label: 'Change Password' },
    ...(isSuperAdmin ? [{ key: 'audit', label: 'Audit Log' }] : []),
  ];

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1000px', margin: '0 auto' }} className="animate-fade-in">
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface3)', borderRadius: '10px', padding: '3px', width: 'fit-content' }}>
            {[
              { key: 'gazette', label: `Gazette (${holidays.filter(h => !h.isRestricted && h.type === 'national').length})` },
              { key: 'restricted', label: `Restricted (${holidays.filter(h => h.isRestricted || h.type === 'optional').length})` },
              ...(isSuperAdmin ? [{ key: 'pending', label: `Pending (${pendingHolidays.length})` }] : []),
            ].map(t => (
              <button key={t.key} onClick={() => setHSubTab(t.key)} style={{
                padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: hSubTab === t.key ? 'var(--surface)' : 'transparent',
                color: hSubTab === t.key ? 'var(--text)' : 'var(--text2)',
                boxShadow: hSubTab === t.key ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s'
              }}>{t.label}</button>
            ))}
          </div>

          {/* Gazette / Restricted list */}
          {(hSubTab === 'gazette' || hSubTab === 'restricted') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
              <div className="card" style={{ padding: '22px 24px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Add {hSubTab === 'gazette' ? 'Gazette' : 'Restricted'} Holiday — {year}</div>
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
                  {hSubTab === 'restricted' && (
                    <div style={{ fontSize: '12px', color: 'var(--text2)', background: 'rgba(175,82,222,0.08)', borderRadius: '10px', padding: '10px 14px' }}>
                      This will be added as a restricted holiday (RL-eligible, pending super admin approval).
                    </div>
                  )}
                  {hMsg && <div style={{ fontSize: '13px', color: hMsg.startsWith('Added') ? 'var(--green)' : 'var(--red)' }}>{hMsg}</div>}
                  <button type="submit" className="btn btn-primary">Submit for Approval</button>
                  <button type="button" className="btn btn-secondary" onClick={handleSeedHolidays}>
                    Seed IB Holidays {year}
                  </button>
                </form>

                {/* CSV Upload */}
                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Bulk Upload (CSV)</div>
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '10px' }}>
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

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
                  {hSubTab === 'gazette' ? 'Gazette' : 'Restricted'} Holidays ({holidays.filter(h => hSubTab === 'gazette' ? (!h.isRestricted || h.type === 'national') : (h.isRestricted || h.type === 'optional')).length})
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {holidays.filter(h => hSubTab === 'gazette' ? (!h.isRestricted || h.type === 'national') : (h.isRestricted || h.type === 'optional')).length === 0
                    ? <div style={{ padding: '40px', textAlign: 'center' }}>
                        <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25, color: 'var(--text3)' }}><FiSun size={36} /></div>
                        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: 'var(--text2)' }}>No holidays added yet</div>
                        <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>Add your first holiday to get started.</div>
                        <button onClick={() => setHSubTab('add')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--accent)', color: '#fff' }}><FiPlus size={14} /> Add Your First Holiday</button>
                      </div>
                    : holidays.filter(h => hSubTab === 'gazette' ? (!h.isRestricted || h.type === 'national') : (h.isRestricted || h.type === 'optional')).map(h => (
                      <div key={h.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 500, fontSize: '13px' }}>{h.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text2)', marginLeft: '8px' }}>{MONTHS[h.month - 1]} {h.day}</span>
                          {h.status === 'pending' && <span style={{ fontSize: '10px', background: 'rgba(255,159,10,0.1)', color: '#b36200', padding: '1px 6px', borderRadius: '980px', marginLeft: '6px' }}>Pending</span>}
                        </div>
                        <button onClick={() => handleDeleteHoliday(h.id)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* Pending Holidays — super admin approval */}
          {hSubTab === 'pending' && isSuperAdmin && (
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
                Pending Holiday Approvals ({pendingHolidays.length})
              </div>
              {pendingHolidays.length === 0
                ? <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25, color: 'var(--text3)' }}><FiSun size={36} /></div>
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: 'var(--text2)' }}>No pending holidays</div>
                    <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>Add a holiday proposal for super admin approval.</div>
                    <button onClick={() => setHSubTab('add')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--accent)', color: '#fff' }}><FiPlus size={14} /> Add Your First Holiday</button>
                  </div>
                : pendingHolidays.map(h => (
                  <div key={h.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{h.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)', marginLeft: '8px' }}>{MONTHS[h.month - 1]} {h.day}</span>
                      <span style={{ fontSize: '11px', color: h.isRestricted ? 'var(--purple)' : 'var(--blue)', marginLeft: '6px', fontWeight: 500 }}>
                        {h.isRestricted ? 'Restricted' : 'Gazette'}
                      </span>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>By {h.createdBy || 'admin'} · {new Date(h.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }}
                        onClick={async () => {
                          await approveHoliday(h.id, user.username);
                          const [hd, ph] = await Promise.all([getHolidays(year), getPendingHolidays(year)]);
                          setHolidays(hd); setPendingHolidays(ph);
                        }}>Approve</button>
                      <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              {policyHistory.length === 0
                ? <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25, color: 'var(--text3)' }}><FiClock size={36} /></div>
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: 'var(--text2)' }}>Policy has never been changed</div>
                    <div style={{ fontSize: '13px', color: 'var(--text3)' }}>Create a new policy above and activate it to see history here.</div>
                  </div>
                : policyHistory.map((p) => (
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
        </div>
        )}

        {isSuperAdmin && pendingPolicies.length > 0 && (
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
              Pending Policy Approvals ({pendingPolicies.length})
            </div>
            {pendingPolicies.map(p => (
              <div key={p.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    {String(p.shiftStartH).padStart(2,'0')}:{String(p.shiftStartM).padStart(2,'0')} · {p.graceMinutes}min grace · {p.minHours}h min · {p.latesPerHD} lates = 1 HD · {p.ssPerHD} SS = 1 HD
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                    By {p.createdBy || 'admin'} · {new Date(p.createdAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px', background: 'var(--green)' }}
                    onClick={async () => { await reviewPolicy(p.id, user.username, true); const pp = await getPendingPolicies(); setPendingPolicies(pp); }}>
                    Approve
                  </button>
                  <button style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)', background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
          <div className="card" style={{ padding: '22px 24px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Monthly Report Emails</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '20px' }}>
              Send attendance summary emails to all employees who have an email on their account.
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
            {notifMsg && <div style={{ marginTop: '12px', fontSize: '13px', color: notifMsg.includes('error') ? 'var(--red)' : 'var(--green)' }}>{notifMsg}</div>}
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
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Audit Log ({auditLog.length} entries)</span>
            <button className="btn btn-outline" style={{ fontSize: '12px', padding: '5px 12px' }} onClick={fetchAuditLog}>
              <FiRefreshCw size={12} style={{ marginRight: '4px' }} /> Refresh
            </button>
          </div>

          {/* Filters */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface2)' }}>
            <FiFilter size={13} style={{ color: 'var(--text2)' }} />
            <select value={auditFilterEntity} onChange={e => setAuditFilterEntity(e.target.value)}
              className="input-field" style={{ padding: '5px 10px', fontSize: '12px', width: 'auto', minWidth: '120px' }}>
              <option value="">All Entities</option>
              {filterOptions.entities.map(e => (
                <option key={e} value={e}>{getEntityMeta(e).label}</option>
              ))}
            </select>
            <select value={auditFilterAction} onChange={e => setAuditFilterAction(e.target.value)}
              className="input-field" style={{ padding: '5px 10px', fontSize: '12px', width: 'auto', minWidth: '130px' }}>
              <option value="">All Actions</option>
              {filterOptions.actions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={auditFilterPerformer} onChange={e => setAuditFilterPerformer(e.target.value)}
              className="input-field" style={{ padding: '5px 10px', fontSize: '12px', width: 'auto', minWidth: '120px' }}>
              <option value="">All Users</option>
              {filterOptions.performers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(auditFilterEntity || auditFilterAction || auditFilterPerformer) && (
              <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => { setAuditFilterEntity(''); setAuditFilterAction(''); setAuditFilterPerformer(''); }}>
                Clear
              </button>
            )}
          </div>

          <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
            {auditLog.length === 0
              ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No audit entries yet.</div>
              : Object.entries(filteredLog).map(([groupKey, entries]) =>
                  entries.length === 0 ? null : (
                    <div key={groupKey}>
                      <div style={{ padding: '8px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                        {getDateGroupLabel(groupKey)} — {entries.length} event{entries.length !== 1 ? 's' : ''}
                      </div>
                      {entries.map(log => {
                        const meta = getEntityMeta(log.entity);
                        return (
                          <div key={log.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: meta.bg, color: meta.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              {meta.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600 }}>{log.performedBy}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{log.action.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: '10px', background: meta.bg, color: meta.color, padding: '1px 7px', borderRadius: '980px', fontWeight: 500 }}>{meta.label}</span>
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.4 }}>{log.detail}</div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )
            }
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
