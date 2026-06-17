"use client";
import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function Modal({ open, onClose, title, children, width = '440px' }) {
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  if (!open) return null;
  return (
    <div onClick={onClose} onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'grid', placeItems: 'center',
      padding: '24px', overflow: 'hidden',
      animation: 'fadeIn 0.15s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        padding: '28px', width, maxWidth: '92vw',
        maxHeight: '100%', overflow: 'hidden',
        animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '20px',
        }}>
          <div style={{
            fontSize: 'var(--fs-lg)', fontWeight: 700,
            letterSpacing: '-0.03em',
          }}>{title}</div>
          <button onClick={onClose} style={{
            width: '30px', height: '30px', borderRadius: '50%',
            border: 'none', background: 'var(--surface2)',
            cursor: 'pointer', fontSize: '14px',
            fontFamily: 'inherit', display: 'grid', placeItems: 'center',
            color: 'var(--text2)', transition: 'all 0.15s',
          }}><FiX size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
