"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../components/AuthProvider';
import { getManagedEmployees } from '../../../actions/departments';
import { getManagerLeaveRequests } from '../../../actions/leave';
import { FiUsers, FiArrowRight, FiClipboard, FiChevronRight } from 'react-icons/fi';

const LEAVE_COLORS = { cl: '#0071e3', sl: '#ff9f0a', el: '#34c759', rl: '#af52de', sh: '#ff6b6b' };

export default function MyTeamPage() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user?.code) return;
    (async () => {
      try {
        const [members, leaves] = await Promise.all([
          getManagedEmployees(user.code),
          getManagerLeaveRequests(user.code)
        ]);
        if (!members || members.length === 0) { router.push('/'); return; }
        setTeam(members);
        setPendingLeaves(leaves || []);
      } catch {
        router.push('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, authLoading, user?.code, router]);

  if (authLoading || !isAuthenticated || loading) return null;

  const thStyle = {
    background: 'var(--surface2)', padding: '10px 16px', textAlign: 'left',
    fontWeight: 600, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.05em', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  };
  const tdStyle = { padding: '11px 16px', fontSize: '13px', color: 'var(--text)', borderBottom: '1px solid var(--border)' };

  return (
    <div className="page-wrapper animate-fade-in">

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0071e3 0%, #002d5a 100%)',
        borderRadius: '16px', padding: '28px 32px', marginBottom: '24px',
        color: '#fff',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 500, opacity: 0.75, marginBottom: '2px' }}>
          <span style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => router.push('/')}>Dashboard</span>
          <FiChevronRight size={12} style={{ margin: '0 6px', verticalAlign: 'middle' }} />
          My Team
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.04em', margin: '4px 0 2px' }}>
          My Team
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.75, margin: 0 }}>
          {team.length} team member{team.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--gap)', alignItems: 'start' }}>

        {/* ── Team Members Table ── */}
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiUsers size={16} style={{ color: 'var(--text2)' }} />
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Team Members</span>
            <span style={{ background: 'var(--surface3)', borderRadius: '980px', padding: '1px 9px', fontSize: '11px', fontWeight: 600, color: 'var(--text2)' }}>{team.length}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Name', 'Code', 'Department', 'Designation', 'Type'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {team.map(m => (
                  <tr key={m.code} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => router.push(`/employee/${m.code}`)}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{m.name}</td>
                    <td style={tdStyle}><span style={{ color: 'var(--text3)' }}>#{m.code}</span></td>
                    <td style={tdStyle}>{m.department || '—'}</td>
                    <td style={tdStyle}>{m.designation || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', padding: '1px 7px', borderRadius: '980px', fontSize: '10px', fontWeight: 600,
                        background: m.employeeType === 'wfh' ? 'rgba(175,82,222,0.1)' : m.employeeType === 'wfm' ? 'rgba(90,200,250,0.1)' : 'rgba(52,199,89,0.1)',
                        color: m.employeeType === 'wfh' ? '#af52de' : m.employeeType === 'wfm' ? '#5ac8fa' : '#1a7f37',
                      }}>
                        {(m.employeeType || 'regular').toUpperCase()}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: 'var(--blue)', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        View <FiArrowRight size={12} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

          {/* Quick stats card */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>Team Overview</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Total Members', value: team.length, color: '#0071e3' },
                { label: 'Regular', value: team.filter(m => m.employeeType === 'regular' || !m.employeeType).length, color: '#34c759' },
                { label: 'WFH', value: team.filter(m => m.employeeType === 'wfh').length, color: '#af52de' },
                { label: 'WFM', value: team.filter(m => m.employeeType === 'wfm').length, color: '#5ac8fa' },
                { label: 'Pending Approvals', value: pendingLeaves.length, color: '#ff9f0a' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{s.label}</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending leave approvals */}
          {pendingLeaves.length > 0 && (
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiClipboard size={16} /> Pending Approvals
                </div>
                <span style={{ background: 'rgba(255,159,10,0.1)', color: '#b36200', padding: '1px 8px', borderRadius: '980px', fontSize: '11px', fontWeight: 600 }}>{pendingLeaves.length}</span>
              </div>
              {pendingLeaves.slice(0, 4).map(r => (
                <div key={r.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{r.user?.name}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: LEAVE_COLORS[r.leaveType] }}>
                      {r.leaveType?.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{r.days}d</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                    {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {r.fromDate !== r.toDate && ` – ${new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </div>
                </div>
              ))}
              <div style={{ padding: '12px 20px', textAlign: 'center' }}>
                <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '12px' }}
                  onClick={() => router.push('/leaves')}>
                  View All in Leaves <FiArrowRight size={12} style={{ marginLeft: '4px' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
