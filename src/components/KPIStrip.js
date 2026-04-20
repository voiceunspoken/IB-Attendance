"use client";

export default function KPIStrip({ kpis }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '12px',
      marginBottom: '20px'
    }}>
      {kpis.map((k, i) => (
        <div key={i} className="card" style={{ padding: '18px 20px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px', marginBottom: '12px',
            background: k.color + '18', display: 'grid', placeItems: 'center', fontSize: '16px'
          }}>
            {k.icon}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', lineHeight: 1 }}>
            {k.value}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginTop: '6px', letterSpacing: '-0.01em' }}>
            {k.label}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px', letterSpacing: '-0.01em' }}>
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
