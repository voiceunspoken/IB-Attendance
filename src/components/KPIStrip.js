"use client";

export default function KPIStrip({ kpis }) {
  return (
    <div
      className="kpi-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: 'var(--gap)',
        marginBottom: 'calc(var(--gap) * 1.5)',
      }}
    >
      {kpis.map((k, i) => (
        <div
          key={i}
          className="card"
          style={{
            padding: 'clamp(14px, 2vw, 22px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'default',
          }}
        >
          {/* Subtle color accent top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '3px', background: k.color, borderRadius: '20px 20px 0 0',
            opacity: 0.7,
          }} />

          {/* Icon */}
          <div style={{
            width: 'clamp(32px, 3vw, 40px)',
            height: 'clamp(32px, 3vw, 40px)',
            borderRadius: '10px',
            background: k.color + '15',
            display: 'grid',
            placeItems: 'center',
            fontSize: 'clamp(14px, 1.6vw, 18px)',
          }}>
            {k.icon}
          </div>

          {/* Value */}
          <div style={{
            fontSize: 'clamp(22px, 2.8vw, 34px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: 'var(--text)',
            lineHeight: 1,
          }}>
            {k.value}
          </div>

          {/* Label + sub */}
          <div>
            <div style={{
              fontSize: 'clamp(11px, 1.1vw, 13px)',
              fontWeight: 600,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
            }}>
              {k.label}
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
