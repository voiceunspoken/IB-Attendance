"use client";

export default function EmployeeTable({ results, onOpenDetail, currentPage, setCurrentPage, pageSize = 20, overrides }) {
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, results.length);
  const currentData = results.slice(start, end);
  const totalPages = Math.ceil(results.length / pageSize);

  const empOverrideCounts = (code) => {
    let wfm = 0, wfmhd = 0, wfh = 0;
    Object.keys(overrides).forEach(k => {
      if (k.startsWith(code + '_')) {
        const v = overrides[k];
        if (v === 'wfm') wfm++;
        else if (v === 'wfm-hd') wfmhd++;
        else if (v === 'wfh') wfh++;
      }
    });
    return { wfm, wfmhd, wfh };
  };

  const StatusBadge = ({ r, ov }) => {
    if (ov.wfm > 0 || ov.wfmhd > 0) return <span style={badge('rgba(52,199,89,0.12)', '#1a7f37')}>WFM</span>;
    if (ov.wfh > 0) return <span style={badge('rgba(175,82,222,0.12)', '#7b2d8b')}>WFH</span>;
    if (r.absent >= 8) return <span style={badge('rgba(255,59,48,0.1)', '#c0392b')}>High Absent</span>;
    if (r.lateHD + r.ssHD > 1) return <span style={badge('rgba(255,159,10,0.12)', '#b36200')}>HD Ded.</span>;
    if (r.absent === 0 && r.lateHD === 0) return <span style={badge('rgba(52,199,89,0.1)', '#1a7f37')}>Clean</span>;
    return <span style={badge('rgba(0,0,0,0.05)', 'var(--text2)')}>Normal</span>;
  };

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div style={{ overflowX: 'auto', maxHeight: '540px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={th}>Code</th>
              <th style={{ ...th, textAlign: 'left' }}>Employee</th>
              <th style={th}>Present</th>
              <th style={th}>Absent</th>
              <th style={th}>Half Days</th>
              <th style={th}>Late</th>
              <th style={th}>HD(Late)</th>
              <th style={th}>Sh.Shift</th>
              <th style={th}>HD(SS)</th>
              <th style={th}>Sh.Leave</th>
              <th style={th}>RL</th>
              <th style={th}>Holiday</th>
              <th style={th} title="Work From Ministry Full">WFM</th>
              <th style={th} title="Work From Ministry Half">WFM½</th>
              <th style={th} title="Work From Home">WFH</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((r) => {
              const ov = empOverrideCounts(r.code);
              return (
                <tr
                  key={r.code}
                  onClick={() => onOpenDetail(r)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ ...td, color: 'var(--text2)', fontSize: '12px' }}>{r.code}</td>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 500, color: 'var(--text)' }}>{r.name}</td>
                  <td style={{ ...td, color: 'var(--green)', fontWeight: 500 }}>{r.present}</td>
                  <td style={{ ...td, color: r.absent >= 5 ? 'var(--red)' : 'var(--text)', fontWeight: r.absent >= 5 ? 600 : 400 }}>{r.absent}</td>
                  <td style={td}>{r.halfDay || '—'}</td>
                  <td style={{ ...td, color: r.late >= 9 ? 'var(--yellow)' : 'var(--text)' }}>{r.late}</td>
                  <td style={{ ...td, color: r.lateHD > 0 ? 'var(--yellow)' : 'var(--text2)' }}>{r.lateHD || '—'}</td>
                  <td style={{ ...td, color: r.shortShift >= 9 ? 'var(--orange)' : 'var(--text)' }}>{r.shortShift}</td>
                  <td style={{ ...td, color: r.ssHD > 0 ? 'var(--red)' : 'var(--text2)' }}>{r.ssHD || '—'}</td>
                  <td style={{ ...td, color: r.shortLeave > 0 ? 'var(--blue)' : 'var(--text2)' }}>{r.shortLeave || '—'}</td>
                  <td style={{ ...td, color: r.rl > 0 ? 'var(--purple)' : 'var(--text2)' }}>{r.rl || '—'}</td>
                  <td style={td}>{r.holi || '—'}</td>
                  <td style={{ ...td, color: ov.wfm > 0 ? 'var(--green)' : 'var(--text2)', fontWeight: ov.wfm > 0 ? 600 : 400 }}>{ov.wfm || '—'}</td>
                  <td style={{ ...td, color: ov.wfmhd > 0 ? 'var(--green)' : 'var(--text2)' }}>{ov.wfmhd || '—'}</td>
                  <td style={{ ...td, color: ov.wfh > 0 ? 'var(--purple)' : 'var(--text2)' }}>{ov.wfh || '—'}</td>
                  <td style={td}><StatusBadge r={r} ov={ov} /></td>
                  <td style={td}>
                    <span style={{ color: 'var(--blue)', fontSize: '13px', fontWeight: 500 }}>View →</span>
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
  padding: '10px 12px',
  fontWeight: 600,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)'
};
const td = { padding: '11px 12px', color: 'var(--text)', whiteSpace: 'nowrap' };
const badge = (bg, color) => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '3px 9px', borderRadius: '980px',
  fontSize: '11px', fontWeight: 600, letterSpacing: '0.01em',
  background: bg, color
});
const pageBtn = (disabled) => ({
  width: '28px', height: '28px', borderRadius: '7px',
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text2)', cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '13px', display: 'grid', placeItems: 'center',
  opacity: disabled ? 0.35 : 1, fontFamily: 'inherit'
});
const pageBtnActive = { background: 'var(--blue)', borderColor: 'var(--blue)', color: '#fff' };
