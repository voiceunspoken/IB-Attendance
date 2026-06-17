"use client";
import { createContext, useContext, useState, useCallback } from 'react';
import { FiCheck, FiX, FiInfo } from 'react-icons/fi';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 200);
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const toast = {
    success: (msg) => addToast(msg, 'success', 3000),
    error: (msg) => addToast(msg, 'error', 5000),
    info: (msg) => addToast(msg, 'info', 4000),
  };

  const accent = (type) =>
    type === 'success' ? '#34c759'
    : type === 'error' ? '#ff3b30'
    : '#0071e3';

  const Icon = ({ type }) => {
    if (type === 'success') return <FiCheck size={16} />;
    if (type === 'error') return <FiX size={16} />;
    return <FiInfo size={16} />;
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{
        position: 'fixed', top: '16px', right: '16px', zIndex: 99999,
        display: 'flex', flexDirection: 'column', gap: '8px',
        pointerEvents: 'none'
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              padding: '14px 18px', borderRadius: '14px',
              background: '#1c1c1e', color: '#f5f5f7',
              fontSize: '14px', fontWeight: 500, lineHeight: 1.4,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              animation: t.exiting ? 'toastExit 0.2s ease forwards' : 'toastEnter 0.25s ease',
              pointerEvents: 'auto',
              maxWidth: '400px',
              display: 'flex', alignItems: 'center', gap: '10px',
              border: `1px solid ${accent(t.type)}33`,
              letterSpacing: '-0.01em',
            }}
            onClick={() => removeToast(t.id)}
          >
            <span style={{ color: accent(t.type), flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <Icon type={t.type} />
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
