"use client";
import { useState } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import Modal from './Modal';

export default function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = 'Delete', confirmLoadingLabel = 'Deleting…', variant = 'danger' }) {
  const [loading, setLoading] = useState(false);

  return (
    <Modal open={true} onClose={onCancel} title="" width="400px">
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
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>Cancel</button>
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
    </Modal>
  );
}
