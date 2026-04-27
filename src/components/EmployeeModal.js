"use client";

import { useState } from 'react';

export default function EmployeeModal({ employee, currentMonth, overrides, onClose, onApplyOverride, onRemoveOverride, onClearAllOverrides, readOnly = false }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [overrideType, setOverrideType] = useState('wfm');
  const [popupDay, setPopupDay] = useState(null);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });

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
    if (!f || isNaN(f)) return alert('Please enter a valid start date.');
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
    let x = e.clientX + 12, y = e.clientY + 12;
    if (x + 250 > window.innerWidth) x = e.clientX - 262;
    if (y + 240 > window.innerHeight) y = e.clientY - 252;
    setPopupPos({ x, y });
    setPopupDay(day);
  };

  const renderCalendar = () => {
    const { year, month } = currentMonth || { year: 2026, month: 3 };
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const cells = dayNames.map((d, i) => (
      <div key={`hdr-${i}`} style={{
        textAlign: 'center', fontSize: '10px', fontWeight: 600,
        color: 'var(--text2)', padding: '4px 0', letterSpacing: '0.04em', textTransform: 'uppercase'
      }}>{d}</div>
    ));

    for (let i = 0; i < firstDow; i++) cells.push(<div key={`empty-${i}`} />);

    const dayMap = {};
    employee.days.forEach(d => dayMap[d.d] = d);

    for (let d = 1; d <= daysInMonth; d++) {
      const info = dayMap[d];
      if (!info) { cells.push(<div key={`empty-mid-${d}`} />); continue; }

      const ovVal = overrides[`${employee.code}_${d}`];
      let bg = 'var(--surface2)', border = '1px solid var(--border)', opacity = 1, cursor = 'pointer', outline = 'none';
      let label = '';

      if (ovVal) {
        label = ovVal === 'wfm' ? 'WFM' : ovVal === 'wfm-hd' ? 'WFM½' : ovVal === 'wfh' ? 'WFH' : ovVal === 'wos' ? 'WOS' : 'WOS½';
        bg = ovVal === 'wfm' ? 'rgba(52,199,89,0.12)'
           : ovVal === 'wfm-hd' ? 'rgba(52,199,89,0.08)'
           : ovVal === 'wfh' ? 'rgba(175,82,222,0.1)'
           : ovVal === 'wos' ? 'rgba(48,176,199,0.12)'
           : 'rgba(48,176,199,0.08)';
        border = ovVal === 'wfm' ? '1.5px solid rgba(52,199,89,0.4)'
               : ovVal === 'wfm-hd' ? '1.5px solid rgba(52,199,89,0.3)'
               : ovVal === 'wfh' ? '1.5px solid rgba(175,82,222,0.35)'
               : '1.5px solid rgba(48,176,199,0.4)';
      } else {
        if (info.type === 'wo') { opacity = 0.4; cursor = 'default'; label = 'WO'; }
        else if (info.type === 'present') { bg = 'rgba(52,199,89,0.08)'; border = '1px solid rgba(52,199,89,0.25)'; label = 'P'; }
        else if (info.type === 'absent') { bg = 'rgba(255,59,48,0.08)'; border = '1px solid rgba(255,59,48,0.25)'; label = 'A'; }
        else if (info.type === 'holiday') { bg = 'rgba(255,159,10,0.1)'; border = '1px solid rgba(255,159,10,0.3)'; label = '🎉'; cursor = 'default'; }
        else if (info.type === 'rl') { bg = 'rgba(175,82,222,0.08)'; border = '1px solid rgba(175,82,222,0.25)'; label = 'RL'; }
        else if (info.type === 'half') { bg = 'rgba(255,159,10,0.08)'; border = '1px solid rgba(255,159,10,0.25)'; label = 'HD'; }
        if (info.isSL) { label = 'SL'; bg = 'rgba(0,113,227,0.08)'; }
        else if (info.isSS) { label = 'SS'; outline = '2px solid rgba(255,107,53,0.5)'; }
        else if (info.isLate) { label = 'Late'; outline = '2px solid rgba(255,159,10,0.5)'; }
      }

      cells.push(
        <div
          key={`cal-${d}`}
          onClick={(e) => info.type !== 'wo' && info.type !== 'holiday' ? openPopup(e, d) : undefined}
          style={{
            aspectRatio: '1', borderRadius: '8px', border, background: bg,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', gap: '1px', position: 'relative', cursor, opacity, outline, outlineOffset: '-2px',
            transition: 'transform 0.1s'
          }}
          onMouseEnter={e => { if (cursor === 'pointer') e.currentTarget.style.transform = 'scale(1.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
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
          <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text)' }}>{d}</span>
          <span style={{ fontSize: '8px', color: 'var(--text2)', letterSpacing: '0.01em' }}>{label}</span>
        </div>
      );
    }
    return cells;
  };

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
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>{employee.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px', letterSpacing: '-0.01em' }}>Employee #{employee.code}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '30px', height: '30px', borderRadius: '50%', border: 'none',
              background: 'var(--surface3)', color: 'var(--text2)', cursor: 'pointer',
              display: 'grid', placeItems: 'center', fontSize: '14px', fontFamily: 'inherit'
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>

          {/* Override controls — admin only */}
          {!readOnly && (
          <div style={{
            background: 'var(--surface2)', borderRadius: '14px',
            padding: '16px 18px', marginBottom: '18px', border: '1px solid var(--border)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text2)', marginBottom: '12px', letterSpacing: '-0.01em' }}>
              Manual Override
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {[
                { label: 'From Date', val: fromDate, set: setFromDate, w: '80px', ph: '5' },
                { label: 'To Date', val: toDate, set: setToDate, w: '100px', ph: 'same' },
              ].map(({ label, val, set, w, ph }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 500 }}>{label}</span>
                  <input type="number" min="1" max="31" placeholder={ph} value={val}
                    onChange={e => set(e.target.value)} className="input-field"
                    style={{ width: w, padding: '7px 10px' }} />
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 500 }}>Type</span>
                <select value={overrideType} onChange={e => setOverrideType(e.target.value)}
                  className="input-field" style={{ width: '220px', padding: '7px 10px' }}>
                  <option value="wfm">🏛️ Work From Ministry — Full Day</option>
                  <option value="wfm-hd">🏛️ Work From Ministry — Half Day</option>
                  <option value="wfh">🏠 Work From Home</option>
                  <option value="wos">🏢 Work On Site — Full Day</option>
                  <option value="wos-hd">🏢 Work On Site — Half Day</option>
                </select>
              </div>
              <button className="btn btn-primary" style={{ padding: '8px 18px' }} onClick={handleApply}>Apply</button>
              <button className="btn btn-outline" style={{ padding: '8px 14px', fontSize: '13px' }}
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
                <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.03em', color: s.color }}>{s.val}</div>
                <div style={{ fontSize: '10px', color: 'var(--text2)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Calendar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
            {renderCalendar()}
          </div>
        </div>
      </div>

      {/* Day popup */}
      {popupDay && (
        <div
          style={{
            position: 'fixed', left: popupPos.x, top: popupPos.y, zIndex: 300,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '12px', minWidth: '220px',
            boxShadow: 'var(--shadow-lg)', animation: 'fadeIn 0.15s ease'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Day {popupDay}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[
              { label: '🏛️ WFM — Full Day', type: 'wfm', bg: 'rgba(52,199,89,0.08)', color: '#1a7f37', border: 'rgba(52,199,89,0.25)' },
              { label: '🏛️ WFM — Half Day', type: 'wfm-hd', bg: 'rgba(52,199,89,0.06)', color: '#1a7f37', border: 'rgba(52,199,89,0.2)' },
              { label: '🏠 Work From Home', type: 'wfh', bg: 'rgba(175,82,222,0.08)', color: '#7b2d8b', border: 'rgba(175,82,222,0.25)' },
              { label: '🏢 Work On Site — Full Day', type: 'wos', bg: 'rgba(48,176,199,0.08)', color: '#1a6e7a', border: 'rgba(48,176,199,0.25)' },
              { label: '🏢 Work On Site — Half Day', type: 'wos-hd', bg: 'rgba(48,176,199,0.06)', color: '#1a6e7a', border: 'rgba(48,176,199,0.2)' },
            ].map(item => (
              <button key={item.type} onClick={() => { onApplyOverride(employee.code, popupDay, item.type); setPopupDay(null); }}
                style={{
                  padding: '9px 12px', borderRadius: '9px', border: `1px solid ${item.border}`,
                  background: item.bg, color: item.color, cursor: 'pointer', fontSize: '13px',
                  fontWeight: 500, textAlign: 'left', fontFamily: 'inherit', letterSpacing: '-0.01em'
                }}>
                {item.label}
              </button>
            ))}
            <button onClick={() => { onRemoveOverride(employee.code, popupDay); setPopupDay(null); }}
              style={{
                padding: '9px 12px', borderRadius: '9px', border: '1px solid rgba(255,59,48,0.2)',
                background: 'rgba(255,59,48,0.06)', color: 'var(--red)', cursor: 'pointer',
                fontSize: '13px', fontWeight: 500, textAlign: 'left', fontFamily: 'inherit'
              }}>
              Remove Override
            </button>
            <button onClick={() => setPopupDay(null)}
              style={{
                padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text2)', cursor: 'pointer',
                fontSize: '13px', fontFamily: 'inherit'
              }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
