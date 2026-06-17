"use client";
import { useState } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

export default function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Delete', confirmLoadingLabel = 'Deleting…', variant = 'danger' }) {
  const [loading, setLoading] = useState(false);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid', placeItems: 'center',
        padding: '24px',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--surface)', borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
          padding: '24px', maxWidth: '400px', width: '100%',
          maxHeight: 'min(85vh, 500px)', overflowY: 'auto',
          animation: 'slideUp 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(255,59,48,0.1)', color: 'var(--red)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <FiAlertTriangle size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: '4px' }}>
              Confirm
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5, letterSpacing: '-0.01em' }}>
              {message}
            </div>
          </div>
          <button onClick={onCancel}
            style={{
              width: '28px', height: '28px', borderRadius: '50%', border: 'none',
              background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer',
              display: 'grid', placeItems: 'center', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            <FiX size={14} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            className="btn btn-secondary"
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Cancel
          </button>
          <button onClick={async () => {
            setLoading(true);
            try { await onConfirm(); } finally { setLoading(false); }
          }}
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '8px 16px', background: variant === 'danger' ? 'var(--red)' : 'var(--blue)', opacity: loading ? 0.7 : 1 }}
            disabled={loading}
          >
            {loading ? confirmLoadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
