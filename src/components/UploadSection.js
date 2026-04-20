"use client";

import { useState } from 'react';

export default function UploadSection({ onFileSelected }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) onFileSelected(e.dataTransfer.files[0]);
  };
  const handleChange = (e) => {
    if (e.target.files?.[0]) onFileSelected(e.target.files[0]);
  };

  return (
    <div style={{ maxWidth: '640px', margin: '48px auto', padding: '0 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1.1, marginBottom: '10px' }}>
          Upload Attendance Data
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '15px', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
          Drop your monthly biometric XLS/XLSX export from ONtime.<br />
          HR policy rules are applied automatically.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `1.5px dashed ${isDragOver ? 'var(--blue)' : 'var(--border2)'}`,
          borderRadius: '20px',
          padding: '56px 32px',
          background: isDragOver ? 'var(--blue-light)' : 'var(--surface)',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          position: 'relative',
          textAlign: 'center',
          boxShadow: isDragOver ? '0 0 0 4px rgba(0,113,227,0.1)' : 'var(--shadow-sm)'
        }}
      >
        <input
          type="file"
          accept=".xls,.xlsx"
          onChange={handleChange}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
        <div style={{
          width: '56px', height: '56px', margin: '0 auto 16px',
          background: isDragOver ? 'var(--blue)' : 'var(--surface3)',
          borderRadius: '14px', display: 'grid', placeItems: 'center',
          fontSize: '24px', transition: 'all 0.2s'
        }}>
          📊
        </div>
        <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: '4px' }}>
          Drop your file here
        </div>
        <div style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '16px' }}>or click to browse</div>
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
          {['.xls', '.xlsx', 'ONtime Format'].map(tag => (
            <span key={tag} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              padding: '3px 10px', borderRadius: '980px', fontSize: '11px',
              color: 'var(--text2)', fontWeight: 500
            }}>{tag}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '24px' }}>
        {[
          { icon: '⏰', title: 'Shift Timing', desc: '10:00 AM – 7:00 PM. Late after 10:15 AM. 3 lates = 1 HD deduction.' },
          { icon: '⚡', title: 'Short Shift', desc: 'Min 9 hrs required. 3 short shifts = 1 HD. Not counted if already Late.' },
          { icon: '🏢', title: 'WFM / WFH', desc: 'Mark any day as Work From Ministry or Work From Home on the calendar.' },
        ].map((item) => (
          <div key={item.title} className="card" style={{ padding: '16px', textAlign: 'left' }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>{item.icon}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px', letterSpacing: '-0.01em' }}>{item.title}</div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', lineHeight: 1.5 }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
