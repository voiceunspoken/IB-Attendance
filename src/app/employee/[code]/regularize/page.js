"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../components/AuthProvider';
import { getRegularizations, submitRegularization } from '../../../../actions/leave';
import { getDailyLogForDate } from '../../../../actions/attendance';
import { requestRegularizationChange } from '../../../../actions/attendanceChanges';
import { useEmployeeData } from '../context';
import { FiSun, FiAlertTriangle } from 'react-icons/fi';

const TYPE_LABELS = {
  missing_punch: 'Missing Punch (Both)',
  missing_punch_in: 'Missing Punch In',
  missing_punch_out: 'Missing Punch Out',
  present: 'Present',
  absent: 'Absent',
  half: 'Half Day',
  late: 'Late Present',
  wfh: 'Work From Home (WFH)',
  wos: 'Work From Office/Site (WOS)',
  wfm: 'Work From Mobile (WFM)',
  wfo: 'Work From Office (WFO)',
  cl: 'Casual Leave (CL)',
  sl: 'Sick Leave (SL)',
  el: 'Earned Leave (EL)',
  rl: 'Restricted Leave (RL)',
  sh: 'Short Leave (SH)',
  ul: 'Unpaid Leave (UL)',
};

const TYPE_GROUPS = [
  { label: 'Punch Corrections', types: ['missing_punch', 'missing_punch_in', 'missing_punch_out'] },
  { label: 'Attendance Changes', types: ['present', 'absent', 'half', 'late'] },
  { label: 'Work Types', types: ['wfh', 'wos', 'wfm', 'wfo'] },
  { label: 'Leave Types', types: ['cl', 'sl', 'el', 'rl', 'sh', 'ul'] },
];

const TYPE_COLORS = {
  present: { bg: 'rgba(52,199,89,0.1)', color: '#34c759' },
  absent: { bg: 'rgba(255,59,48,0.1)', color: '#ff3b30' },
  half: { bg: 'rgba(255,159,10,0.1)', color: '#ff9f0a' },
  late: { bg: 'rgba(255,159,10,0.1)', color: '#b36200' },
  wfh: { bg: 'rgba(175,82,222,0.1)', color: '#af52de' },
  wos: { bg: 'rgba(48,176,199,0.1)', color: '#30b0c7' },
  wfm: { bg: 'rgba(52,199,89,0.1)', color: '#34c759' },
  wfo: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
  cl: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
  sl: { bg: 'rgba(255,159,10,0.1)', color: '#ff9f0a' },
  el: { bg: 'rgba(52,199,89,0.1)', color: '#34c759' },
  rl: { bg: 'rgba(175,82,222,0.1)', color: '#af52de' },
  sh: { bg: 'rgba(255,107,107,0.1)', color: '#ff6b6b' },
  ul: { bg: 'rgba(142,142,147,0.1)', color: '#8e8e93' },
};

const TYPE_DISPLAY_LABELS = {
  missing_punch: 'Missing Punch',
  missing_punch_in: 'Missing Punch In',
  missing_punch_out: 'Missing Punch Out',
  present: 'Present', absent: 'Absent', half: 'Half Day', late: 'Late',
  wfh: 'WFH', wos: 'WOS', wfm: 'WFM', wfo: 'WFO',
  cl: 'CL', sl: 'SL', el: 'EL', rl: 'RL', sh: 'SH', ul: 'UL',
};

