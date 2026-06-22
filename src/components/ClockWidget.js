"use client";

import { useState, useEffect, useCallback } from 'react';
import { clockIn, clockOut, getTodayPunch } from '../actions/punch';
import { FiClock, FiCheckCircle, FiLogIn, FiLogOut } from 'react-icons/fi';

export default function ClockWidget({ code, employeeType }) {
  const [punch, setPunch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [time, setTime] = useState(new Date());

  const fetchStatus = useCallback(async () => {
    const data = await getTodayPunch(code);
    setPunch(data);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleClockIn = async () => {
    setClocking(true);
    await clockIn(code);
    await fetchStatus();
    setClocking(false);
  };

  const handleClockOut = async () => {
    setClocking(true);
    await clockOut(code);
    await fetchStatus();
    setClocking(false);
  };

  const isClockedIn = punch && !punch.punchOut;
  const isComplete = punch && punch.punchOut;

  const formatTime = (d) => {
    if (!d) return '--:--';
    const dt = new Date(d);
    return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const timeStr = time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return null;

  return (
    <div className="card" style={{
      padding: '16px 20px', marginBottom: '12px',
      display: 'flex', alignItems: 'center', gap: '20px',
      background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: 'var(--surface3)', display: 'grid', placeItems: 'center',
          fontSize: '20px', fontWeight: 700, color: 'var(--text)',
          letterSpacing: '-0.02em',
        }}>
          <FiClock size={24} style={{ color: 'var(--text2)' }} />
        </div>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            {timeStr}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>
            {dateStr}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 12px', borderRadius: '8px',
          background: isComplete ? 'rgba(52,199,89,0.1)' : isClockedIn ? 'rgba(0,113,227,0.1)' : 'var(--surface3)',
          fontSize: '12px', fontWeight: 500,
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isComplete ? 'var(--green)' : isClockedIn ? 'var(--blue)' : 'var(--text3)',
          }} />
          <span style={{ color: isComplete ? 'var(--green)' : isClockedIn ? 'var(--blue)' : 'var(--text3)' }}>
            {isComplete ? 'Completed' : isClockedIn ? 'Working...' : 'Not clocked in'}
          </span>
        </div>

        {isClockedIn && (
          <div style={{ fontSize: '11px', color: 'var(--text2)', textAlign: 'right' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>In: {formatTime(punch.punchIn)}</div>
          </div>
        )}

        {isComplete && (
          <div style={{ fontSize: '11px', color: 'var(--text2)', textAlign: 'right' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>In: {formatTime(punch.punchIn)}</div>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>Out: {formatTime(punch.punchOut)}</div>
          </div>
        )}

        {!isClockedIn && !isComplete && (
          <button
            onClick={handleClockIn}
            disabled={clocking}
            className="btn btn-primary"
            style={{
              padding: '10px 24px', fontSize: '14px', fontWeight: 600,
              background: 'var(--green)', border: 'none', borderRadius: '12px',
              color: '#fff', cursor: clocking ? 'not-allowed' : 'pointer',
              opacity: clocking ? 0.7 : 1, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <FiLogIn size={16} /> {clocking ? 'Clocking in...' : 'Clock In'}
          </button>
        )}

        {isClockedIn && (
          <button
            onClick={handleClockOut}
            disabled={clocking}
            className="btn btn-primary"
            style={{
              padding: '10px 24px', fontSize: '14px', fontWeight: 600,
              background: 'var(--red)', border: 'none', borderRadius: '12px',
              color: '#fff', cursor: clocking ? 'not-allowed' : 'pointer',
              opacity: clocking ? 0.7 : 1, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <FiLogOut size={16} /> {clocking ? 'Clocking out...' : 'Clock Out'}
          </button>
        )}

        {isComplete && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)', fontSize: '13px', fontWeight: 600 }}>
            <FiCheckCircle size={16} /> Done
          </div>
        )}
      </div>
    </div>
  );
}
