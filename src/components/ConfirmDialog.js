"use client";

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)'
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--card, #fff)', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '90%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.18)'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--text, #1c1c1e)' }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text2, #6e6e73)', lineHeight: 1.5, marginBottom: '20px' }}>{message}</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ padding: '8px 18px', fontSize: '13px' }}>Cancel</button>
          <button className="btn" onClick={onConfirm} style={{
            padding: '8px 18px', fontSize: '13px', borderRadius: '980px', border: '1px solid rgba(255,59,48,0.25)',
            background: 'rgba(255,59,48,0.08)', color: 'var(--red, #ff3b30)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600
          }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
