"use client";

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../components/AuthProvider';
import { useEmployeeData } from '../context';
import { submitWfhRequest, getWfhRequests } from '../../../../actions/wfh';
import { FiHome, FiMapPin, FiServer, FiBriefcase } from 'react-icons/fi';

const WORK_TYPE_CONFIG = {
  wfh: { label: 'Work From Home', icon: FiHome, color: '#af52de', short: 'WFH' },
  wos: { label: 'Work On Site', icon: FiMapPin, color: '#30b0c7', short: 'WOS' },
  wfm: { label: 'Work From Ministry', icon: FiServer, color: '#34c759', short: 'WFM' },
  wfo: { label: 'Work From Office', icon: FiBriefcase, color: '#0071e3', short: 'WFO' },
};

const STATUS_COLORS = {
  pending: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'Pending' },
  approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
  rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
};

const STAGE_LABELS = {
  pending_mgr: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'With Manager' },
  pending_l2: { bg: 'rgba(0,113,227,0.1)', color: '#0071e3', label: 'With Manager' },
  pending_l1: { bg: 'rgba(255,159,10,0.1)', color: '#b36200', label: 'With Manager' },
  pending_super: { bg: 'rgba(175,82,222,0.1)', color: '#7b2d8b', label: 'Awaiting Super Admin' },
  approved: { bg: 'rgba(52,199,89,0.1)', color: '#1a7f37', label: 'Approved' },
  rejected: { bg: 'rgba(255,59,48,0.1)', color: '#c0392b', label: 'Rejected' },
};

export default function WfhPage({ params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  const { role, isAuthenticated, user, loading: authLoading } = useAuth();
  const isAdmin = role === 'admin';
  const isSuperAdmin = role === 'super_admin';
  const { emp, triggerRefetch } = useEmployeeData();
  const router = useRouter();

  const isHybrid = emp?.employeeType === 'hybrid';

  const [wfhRequests, setWfhRequests] = useState([]);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [workType, setWorkType] = useState('wfh');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
    if (!authLoading && isAuthenticated && !isAdmin && !isSuperAdmin && user?.code && user.code !== code) {
      router.push(`/employee/${user.code}`);
    }
  }, [isAuthenticated, isAdmin, isSuperAdmin, user, authLoading, router, code]);

  useEffect(() => {
    if (!code) return;
    getWfhRequests(code).then(setWfhRequests).catch(() => setWfhRequests([]));
  }, [code, triggerRefetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!date) return setError('Please select a date.');
    if (!reason.trim()) return setError('Please provide a reason.');
    setSubmitting(true);
    const result = await submitWfhRequest(code, { date, reason: reason.trim(), workType });
    setSubmitting(false);
    if (result.error) return setError(result.error);
    setSuccess('Request submitted successfully.');
    setDate('');
    setReason('');
    setWorkType('wfh');
    triggerRefetch();
    getWfhRequests(code).then(setWfhRequests);
  };

  if (!emp) return null;

  const allowedTypes = isHybrid ? ['wfh', 'wos', 'wfm', 'wfo'] : ['wfh', 'wos'];

  const StatusBadge = ({ status }) => {
    const s = STATUS_COLORS[status] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)', label: status.charAt(0).toUpperCase() + status.slice(1) };
    return <span style={{ display: 'inline-flex', padding: '2px 9px', borderRadius: '980px', fontSize: '11px', fontWeight: 600, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  const StageBadge = ({ stage, approverName }) => {
    const label = stage === 'pending_mgr' && approverName ? `With ${approverName}` : (STAGE_LABELS[stage]?.label || stage?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || stage);
    const s = STAGE_LABELS[stage] || { bg: 'rgba(0,0,0,0.05)', color: 'var(--text2)' };
    return <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '980px', fontSize: '10px', fontWeight: 600, background: s.bg, color: s.color }}>{label}</span>;
  };

  const renderWorkTypeIcon = (wt) => {
    const cfg = WORK_TYPE_CONFIG[wt];
    if (!cfg) return null;
    const Icon = cfg.icon;
    return <Icon size={13} style={{ color: cfg.color }} />;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>Apply for Work Mode</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Work Mode</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {allowedTypes.map(wt => {
                const cfg = WORK_TYPE_CONFIG[wt];
                const Icon = cfg.icon;
                const selected = workType === wt;
                return (
                  <button key={wt} type="button" onClick={() => setWorkType(wt)}
                    style={{
                      flex: 1, minWidth: '80px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                      padding: '10px 8px', borderRadius: '10px',
                      border: selected ? `2px solid ${cfg.color}` : '1.5px solid var(--border)',
                      background: selected ? cfg.color + '12' : 'var(--surface2)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '11px', fontWeight: 600, color: selected ? cfg.color : 'var(--text2)',
                      transition: 'all 0.15s ease',
                    }}>
                    <Icon size={20} />
                    <span>{cfg.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="input-label">Date</label>
            <input className="input-field" type="date" value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="input-label">Reason</label>
            <textarea className="input-field" rows={3} placeholder="Brief reason…" value={reason}
              onChange={e => setReason(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</div>}
          {success && <div style={{ color: 'var(--green)', fontSize: '13px' }}>{success}</div>}
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 700 }}>
          My Requests ({wfhRequests.length})
        </div>
        <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
          {wfhRequests.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No requests yet.</div>
          ) : (
            wfhRequests.map(r => {
              const cfg = WORK_TYPE_CONFIG[r.workType] || WORK_TYPE_CONFIG.wfh;
              return (
                <div key={r.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {renderWorkTypeIcon(r.workType)}
                      <span style={{ fontSize: '13px', fontWeight: 600, color: cfg.color }}>{cfg.short}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                        {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {r.approvalStage && r.status === 'pending' && <StageBadge stage={r.approvalStage} approverName={r.currentApprover?.name} />}
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{r.reason}</div>
                  {r.reviewNote && (
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontStyle: 'italic' }}>Note: {r.reviewNote}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