export default function RegularizePage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const { emp, triggerRefetch } = useEmployeeData();
  const router = useRouter();

  const [regularizations, setRegularizations] = useState([]);
  const [regForm, setRegForm] = useState({ date: '', type: 'missing_punch', requestedIn: '', requestedOut: '', reason: '', shiftSlot: '10-12' });
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);
  const [currentLog, setCurrentLog] = useState(null);
  const [fetchedDate, setFetchedDate] = useState(null);
  const loadingLog = regForm.date && regForm.date !== fetchedDate;
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!code) return;
    getRegularizations(code).then(setRegularizations).catch(() => setRegularizations([]));
  }, [code, triggerRefetch]);

  useEffect(() => {
    if (!code || !regForm.date) return;
    let cancelled = false;
    getDailyLogForDate(code, regForm.date).then(log => {
      if (!cancelled) {
        setCurrentLog(log);
        setFetchedDate(regForm.date);
      }
    }).catch(() => {
      if (!cancelled) {
        setCurrentLog(null);
        setFetchedDate(regForm.date);
      }
    });
    return () => { cancelled = true; };
  }, [code, regForm.date]);

  const isPunchType = ['missing_punch', 'missing_punch_in', 'missing_punch_out'].includes(regForm.type);
  const isAttendanceChange = !isPunchType;

  const statusBadge = (status) => {
    const map = {
      pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'Pending' },
      approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
      rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' }
    };
    const s = map[status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: status.charAt(0).toUpperCase() + status.slice(1) };
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const renderCurrentStatus = () => {
    if (!regForm.date) return <span style={{ color: 'var(--text3)' }}>Select a date first</span>;
    if (loadingLog) return <span style={{ color: 'var(--text3)' }}>Loading…</span>;
    if (!currentLog) return <span style={{ color: 'var(--text3)' }}>No record for this date</span>;
    const tc = TYPE_COLORS[currentLog.type] || {};
    const label = TYPE_DISPLAY_LABELS[currentLog.type] || currentLog.type;
    const times = [];
    if (currentLog.inT !== null) times.push(`${Math.floor(currentLog.inT / 60)}:${String(currentLog.inT % 60).padStart(2, '0')}`);
    if (currentLog.outT !== null) times.push(`${Math.floor(currentLog.outT / 60)}:${String(currentLog.outT % 60).padStart(2, '0')}`);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ padding: '2px 8px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: tc.bg || 'rgba(0,0,0,0.05)', color: tc.color || 'var(--text2)' }}>{label}</span>
        {times.length > 0 && <span style={{ color: 'var(--text3)', fontSize: '12px' }}>({times.join(' – ')})</span>}
      </span>
    );
  };

  const handleSubmitReg = async (e) => {
    e.preventDefault();
    setRegError(''); setRegSuccess('');
    if (!regForm.date) return setRegError('Please select a date.');
    if (!regForm.reason.trim()) return setRegError('Please provide a reason.');

    const fmtTime = (t) => t || null;
    setSubmittingReg(true);

    if (isPunchType) {
      const result = await submitRegularization(code, {
        date: regForm.date,
        type: regForm.type,
        requestedIn: fmtTime(regForm.requestedIn),
        requestedOut: fmtTime(regForm.requestedOut),
        reason: regForm.reason,
      });
      setSubmittingReg(false);
      if (result.error) return setRegError(result.error);
      setRegSuccess('Regularization request submitted.');
    } else {
      const d = new Date(regForm.date);
      const monthYear = `${d.getMonth() + 1}_${d.getFullYear()}`;
      const day = d.getDate();
      const currentType = currentLog?.type || 'absent';
      const newType = regForm.type;
      const result = await requestRegularizationChange(
        code, monthYear, day, currentType, newType, regForm.reason, user?.username
      );
      setSubmittingReg(false);
      if (result?.error) return setRegError(result.error);
      const warningMsg = result?.warning ? ` Warning: ${result.warning}` : '';
      setRegSuccess(`Attendance change request submitted.${warningMsg}`);
    }

    setRegForm({ date: '', type: 'missing_punch', requestedIn: '', requestedOut: '', reason: '', shiftSlot: '10-12' });
    setCurrentLog(null);
    triggerRefetch();
  };

  if (!emp) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>Regularization Request</div>
        <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>Request a correction or change for any day.</div>
        <form onSubmit={handleSubmitReg} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Date</label>
            <input className="input-field" type="date" value={regForm.date} onChange={e => setRegForm(f => ({ ...f, date: e.target.value }))} />
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Current: {renderCurrentStatus()}
            </div>
          </div>

          <div>
            <label className="input-label">Change Type</label>
            <select className="input-field" value={regForm.type} onChange={e => setRegForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.types.map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {isPunchType && (
            <div style={{ display: 'grid', gridTemplateColumns: regForm.type === 'missing_punch' ? '1fr 1fr' : '1fr', gap: '10px' }}>
              {regForm.type !== 'missing_punch_out' && (
                <div>
                  <label className="input-label">Punch In (HH:MM)</label>
                  <input className="input-field" type="time" value={regForm.requestedIn} onChange={e => setRegForm(f => ({ ...f, requestedIn: e.target.value }))} />
                </div>
              )}
              {regForm.type !== 'missing_punch_in' && (
                <div>
                  <label className="input-label">Punch Out (HH:MM)</label>
                  <input className="input-field" type="time" value={regForm.requestedOut} onChange={e => setRegForm(f => ({ ...f, requestedOut: e.target.value }))} />
                </div>
              )}
            </div>
          )}

          {regForm.type === 'sh' && (
            <div>
              <label className="input-label">Shift Slot (2 hours)</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                {['10-12', '5-7'].map(slot => (
                  <label key={slot} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                    border: regForm.shiftSlot === slot ? '2px solid #ff6b6b' : '2px solid var(--border)',
                    background: regForm.shiftSlot === slot ? 'rgba(255,107,107,0.08)' : 'var(--surface2)',
                    fontWeight: regForm.shiftSlot === slot ? 600 : 400, fontSize: '13px', transition: 'all 0.15s'
                  }}>
                    <input type="radio" name="shiftSlot" value={slot} checked={regForm.shiftSlot === slot}
                      onChange={e => setRegForm(f => ({ ...f, shiftSlot: e.target.value }))} style={{ display: 'none' }} />
                    <div>{slot === '10-12' ? <><FiSun size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> 10:00 AM – 12:00 PM</> : <><FiSun size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> 5:00 PM – 7:00 PM</>}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {isAttendanceChange && currentLog && regForm.type !== 'sl' && regForm.type !== 'sh' && (
            <div style={{ fontSize: '12px', padding: '10px 14px', background: 'rgba(255,159,10,0.06)', borderRadius: '10px', color: 'var(--text2)' }}>
              <FiAlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Change from <strong>{TYPE_DISPLAY_LABELS[currentLog.type] || currentLog.type}</strong> to <strong>{TYPE_LABELS[regForm.type] || regForm.type}</strong>
            </div>
          )}

          <div>
            <label className="input-label">Reason</label>
            <textarea className="input-field" rows={3} placeholder="Why are you requesting this change?" value={regForm.reason} onChange={e => setRegForm(f => ({ ...f, reason: e.target.value }))} style={{ resize: 'vertical' }} />
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
          My Requests ({regularizations.length})
        </div>
        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
          {regularizations.length === 0
            ? <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No requests yet.</div>
            : regularizations.map(r => {
                let payload = {};
                let isAc = false;
                try { if (r.type === 'attendance_change') { payload = JSON.parse(r.reason); isAc = true; } } catch { /* invalid JSON */ }
                const typeLabel = r.type === 'attendance_change'
                  ? `${TYPE_DISPLAY_LABELS[payload.currentType] || payload.currentType} → ${TYPE_DISPLAY_LABELS[payload.newType] || payload.newType}`
                  : TYPE_DISPLAY_LABELS[r.type] || r.type?.replace(/_/g, ' ') || 'Request';
                return (
                  <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {r.type === 'attendance_change' && (
                          <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '980px', background: 'rgba(255,107,53,0.1)', color: '#ff6b35', fontWeight: 500 }}>{typeLabel}</span>
                        )}
                      </div>
                      {statusBadge(r.status)}
                    </div>
                    {r.type !== 'attendance_change' && (
                      <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        <span style={{ fontWeight: 500 }}>{typeLabel}</span>
                        {r.requestedIn && ` · In: ${r.requestedIn}`}{r.requestedOut && ` · Out: ${r.requestedOut}`}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
                      {isAc ? (payload.reason || r.reason) : r.reason}
                    </div>
                    {r.status === 'rejected' && r.reviewNote && (
                      <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--red)', marginTop: '4px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(255,59,48,0.06)' }}>
                        Rejection note: {r.reviewNote}
                      </div>
                    )}
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}
