"use client";

export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>
      {message}
    </div>
  );
}
