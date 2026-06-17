"use client";
import { FiCheck } from 'react-icons/fi';

const getMonthSuffix = (d) => {
  if (d > 3 && d < 21) return 'th';
  switch (d % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
};

export default function EmployeeTable({ results, onOpenDetail, currentPage, setCurrentPage, pageSize = 20, overrides, showMissingDays = false }) {
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, results.length);
  const currentData = results.slice(start, end);
  const totalPages = Math.ceil(results.length / pageSize);

  const MissingDaysTooltip = ({ days }) => {
    if (!days || days.length === 0) return null;
    return (
      <div className="pm-tooltip" style={{
        position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
        background: '#1c1c1e', color: '#fff', borderRadius: '10px', padding: '8px 14px',
        fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em',
        whiteSpace: 'nowrap', zIndex: 100,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
      }}>
        Missing: {days.map(d => `${d.day}${getMonthSuffix(d.day)}`).join(', ')}
      </div>
    );
  };

  const MissingDayPills = ({ days }) => {
    if (!days || days.length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '200px' }}>
        {days.map((d, i) => {
          const day = d.day;
          return (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
              background: 'rgba(255,107,53,0.1)', color: '#c04a1a',
              letterSpacing: '-0.01em',
            }}>
              ⚠ {day}{getMonthSuffix(day)}
            </span>
          );
        })}
      </div>
    );
  };

  const empOverrideCounts = (code) => {
    let wfm = 0, wfmhd = 0, wfh = 0, wos = 0, woshd = 0;
    Object.keys(overrides).forEach(k => {
      if (k.startsWith(code + '_')) {
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

  const StatusBadge = ({ r, ov }) => {
    const s = (bg, color, label, icon) => (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 10px', borderRadius: '980px',
        fontSize: 'clamp(10px, 0.9vw, 11px)', fontWeight: 600, letterSpacing: '0.01em',
        background: bg, color
      }}>
        {icon && <span style={{ fontSize: '10px' }}>{icon}</span>}
        {label}
      </span>
    );
    if (ov.wfm > 0 || ov.wfmhd > 0) return s('rgba(52,199,89,0.12)', '#1a7f37', 'WFM', '🟢');
    if (ov.wfh > 0) return s('rgba(175,82,222,0.12)', '#7b2d8b', 'WFH', '🟣');
    if (ov.wos > 0 || ov.woshd > 0) return s('rgba(48,176,199,0.12)', '#1a6e7a', 'WOS', '🔵');
    if (r.punchMissing >= 3) return s('rgba(255,107,53,0.12)', '#c04a1a', 'No Punch', '⚠');
    if (r.absent >= 8) return s('rgba(255,59,48,0.1)', '#c0392b', 'High Absent', '🔴');
    if (r.lateHD + r.ssHD > 1) return s('rgba(255,159,10,0.12)', '#b36200', 'HD Ded', '🟡');
    if (r.absent === 0 && r.lateHD === 0 && r.punchMissing === 0) return s('rgba(52,199,89,0.1)', '#1a7f37', 'Clean', <FiCheck size={10} />);
    return s('rgba(0,0,0,0.05)', 'var(--text2)', 'Normal', '—');
  };

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ overflowX: 'auto', maxHeight: '540px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={th}>Code</th>
              <th style={{ ...th, textAlign: 'left' }}>Employee</th>
              <th style={th}>Department</th>
              {!showMissingDays && <th style={th}>Present</th>}
              {!showMissingDays && <th style={th}>Absent</th>}
              {!showMissingDays && <th style={th}>Half</th>}
              {!showMissingDays && <th style={th}>Late</th>}
              {!showMissingDays && <th style={th}>HD(L)</th>}
              {!showMissingDays && <th style={th}>Sh.Sh</th>}
              {!showMissingDays && <th style={th}>HD(SS)</th>}
              {!showMissingDays && <th style={th}>Sh.Lv</th>}
              {!showMissingDays && <th style={th}>RL</th>}
              {!showMissingDays && <th style={th}>Hol.</th>}
              {!showMissingDays && <th style={th}>WFM</th>}
              {!showMissingDays && <th style={th}>WFM½</th>}
              {!showMissingDays && <th style={th}>WFH</th>}
              {!showMissingDays && <th style={th}>WOS</th>}
              {!showMissingDays && <th style={th}>WOS½</th>}
              {showMissingDays && <th style={th}>Missing Days</th>}
              <th style={th}>⚠</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((r, idx) => {
              const ov = empOverrideCounts(r.code);
              return (
                <tr
                  key={r.code}
                  onClick={() => onOpenDetail(r)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.12s', animation: `fadeIn 0.3s ease ${idx * 0.03}s both` }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.querySelector('.view-btn').style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.querySelector('.view-btn').style.opacity = '0'; }}
                >
                  <td style={{ ...td, color: 'var(--text2)', fontSize: '12px' }}>{r.code}</td>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 500, color: 'var(--text)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                  <td style={{ ...td, color: 'var(--text2)', fontSize: '12px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.department || '—'}</td>
                  {!showMissingDays && <td style={{ ...td, color: 'var(--green)', fontWeight: 500 }}>{r.present}</td>}
                  {!showMissingDays && <td style={{ ...td, color: r.absent >= 5 ? 'var(--red)' : 'var(--text)', fontWeight: r.absent >= 5 ? 600 : 400 }}>{r.absent}</td>}
                  {!showMissingDays && <td style={{ ...td, color: 'var(--orange)', fontWeight: r.halfDay > 0 ? 500 : 400 }}>{r.halfDay || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: r.late >= 6 ? 'var(--yellow)' : 'var(--text)' }}>{r.late}</td>}
                  {!showMissingDays && <td style={{ ...td, color: r.lateHD > 0 ? 'var(--yellow)' : 'var(--text2)' }}>{r.lateHD || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: r.shortShift >= 6 ? 'var(--orange)' : 'var(--text)' }}>{r.shortShift}</td>}
                  {!showMissingDays && <td style={{ ...td, color: r.ssHD > 0 ? 'var(--orange)' : 'var(--text2)' }}>{r.ssHD || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: r.shortLeave > 0 ? 'var(--blue)' : 'var(--text2)' }}>{r.shortLeave || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: r.rl > 0 ? 'var(--purple)' : 'var(--text2)' }}>{r.rl || '—'}</td>}
                  {!showMissingDays && <td style={td}>{r.holi || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: ov.wfm > 0 ? 'var(--green)' : 'var(--text2)', fontWeight: ov.wfm > 0 ? 600 : 400 }}>{ov.wfm || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: ov.wfmhd > 0 ? 'var(--green)' : 'var(--text2)' }}>{ov.wfmhd || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: ov.wfh > 0 ? 'var(--purple)' : 'var(--text2)' }}>{ov.wfh || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: ov.wos > 0 ? 'var(--teal)' : 'var(--text2)' }}>{ov.wos || '—'}</td>}
                  {!showMissingDays && <td style={{ ...td, color: ov.woshd > 0 ? 'var(--teal)' : 'var(--text2)' }}>{ov.woshd || '—'}</td>}
                  {showMissingDays && <td style={td}><MissingDayPills days={r.punchMissingDays} /></td>}
                  <td style={{ ...td, color: r.punchMissing > 0 ? 'var(--orange)' : 'var(--text2)', fontWeight: r.punchMissing > 0 ? 600 : 400, position: 'relative' }}
                      onMouseEnter={e => { const t = e.currentTarget.querySelector('.pm-tooltip'); if (t) t.style.opacity = '1'; }}
                      onMouseLeave={e => { const t = e.currentTarget.querySelector('.pm-tooltip'); if (t) t.style.opacity = '0'; }}>
                    {r.punchMissing || '—'}
                    <MissingDaysTooltip days={r.punchMissingDays} />
                  </td>
                  <td style={td}><StatusBadge r={r} ov={ov} /></td>
                  <td style={{ ...td, position: 'relative' }}>
                    <span className="view-btn" style={{
                      color: 'var(--blue)', fontSize: '12px', fontWeight: 600,
                      opacity: 0, transition: 'opacity 0.12s',
                      padding: '4px 10px', borderRadius: '6px',
                      background: 'rgba(0,113,227,0.08)',
                    }}>View</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderTop: '1px solid var(--border)',
        fontSize: '13px', color: 'var(--text2)'
      }}>
        <div style={{ letterSpacing: '-0.01em' }}>
          {start + 1}–{end} of {results.length} employees
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={pageBtn(currentPage === 1)} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
          {[...Array(totalPages)].map((_, i) => {
            const p = i + 1;
            if (totalPages <= 8 || Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages) {
              return <button key={p} style={{ ...pageBtn(false), ...(p === currentPage ? pageBtnActive : {}) }} onClick={() => setCurrentPage(p)}>{p}</button>;
            } else if (Math.abs(p - currentPage) === 3) {
              return <span key={p} style={{ color: 'var(--text3)', padding: '0 4px', lineHeight: '28px' }}>…</span>;
            }
            return null;
          })}
          <button style={pageBtn(currentPage === totalPages || totalPages === 0)} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>›</button>
        </div>
      </div>
    </div>
  );
}

const th = {
  background: 'var(--surface2)',
  color: 'var(--text2)',
  padding: 'clamp(8px, 1vw, 12px) clamp(10px, 1.2vw, 14px)',
  fontWeight: 600,
  fontSize: 'clamp(10px, 1vw, 11px)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)'
};
const td = { padding: 'clamp(10px, 1vw, 13px) clamp(10px, 1.2vw, 14px)', color: 'var(--text)', whiteSpace: 'nowrap', fontSize: 'clamp(12px, 1.1vw, 13px)' };
const pageBtn = (disabled) => ({
  width: '30px', height: '30px', borderRadius: '8px',
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text2)', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 'clamp(12px, 1.1vw, 14px)', display: 'grid', placeItems: 'center',
  opacity: disabled ? 0.35 : 1, fontFamily: 'inherit', transition: 'all 0.15s',
});
const pageBtnActive = { background: 'var(--blue)', border: '1px solid var(--blue)', color: '#fff' };
