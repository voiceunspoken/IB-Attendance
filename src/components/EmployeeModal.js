"use client";

import { useState, useEffect } from 'react';
import { FiX, FiMonitor, FiHome, FiBriefcase, FiClock } from 'react-icons/fi';
import { useToast } from './Toast';

export default function EmployeeModal({ employee, currentMonth, overrides, onClose, onApplyOverride, onRemoveOverride, onClearAllOverrides, readOnly = false, onProposeCorrection, rlEligibleDays = [], mode = 'modal' }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [overrideType, setOverrideType] = useState('wfm');
  const [popupDay, setPopupDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const [correctionType, setCorrectionType] = useState('present');
  const [correctionReason, setCorrectionReason] = useState('');

  const toast = useToast();
  const fmtTime = (m) => m != null ? `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` : '';

  // Lock body scroll when day detail modal is open
  useEffect(() => {
    if (popupDay) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [popupDay]);

  if (!employee) return null;

  const empOverrideCounts = () => {
    let wfm = 0, wfmhd = 0, wfh = 0, wos = 0, woshd = 0;
    Object.keys(overrides).forEach(k => {
      if (k.startsWith(employee.code + '_')) {
        const v = overrides[k];
        if (v === 'wfm') wfm++;
        else if (v === 'wfm-hd') wfmhd++;
        else if (v === 'wfh') wfh++;
        else if (v === 'wos') wos++;
        else if (v === 'wos-hd') woshd++;
      }
    });
    return { wfm, wfmhd, wfh, wos, woshd };
  };

  const ovCounts = empOverrideCounts();
  const stats = [
    { val: employee.present, label: 'Present', color: 'var(--green)' },
    { val: employee.absent, label: 'Absent', color: 'var(--red)' },
    { val: employee.late, label: 'Late', color: 'var(--yellow)' },
    { val: employee.shortShift, label: 'Short Shifts', color: 'var(--orange)' },
    { val: ovCounts.wfm + ovCounts.wfmhd, label: 'WFM', color: 'var(--green)' },
    { val: ovCounts.wfh, label: 'WFH', color: 'var(--purple)' },
    { val: ovCounts.wos + ovCounts.woshd, label: 'WOS', color: 'var(--teal)' },
  ];

  const handleApply = () => {
    const f = parseInt(fromDate);
    const t = parseInt(toDate) || f;
    if (!f || isNaN(f)) return toast.error('Please enter a valid start date.');
    const dIM = new Date(currentMonth.year, currentMonth.month, 0).getDate();
    const start = Math.max(1, Math.min(f, dIM));
    const end = Math.max(start, Math.min(t, dIM));
    for (let d = start; d <= end; d++) {
      const info = employee.days.find(x => x.d === d);
      if (info && info.type !== 'wo' && info.type !== 'holiday') {
        onApplyOverride(employee.code, d, overrideType);
      }
    }
    setFromDate('');
    setToDate('');
  };

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
        <div key={`hdr-${i}`} style={{
          textAlign: 'center', fontSize: '9px', fontWeight: 600,
          color: 'var(--text2)', padding: '2px 0', letterSpacing: '0.03em', textTransform: 'uppercase'
        }}>{d}</div>
      ));
    }

    for (let i = 0; i < firstDow; i++) cells.push(<div key={`empty-${i}`} />);

    const dayMap = {};
    employee.days.forEach(d => dayMap[d.d] = d);

    for (let d = 1; d <= daysInMonth; d++) {
      const info = dayMap[d];
      if (!info) { cells.push(<div key={`empty-mid-${d}`} />); continue; }

      const ovVal = overrides[`${employee.code}_${d}`];
      let bg = 'var(--surface2)', border = '1px solid var(--border)', opacity = 1, cursor = 'pointer', outline = 'none';
      let label = '';

      // Check RL-eligible day (birthday or restricted holiday)
      const rlDay = rlEligibleDays.find(r => r.day === d && r.month === currentMonth.month);

      if (ovVal) {
        label = ovVal === 'wfm' ? 'WFM' : ovVal === 'wfm-hd' ? 'WFM½' : ovVal === 'wfh' ? 'WFH' : ovVal === 'wos' ? 'WOS' : 'WOS½';
        bg = ovVal === 'wfm' ? 'rgba(52,199,89,0.15)'
           : ovVal === 'wfm-hd' ? 'rgba(52,199,89,0.1)'
           : ovVal === 'wfh' ? 'rgba(175,82,222,0.12)'
           : ovVal === 'wos' ? 'rgba(48,176,199,0.15)'
           : 'rgba(48,176,199,0.1)';
        border = ovVal === 'wfm' ? '2px solid rgba(52,199,89,0.5)'
               : ovVal === 'wfm-hd' ? '2px solid rgba(52,199,89,0.35)'
               : ovVal === 'wfh' ? '2px solid rgba(175,82,222,0.4)'
               : '2px solid rgba(48,176,199,0.45)';
      } else {
        if (info.type === 'wo') { opacity = 0.35; cursor = 'default'; label = 'WO'; bg = 'transparent'; border = '1px solid var(--border)'; }
        else if (info.type === 'present') {
          if (info.inT === null) {
            bg = 'rgba(255,107,53,0.08)'; border = '2px dashed rgba(255,107,53,0.45)'; label = '⚠';
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
        if (info.isSL) { label = 'SL'; bg = 'rgba(0,113,227,0.08)'; border = '2px solid rgba(0,113,227,0.25)'; }
        else if (info.isSS) { label = 'SS'; border = '2px solid rgba(255,107,53,0.5)'; }
        else if (info.isLate) { label = 'Late'; border = '2px solid rgba(255,159,10,0.5)'; }

        if (rlDay && info.type !== 'rl' && info.type !== 'holiday' && info.type !== 'wo') {
          outline = '2px dashed rgba(175,82,222,0.5)';
          if (rlDay.isBirthday) label = label ? `${label} 🎂` : '🎂';
          else label = label ? `${label} ✅` : '✅';
        }
      }

      const isSelected = d === selectedDay;

      cells.push(
        <div
          key={`cal-${d}`}
          onClick={(e) => info.type !== 'wo' && info.type !== 'holiday' ? openPopup(e, d) : undefined}
          style={{
            borderRadius: '5px', border, background: bg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', gap: '1px', position: 'relative', cursor, opacity, outline, outlineOffset: '-2px',
            transition: 'box-shadow 0.15s ease',
            boxShadow: isSelected ? '0 0 0 2.5px var(--blue), 0 4px 12px rgba(0,0,0,0.1)' : undefined,
            zIndex: isSelected ? 5 : undefined,
          }}
          onMouseEnter={e => { if (cursor === 'pointer' && !isSelected) e.currentTarget.style.background = 'var(--surface3)'; }}
          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = bg; if (cursor === 'pointer') e.currentTarget.style.background = bg; }}
        >
          {ovVal && (
            <div style={{
              position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px',
              borderRadius: '50%',
              background: ovVal === 'wfm' ? 'var(--green)'
                        : ovVal === 'wfm-hd' ? 'var(--wfmhd)'
                        : ovVal === 'wfh' ? 'var(--purple)'
                        : 'var(--teal)'
            }} />
          )}
          <span style={{ fontWeight: 700, fontSize: '11px', color: 'var(--text)' }}>{d}</span>
          <span style={{ fontSize: '8px', fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.01em' }}>{label}</span>
        </div>
      );
    }
    return cells;
  };

  // ── Popup content — computed once, shared by both render modes ──
  const popupContent = popupDay && (() => {
    const di = employee.days.find(x => x.d === popupDay);
    if (!di) return null;
    const ovVal = overrides[`${employee.code}_${popupDay}`];
    const pd = new Date(currentMonth.year, currentMonth.month - 1, popupDay);
    const dayName = pd.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = pd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const statusLabel = ovVal
      ? ({ wfm: 'WFM Full', 'wfm-hd': 'WFM Half', wfh: 'WFH', wos: 'WOS Full', 'wos-hd': 'WOS Half' }[ovVal] || ovVal)
      : ({ present: 'Present', absent: 'Absent', half: 'Half Day', rl: 'RL', holiday: 'Holiday', wo: 'WO' }[di.type] || di.type);

    const statusColor = ovVal
      ? ({ wfm: '#34c759', 'wfm-hd': '#30d158', wfh: '#af52de', wos: '#30b0c7', 'wos-hd': '#30b0c7' }[ovVal] || 'var(--text2)')
      : ({ present: '#34c759', absent: '#ff3b30', half: '#ff6b35', rl: '#af52de', holiday: '#ff9f0a', wo: 'var(--text3)' }[di.type] || 'var(--text2)');

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
          {di.isLate && !ovVal ? 'Late — ' : ''}{statusLabel}
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

        {/* Override actions */}
        {!readOnly && (
          <>
            {sectionDiv}
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text3)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Override
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                { label: 'WFM — Full Day', type: 'wfm', icon: <FiMonitor size={13} />, bg: 'rgba(52,199,89,0.08)', color: '#1a7f37', border: 'rgba(52,199,89,0.25)' },
                { label: 'WFM — Half Day', type: 'wfm-hd', icon: <FiMonitor size={13} />, bg: 'rgba(52,199,89,0.06)', color: '#1a7f37', border: 'rgba(52,199,89,0.2)' },
                { label: 'Work From Home', type: 'wfh', icon: <FiHome size={13} />, bg: 'rgba(175,82,222,0.08)', color: '#7b2d8b', border: 'rgba(175,82,222,0.25)' },
                { label: 'On Site — Full Day', type: 'wos', icon: <FiBriefcase size={13} />, bg: 'rgba(48,176,199,0.08)', color: '#1a6e7a', border: 'rgba(48,176,199,0.25)' },
                { label: 'On Site — Half Day', type: 'wos-hd', icon: <FiBriefcase size={13} />, bg: 'rgba(48,176,199,0.06)', color: '#1a6e7a', border: 'rgba(48,176,199,0.2)' },
              ].map(item => (
                <button key={item.type} onClick={() => { onApplyOverride(employee.code, popupDay, item.type); setSelectedDay(null); setPopupDay(null); }}
                  style={{
                    padding: '9px 12px', borderRadius: '9px', border: `1px solid ${item.border}`,
                    background: item.bg, color: item.color, cursor: 'pointer', fontSize: 'var(--fs-sm)',
                    fontWeight: 500, textAlign: 'left', fontFamily: 'inherit', letterSpacing: '-0.01em',
                    display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.12s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = item.color + '18'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = item.bg; }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
              <button onClick={() => { onRemoveOverride(employee.code, popupDay); setSelectedDay(null); setPopupDay(null); }}
                style={{
                  padding: '9px 12px', borderRadius: '9px', border: '1px solid rgba(255,59,48,0.2)',
                  background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer',
                  fontSize: 'var(--fs-sm)', fontWeight: 500, textAlign: 'left', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.12s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.06)'; }}
              >
                <FiX size={13} />
                Remove Override
              </button>
            </div>
          </>
        )}

        {/* Correction proposal — admin only */}
        {onProposeCorrection && (() => {
          const cdi = employee.days.find(x => x.d === popupDay);
          if (!cdi || cdi.type === 'wo' || cdi.type === 'holiday') return null;
          const cl = { present: 'Present', absent: 'Absent', half: 'Half Day', rl: 'RL' }[cdi.type] || cdi.type;
          return (
            <>
              {sectionDiv}
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text3)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Propose Change
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text3)', marginBottom: '8px' }}>
                Current: <strong style={{ color: 'var(--text)' }}>{cl}</strong>
              </div>
              <select className="input-field" value={correctionType}
                onChange={e => setCorrectionType(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: 'var(--fs-sm)', marginBottom: '6px' }}>
                <option value="present">Present (Full Day)</option>
                <option value="absent">Absent</option>
                <option value="half">Half Day</option>
              </select>
              <input className="input-field" placeholder="Reason for change…"
                value={correctionReason}
                onChange={e => setCorrectionReason(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', fontSize: 'var(--fs-sm)', marginBottom: '6px', boxSizing: 'border-box' }} />
              <button onClick={() => {
                if (!correctionReason.trim()) return toast.error('Please provide a reason.');
                onProposeCorrection(employee.code, popupDay, cdi.type, correctionType, correctionReason);
                setCorrectionReason('');
                setCorrectionType('present');
                setSelectedDay(null);
                setPopupDay(null);
              }} style={{
                padding: '7px 14px', borderRadius: '9px', border: '1px solid var(--blue)',
                background: 'var(--blue-light)', color: 'var(--blue)', cursor: 'pointer',
                fontSize: 'var(--fs-sm)', fontWeight: 600, fontFamily: 'inherit', width: '100%'
              }}>
                Submit Correction Request
              </button>
            </>
          );
        })()}
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

        {/* Override controls — admin only */}
        {!readOnly && (
        <div style={{
          background: 'var(--surface2)', borderRadius: '14px',
          padding: '16px 18px', marginBottom: '18px', border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text2)', marginBottom: '12px', letterSpacing: '-0.01em' }}>
            Manual Override
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {[
              { label: 'From Date', val: fromDate, set: setFromDate, w: '80px', ph: '5' },
              { label: 'To Date', val: toDate, set: setToDate, w: '100px', ph: 'same' },
            ].map(({ label, val, set, w, ph }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', fontWeight: 500 }}>{label}</span>
                <input type="number" min="1" max="31" placeholder={ph} value={val}
                  onChange={e => set(e.target.value)} className="input-field"
                  style={{ width: w, padding: '7px 10px' }} />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text2)', fontWeight: 500 }}>Type</span>
              <select value={overrideType} onChange={e => setOverrideType(e.target.value)}
                className="input-field" style={{ width: '220px', padding: '7px 10px' }}>
                <option value="wfm">WFM — Full Day</option>
                <option value="wfm-hd">WFM — Half Day</option>
                <option value="wfh">WFH</option>
                <option value="wos">WOS — Full Day</option>
                <option value="wos-hd">WOS — Half Day</option>
              </select>
            </div>
            <button className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 'var(--fs-sm)' }} onClick={handleApply}>Apply</button>
            <button className="btn btn-outline" style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)' }}
              onClick={() => onClearAllOverrides(employee.code)}>Clear All</button>
          </div>
        </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '18px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
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
        {/* Day name headers — auto height */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
          {dayNames.map((d, i) => (
            <div key={`il-hdr-${i}`} style={{
              textAlign: 'center', fontSize: '9px', fontWeight: 600,
              color: 'var(--text2)', padding: '2px 0', letterSpacing: '0.03em', textTransform: 'uppercase'
            }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid — fills remaining height, weeks distribute equally */}
        <div style={{
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
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            display: 'grid', placeItems: 'center', padding: '24px',
            animation: 'fadeIn 0.15s ease'
          }}
            onClick={() => { setSelectedDay(null); setPopupDay(null); }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface)', borderRadius: '16px',
                border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                padding: '16px', maxWidth: '380px', width: '100%',
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
