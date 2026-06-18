"use client";
import { useEffect, useRef, useCallback } from 'react';
import { FiX } from 'react-icons/fi';
import styles from './Modal.module.css';

export default function Modal({ open, onClose, title, children, width = '440px' }) {
  const contentRef = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose?.(); return; }
    if (e.key === 'Tab') {
      const el = contentRef.current;
      if (!el) return;
      const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prev;
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [open, handleKeyDown]);

  if (!open) return null;
  return (
    <div className={styles.overlay} onClick={onClose} onWheel={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
      <div className={styles.center}>
        <div ref={contentRef} className={styles.content} onClick={e => e.stopPropagation()} style={{ width }}>
          <div className={styles.header}>
            <div className={styles.title}>{title}</div>
            <button className={styles.closeBtn} onClick={onClose}><FiX size={14} /></button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
