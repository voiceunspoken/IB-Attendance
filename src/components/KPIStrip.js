"use client";

export default function KPIStrip({ kpis }) {
  if (!kpis || kpis.length === 0) return null;

  return (
    <div
      className="kpi-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${kpis.length}, 1fr)`,
        gap: 'var(--gap)',
        marginBottom: 'calc(var(--gap) * 1.5)',
      }}
    >
      {kpis.map((k, i) => (
        <div
          key={i}
          className="card"
          onClick={k.onClick}
          style={{
            padding: 'clamp(14px, 2vw, 22px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            position: 'relative',
            overflow: 'hidden',
            cursor: k.onClick ? 'pointer' : 'default',
            animation: `fadeIn 0.4s ease ${i * 0.05}s both`,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={e => { if (k.onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}}
          onMouseLeave={e => { if (k.onClick) { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}}
        >
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '3px', background: `linear-gradient(90deg, ${k.color}, ${k.color}88)`, borderRadius: '20px 20px 0 0',
          }} />

          <div style={{
            width: 'clamp(32px, 3vw, 40px)',
            height: 'clamp(32px, 3vw, 40px)',
            borderRadius: '10px',
            background: k.color + '15',
            display: 'grid',
            placeItems: 'center',
            fontSize: 'clamp(14px, 1.6vw, 18px)',
            color: k.color,
          }}>
            {k.icon}
          </div>

          <div style={{
            fontSize: 'clamp(22px, 2.8vw, 34px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: 'var(--text)',
            lineHeight: 1,
          }}>
            {k.value}
          </div>

          <div>
            <div style={{
              fontSize: 'clamp(11px, 1.1vw, 13px)',
              fontWeight: 600,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {k.label}
              {k.onClick && (
                <span style={{ fontSize: '10px', color: 'var(--text3)', transition: 'transform 0.12s', display: 'inline-block' }}
                  className="kpi-arrow">→</span>
              )}
            </div>
            <div style={{
              fontSize: 'clamp(10px, 0.9vw, 11px)',
              color: 'var(--text2)',
              marginTop: '2px',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}>
              {k.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
