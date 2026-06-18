"use client";

import { useState, useEffect } from 'react';
import { FiX, FiClock, FiGift, FiCheck } from 'react-icons/fi';
import { useToast } from './Toast';

const ADJUST_TYPES = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half', label: 'Half Day' },
  { type: 'label', label: '— Leave —' },
  { value: 'cl', label: 'CL (Casual Leave)' },
  { value: 'sl', label: 'SL (Sick Leave)' },
  { value: 'el', label: 'EL (Earned Leave)' },
  { value: 'rl', label: 'RL (Restricted Holiday)' },
  { value: 'ul', label: 'UL (Unpaid Leave)' },
  { value: 'sh', label: 'SH (Short Leave)' },
  { type: 'label', label: '— Work Mode —' },
  { value: 'wfh', label: 'WFH (Work From Home)' },
  { value: 'wfm', label: 'WFM (Work From Ministry)' },
  { value: 'wos', label: 'WOS (On Site)' },
];

export default function EmployeeModal({ employee, currentMonth, onClose, readOnly = false, onAdjust, rlEligibleDays = [], mode = 'modal' }) {
  const [popupDay, setPopupDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [adjustType, setAdjustType] = useState('present');
  const [adjustReason, setAdjustReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toast = useToast();
  const fmtTime = (m) => m != null ? `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` : '';

  useEffect(() => {
    if (popupDay) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [popupDay]);

  if (!employee) return null;

  const stats = [
    { val: employee.present, label: 'Present', color: 'var(--green)' },
    { val: employee.absent, label: 'Absent', color: 'var(--red)' },
    { val: employee.late, label: 'Late', color: 'var(--yellow)' },
    { val: employee.shortShift, label: 'Short Shifts', color: 'var(--orange)' },
    { val: employee.rl, label: 'RL', color: 'var(--purple)' },
  ];

  const openPopup = (e, day) => {
    if (readOnly) return;
    e.stopPropagation();
    const info = employee.days.find(x => x.d === day);
    if (!info || info.type === 'wo' || info.type === 'holiday') return;
    const rect = e.currentTarget.getBoundingClientRect();
    let x = rect.right + 10, y = rect.top - 4;
    if (x + 300 > window.innerWidth) x = Math.max(10, rect.left - 300 - 10);
    if (y + 360 > window.innerHeight) y = Math.max(10, window.innerHeight - 360 - 10);
    setPopupPos({ x, y });
    setSelectedDay(day);
    setPopupDay(day);
    setAdjustType('present');
    setAdjustReason('');
  };

  const { year: calYear, month: calMonth } = currentMonth || { year: 2026, month: 3 };
  const calFirstDow = new Date(calYear, calMonth - 1, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth, 0).getDate();
  const weeks = Math.ceil((calFirstDow + calDaysInMonth) / 7);

  const renderCalendar = (showHeaders = true) => {
    const { year, month } = currentMonth || { year: 2026, month: 3 };
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells = [];
    if (showHeaders) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      dayNames.forEach((d, i) => cells.push(
        <div key={`hdr-${i}`} role="columnheader" style={{
          textAlign: 'center', fontSize: '9px', fontWeight: 600,
          color: 'var(--text2)', padding: '2px 0', letterSpacing: '0.03em', textTransform: 'uppercase'
        }}>{d}</div>
      ));
    }

    for (let i = 0; i < firstDow; i++) cells.push(<div key={`empty-${i}`} role="presentation" />);

    const dayMap = {};
    employee.days.forEach(d => dayMap[d.d] = d);

    for (let d = 1; d <= daysInMonth; d++) {
      const info = dayMap[d];
      if (!info) { cells.push(<div key={`empty-mid-${d}`} role="presentation" />); continue; }

      let bg = 'var(--surface2)', border = '1px solid var(--border)', opacity = 1, cursor = 'pointer', outline = 'none';
      let label = '';

      const rlDay = rlEligibleDays.find(r => r.day === d && r.month === currentMonth.month);

      if (info.type === 'wo') { opacity = 0.35; cursor = 'default'; label = 'WO'; bg = 'transparent'; border = '1px solid var(--border)'; }
      else if (info.type === 'present') {
        if (info.inT === null) {
          bg = 'rgba(255,107,53,0.08)'; border = '2px dashed rgba(255,107,53,0.45)'; label = '\u26A0';
        } else {
          bg = 'rgba(52,199,89,0.1)'; border = '2px solid rgba(52,199,89,0.3)'; label = '';
        }
      }
      else if (info.type === 'absent') { bg = 'rgba(255,59,48,0.09)'; border = '2px solid rgba(255,59,48,0.3)'; label = 'Absent'; }
      else if (info.type === 'holiday') { bg = 'rgba(255,159,10,0.12)'; border = '2px solid rgba(255,159,10,0.35)'; label = ''; cursor = 'default'; }
      else if (info.type === 'rl') { bg = 'rgba(175,82,222,0.1)'; border = '2px solid rgba(175,82,222,0.3)'; label = 'RL'; }
      else if (info.type === 'half') {
        if (info.hdReason === 'late') { bg = 'rgba(255,59,48,0.08)'; border = '2px solid rgba(255,59,48,0.3)'; label = 'HD(L)'; }
        else if (info.hdReason === 'ss') { bg = 'rgba(255,107,53,0.1)'; border = '2px solid rgba(255,107,53,0.3)'; label = 'HD(SS)'; }
        else { bg = 'rgba(255,159,10,0.1)'; border = '2px solid rgba(255,159,10,0.3)'; label = 'HD'; }
      }
      else if (['cl', 'sl', 'el', 'ul', 'sh'].includes(info.type)) {
        bg = 'rgba(0,113,227,0.08)'; border = '2px solid rgba(0,113,227,0.25)'; label = info.type.toUpperCase();
      }
      else if (['wfh', 'wfm', 'wos'].includes(info.type)) {
        bg = 'rgba(175,82,222,0.1)'; border = '2px solid rgba(175,82,222,0.3)'; label = info.type.toUpperCase();
      }
      if (info.isSL) { label = 'SL'; bg = 'rgba(0,113,227,0.08)'; border = '2px solid rgba(0,113,227,0.25)'; }
      else if (info.isSS) { label = 'SS'; border = '2px solid rgba(255,107,53,0.5)'; }
      else if (info.isLate) { label = 'Late'; border = '2px solid rgba(255,159,10,0.5)'; }

      if (rlDay && info.type !== 'rl' && info.type !== 'holiday' && info.type !== 'wo') {
        outline = '2px dashed rgba(175,82,222,0.5)';
      }

      const isSelected = d === selectedDay;
      const isInteractive = cursor === 'pointer';
      const ariaLabelSuffix = isSelected ? ', selected' : '';
      const ariaLabel = rlDay?.isBirthday ? `Day ${d}, Birthday${ariaLabelSuffix}` : `Day ${d}, ${label || (info?.type || '')}${ariaLabelSuffix}`.trim();

      cells.push(
        <button
          key={`cal-${d}`}
          role="gridcell"
          aria-selected={isSelected || undefined}
          aria-label={ariaLabel}
          tabIndex={isInteractive ? 0 : -1}
          disabled={!isInteractive}
          onClick={(e) => isInteractive ? openPopup(e, d) : undefined}
          onKeyDown={(e) => { if (isInteractive && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPopup(e, d); } }}
          style={{
            borderRadius: '5px', border, background: bg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', gap: '1px', position: 'relative', opacity, outline, outlineOffset: '-2px',
            transition: 'box-shadow 0.15s ease',
            boxShadow: isSelected ? '0 0 0 2.5px var(--blue), 0 4px 12px rgba(0,0,0,0.1)' : undefined,
            zIndex: isSelected ? 5 : undefined,
            cursor: isInteractive ? 'pointer' : 'default',
            fontFamily: 'inherit',
            padding: 0,
          }}
          onMouseEnter={e => { if (isInteractive && !isSelected) e.currentTarget.style.background = 'var(--surface3)'; }}
          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = bg; }}
        >
          <span style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text)' }}>{d}</span>
          <span style={{ fontSize: '8px', fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.01em', display: 'flex', alignItems: 'center', gap: '2px' }}>
            {rlDay?.isBirthday ? <FiGift size={8} /> : rlDay && !rlDay.isBirthday ? <FiCheck size={8} /> : null}
            {label}
          </span>
        </button>
      );
    }
    return cells;
  };

  // ── Popup content — computed once, shared by both render modes ──
  const popupContent = popupDay && (() => {
    const di = employee.days.find(x => x.d === popupDay);
    if (!di) return null;
    const pd = new Date(currentMonth.year, currentMonth.month - 1, popupDay);
    const dayName = pd.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = pd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const statusLabel = ({ present: 'Present', absent: 'Absent', half: 'Half Day', rl: 'RL', holiday: 'Holiday', wo: 'WO',
      cl: 'CL', sl: 'SL', el: 'EL', ul: 'UL', sh: 'SH', wfh: 'WFH', wfm: 'WFM', wos: 'WOS' }[di.type] || di.type);

    const statusColor = ({ present: '#34c759', absent: '#ff3b30', half: '#ff6b35', rl: '#af52de', holiday: '#ff9f0a', wo: 'var(--text3)',
      cl: '#0071e3', sl: '#0071e3', el: '#0071e3', ul: '#0071e3', sh: '#0071e3',
      wfh: '#af52de', wfm: '#34c759', wos: '#30b0c7' }[di.type] || 'var(--text2)');

    const workingHrs = di.inT != null && di.outT != null
      ? `${Math.floor((di.outT - di.inT) / 60)}h ${(di.outT - di.inT) % 60}m`
      : null;

    const sectionDiv = <div style={{ margin: '12px 0', height: '1px', background: 'var(--border)' }} />;

    return (
      <div style={{ minWidth: '320px', maxWidth: '380px' }}>
        {/* Popup header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.2 }}>
              Day {popupDay}
              <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: '6px' }}>· {dayName}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', marginTop: '2px', letterSpacing: '-0.01em' }}>{dateStr}</div>
          </div>
          <button onClick={() => { setSelectedDay(null); setPopupDay(null); }}
            style={{
              width: '26px', height: '26px', borderRadius: '50%', border: 'none',
              background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer',
              display: 'grid', placeItems: 'center', fontFamily: 'inherit', flexShrink: 0
            }}>
            <FiX size={13} />
          </button>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '980px',
          background: statusColor + '14', color: statusColor,
          fontSize: 'var(--fs-sm)', fontWeight: 600, letterSpacing: '-0.01em',
          marginBottom: '14px'
        }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          {di.isLate && di.type === 'present' ? 'Late — ' : ''}{statusLabel}
        </div>

        {/* Punch timeline */}
        {di.inT != null && (
          <div style={{
            background: 'var(--surface2)', borderRadius: '12px',
            padding: '14px 16px', marginBottom: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text)' }}>
              <FiClock size={14} style={{ color: 'var(--text3)', flexShrink: 0 }} />
              <span>{fmtTime(di.inT)}</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border2)' }} />
              <span>{di.outT != null ? fmtTime(di.outT) : '—'}</span>
            </div>
            {workingHrs && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', marginTop: '6px', letterSpacing: '-0.01em', paddingLeft: '24px' }}>
                Working Hours: <strong style={{ color: 'var(--text)' }}>{workingHrs}</strong>
              </div>
            )}
          </div>
        )}

        {/* Unified Adjust section */}
        {!readOnly && onAdjust && (
          <>
            {sectionDiv}
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text3)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Adjust
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', marginBottom: '8px' }}>
              Current: <strong style={{ color: 'var(--text)' }}>{statusLabel}</strong>
            </div>
            <select className="input-field" value={adjustType}
              onChange={e => setAdjustType(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 'var(--fs-sm)', marginBottom: '6px' }}>
              {ADJUST_TYPES.map((item, i) =>
                item.type === 'label'
                  ? <option key={`lbl-${i}`} disabled style={{ fontSize: '10px', color: 'var(--text3)' }}>{item.label}</option>
                  : <option key={item.value} value={item.value}>{item.label}</option>
              )}
            </select>
            <input className="input-field" placeholder="Reason for adjustment…"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 'var(--fs-sm)', marginBottom: '6px', boxSizing: 'border-box' }} />
            <button onClick={async () => {
              if (!adjustReason.trim()) return toast.error('Please provide a reason.');
              setSubmitting(true);
              const result = await onAdjust(employee.code, popupDay, di.type, adjustType, adjustReason);
              setSubmitting(false);
              if (result?.warning) toast.warning(result.warning);
              adjustReason && toast.success('Adjustment submitted for approval.');
              setAdjustReason('');
              setAdjustType('present');
              setSelectedDay(null);
              setPopupDay(null);
            }} style={{
              padding: '7px 14px', borderRadius: '9px', border: '1px solid var(--blue)',
              background: 'var(--blue-light)', color: 'var(--blue)', cursor: submitting ? 'default' : 'pointer',
              fontSize: 'var(--fs-sm)', fontWeight: 600, fontFamily: 'inherit', width: '100%', opacity: submitting ? 0.7 : 1
            }} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Adjustment Request'}
            </button>
          </>
        )}
      </div>
    );
  })();

  const popupCard = popupContent && (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '16px',
      boxShadow: 'var(--shadow-lg)',
      maxHeight: '85vh', overflowY: 'auto',
      animation: 'fadeIn 0.15s ease'
    }}>
      {popupContent}
    </div>
  );

  // ── Shared modal body (header + stats + calendar) ──
  const modalBody = (
    <>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>{employee.name}</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text2)', marginTop: '2px', letterSpacing: '-0.01em' }}>Employee #{employee.code}</div>
        </div>
        <button onClick={onClose}
          style={{
            width: '30px', height: '30px', borderRadius: '50%', border: 'none',
            background: 'var(--surface3)', color: 'var(--text2)', cursor: 'pointer',
            display: 'grid', placeItems: 'center', fontFamily: 'inherit'
          }}>
          <FiX size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: '10px', marginBottom: '18px' }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              background: 'var(--surface2)', borderRadius: '12px',
              padding: '14px', textAlign: 'center', border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, letterSpacing: '-0.03em', color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 'var(--fs-tiny)', color: 'var(--text2)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div role="grid" aria-label="Attendance calendar" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
          {renderCalendar()}
        </div>
      </div>
    </>
  );

  // ── Mode: Inline (embedded in page) — flex column, week-filling calendar + centered day detail modal ──
  if (mode === 'inline') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Day name headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
          {dayNames.map((d, i) => (
            <div key={`il-hdr-${i}`} style={{
              textAlign: 'center', fontSize: '9px', fontWeight: 600,
              color: 'var(--text2)', padding: '2px 0', letterSpacing: '0.03em', textTransform: 'uppercase'
            }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div role="grid" aria-label="Attendance calendar" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: `repeat(${weeks}, 1fr)`,
          gap: '2px',
          flex: 1,
          minHeight: 0,
        }}>
          {renderCalendar(false)}
        </div>

        {/* Day detail modal — centered overlay */}
        {popupContent && (
          <div onClick={() => { setSelectedDay(null); setPopupDay(null); }}
            onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}
            onKeyDown={e => { if (e.key === 'Escape') { setSelectedDay(null); setPopupDay(null); } }}
            role="dialog" aria-modal="true" aria-label="Day details" tabIndex={-1}
            style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            display: 'grid', placeItems: 'center', padding: '24px',
            overflow: 'auto', animation: 'fadeIn 0.15s ease'
          }}>
            <div onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface)', borderRadius: '16px',
                border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                padding: '16px', maxWidth: '380px', width: '100%',
                maxHeight: '85vh', overflowY: 'auto',
                animation: 'slideUp 0.2s ease',
              }}
            >
              {popupContent}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Mode: Modal (fullscreen overlay) ──
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 200, display: 'grid', placeItems: 'center',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: '20px',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          width: '900px', maxWidth: '96vw', maxHeight: '92vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {modalBody}
      </div>
      {popupCard && (
        <div style={{ position: 'fixed', left: popupPos.x, top: popupPos.y, zIndex: 300 }}>
          {popupCard}
        </div>
      )}
    </div>
  );
}
