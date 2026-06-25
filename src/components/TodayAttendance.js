"use client";

import { useState, useEffect, useCallback } from 'react';
import { getTodayAttendance } from '../actions/todayAttendance';
import { FiMapPin, FiClock, FiRefreshCw } from 'react-icons/fi';

const LOCATIONS = {
  wfh: { label: 'WFH', color: '#af52de' },
  wos: { label: 'WOS', color: '#30b0c7' },
  wfm: { label: 'WFM', color: '#34c759' },
  wfo: { label: 'WFO', color: '#0071e3' },
};

const STATUS_CFG = {
  working: { label: 'Working', color: '#0071e3', bg: 'rgba(0,113,227,0.1)' },
  completed: { label: 'Completed', color: '#34c759', bg: 'rgba(52,199,89,0.1)' },
  not_clocked: { label: 'Not Clocked In', color: '#8e8e93', bg: 'rgba(142,142,147,0.1)' },
  leave: { label: 'On Leave', color: '#ff9f0a', bg: 'rgba(255,159,10,0.1)' },
};

function formatTime(iso) {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function Row({ entry }) {
  const loc = entry.workLocation ? LOCATIONS[entry.workLocation] : null;
  const st = STATUS_CFG[entry.status] || STATUS_CFG.not_clocked;

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>
          {entry.name?.replace(/\b\w/g, c => c.toUpperCase())}
        </span>
        <span style={{
          marginLeft: '8px', fontSize: '10px', fontWeight: 600,
          padding: '1px 6px', borderRadius: '4px',
          background: entry.employeeType === 'hybrid' ? 'rgba(175,82,222,0.1)' : 'rgba(0,113,227,0.1)',
          color: entry.employeeType === 'hybrid' ? '#7b2d8b' : '#0071e3',
          verticalAlign: 'middle',
        }}>
          {entry.employeeType === 'hybrid' ? 'Hybrid' : 'Regular'}
        </span>
      </td>
      <td style={{ padding: '10px 12px', color: 'var(--text2)', fontSize: '12px', whiteSpace: 'nowrap' }}>{entry.department}</td>
      <td style={{ padding: '10px 12px', color: 'var(--text2)', fontSize: '12px', whiteSpace: 'nowrap' }}>{entry.designation}</td>
      <td style={{ padding: '10px 12px' }}>
        {loc ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 10px', borderRadius: '980px', fontSize: '11px', fontWeight: 600,
            background: loc.color + '18', color: loc.color,
            whiteSpace: 'nowrap',
          }}>
            <FiMapPin size={10} /> {loc.label}
          </span>
        ) : (
          <span style={{ color: 'var(--text3)', fontSize: '11px' }}>—</span>
        )}
      </td>
      <td style={{ padding: '10px 12px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '2px 10px', borderRadius: '980px', fontSize: '11px', fontWeight: 600,
          background: st.bg, color: st.color, whiteSpace: 'nowrap',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.color }} />
          {entry.status === 'leave' && entry.leaveType
            ? `${st.label} (${entry.leaveType.toUpperCase()})`
            : st.label}
        </span>
      </td>
      <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatTime(entry.punchIn)}</td>
      <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--text)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatTime(entry.punchOut)}</td>
    </tr>
  );
}

function SectionTable({ title, data, emptyMsg }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {title}
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text2)', background: 'var(--surface2)', padding: '1px 8px', borderRadius: '980px' }}>{data.length}</span>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>{emptyMsg}</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'inherit' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Employee</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Department</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Designation</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Location</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Punch In</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Punch Out</th>
              </tr>
            </thead>
            <tbody>
              {data.map(e => <Row key={e.code} entry={e} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TodayAttendance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await getTodayAttendance();
      setData(result);
      setLastRefresh(new Date());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
        <div className="skeleton" style={{ width: '200px', height: '20px', borderRadius: '6px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '8px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '8px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '100%', height: '40px', borderRadius: '8px' }} />
      </div>
    );
  }

  if (!data || (data.hybrid.length === 0 && data.regularWfh.length === 0)) {
    return (
      <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Today&apos;s Attendance</div>
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: '13px' }}>
          <FiClock size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
          <div>No hybrid or WFH/WOS employees today</div>
        </div>
      </div>
    );
  }

  const total = data.hybrid.length + data.regularWfh.length;

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiClock size={16} style={{ color: 'var(--blue)' }} />
          Today&apos;s Attendance
          <span style={{
            fontSize: '12px', fontWeight: 500, color: 'var(--text2)',
            background: 'var(--surface2)', padding: '1px 8px', borderRadius: '980px',
          }}>{total}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastRefresh && (
            <span style={{ fontSize: '10px', color: 'var(--text3)' }}>
              Updated {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchData}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)',
              padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center',
              fontFamily: 'inherit', fontSize: '13px', gap: '4px',
            }}
            title="Refresh"
          >
            <FiRefreshCw size={13} />
          </button>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {data.hybrid.length > 0 && (
          <SectionTable
            title="Hybrid Workforce"
            data={data.hybrid}
            emptyMsg="No hybrid employees"
          />
        )}
        {data.regularWfh.length > 0 && (
          <SectionTable
            title="Regular (WFH / WOS)"
            data={data.regularWfh}
            emptyMsg="No regular employees on WFH or WOS today"
          />
        )}
      </div>
    </div>
  );
}
