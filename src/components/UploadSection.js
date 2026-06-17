"use client";

import { useState } from 'react';
import { FiClock, FiZap, FiHome, FiCalendar, FiFolder, FiBarChart2 } from 'react-icons/fi';

export default function UploadSection({ onFileSelected }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSelect(file);
  };
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  };

  const validateAndSelect = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx'].includes(ext)) {
      alert('Please select a valid .xls or .xlsx file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }
    onFileSelected(file);
  };

  const rules = [
    {
      icon: <FiClock size={18} />,
      color: '#ff9f0a',
      bg: 'rgba(255,159,10,0.1)',
      title: 'Shift Timing',
      desc: '10:00 AM – 7:00 PM with a 15-min grace window. Marked late after 10:15 AM. Every 3 lates = 1 HD deduction.',
    },
    {
      icon: <FiZap size={18} />,
      color: '#af52de',
      bg: 'rgba(175,82,222,0.1)',
      title: 'Short Shift',
      desc: 'Minimum 9 hrs required per day. Every 3 short shifts = 1 HD deduction. Not counted if already marked Late.',
    },
    {
      icon: <FiHome size={18} />,
      color: '#34c759',
      bg: 'rgba(52,199,89,0.1)',
      title: 'WFM / WFH / WOS',
      desc: 'Override any day as Work From Ministry, Work From Home, or Work On Site — full or half day.',
    },
    {
      icon: <FiCalendar size={18} />,
      color: '#0071e3',
      bg: 'rgba(0,113,227,0.1)',
      title: 'Holidays & RL',
      desc: 'Company holidays and restricted leaves are auto-detected from the biometric file and your holiday calendar.',
    },
  ];

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--page-py) var(--page-px)',
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 'clamp(20px, 3vw, 40px)',
        width: '100%',
        maxWidth: '1100px',
        alignItems: 'center',
      }}>

        {/* LEFT — hero + drop zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Hero text */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(0,113,227,0.08)', border: '1px solid rgba(0,113,227,0.15)',
              borderRadius: '980px', padding: '5px 14px', marginBottom: '14px',
              fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--blue)',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              <FiFolder size={14} style={{ marginRight: '4px' }} /> Monthly Upload
            </div>
            <h1 style={{
              fontSize: 'clamp(26px, 3.5vw, 44px)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: 'var(--text)',
              lineHeight: 1.1,
              marginBottom: '10px',
            }}>
              Upload Attendance Data
            </h1>
            <p style={{
              color: 'var(--text2)',
              fontSize: 'var(--fs-md)',
              lineHeight: 1.7,
              letterSpacing: '-0.01em',
              maxWidth: '460px',
            }}>
              Drop your monthly biometric export from ONtime.<br />
              HR policy rules are applied automatically.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragOver ? 'var(--blue)' : 'var(--border2)'}`,
              borderRadius: '24px',
              padding: 'clamp(32px, 5vw, 56px) clamp(24px, 4vw, 40px)',
              background: isDragOver
                ? 'linear-gradient(135deg, rgba(0,113,227,0.06), rgba(0,113,227,0.02))'
                : 'var(--surface)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              position: 'relative',
              textAlign: 'center',
              boxShadow: isDragOver
                ? '0 0 0 6px rgba(0,113,227,0.08), var(--shadow)'
                : 'var(--shadow)',
            }}
          >
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={handleChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />

            {/* Icon */}
            <div style={{
              width: 'clamp(56px, 6vw, 76px)',
              height: 'clamp(56px, 6vw, 76px)',
              margin: '0 auto 18px',
              background: isDragOver
                ? 'linear-gradient(135deg, var(--blue), #409cff)'
                : 'linear-gradient(135deg, var(--surface3), var(--surface2))',
              borderRadius: '20px',
              display: 'grid',
              placeItems: 'center',
              fontSize: 'clamp(24px, 3vw, 34px)',
              transition: 'all 0.25s',
              boxShadow: isDragOver ? '0 8px 24px rgba(0,113,227,0.3)' : 'var(--shadow-sm)',
              transform: isDragOver ? 'scale(1.08) translateY(-2px)' : 'scale(1)',
            }}>
              <FiBarChart2 size={32} />
            </div>

            <div style={{
              fontSize: 'clamp(15px, 1.8vw, 19px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: isDragOver ? 'var(--blue)' : 'var(--text)',
              marginBottom: '5px',
              transition: 'color 0.2s',
            }}>
              {isDragOver ? 'Release to upload' : 'Drop your file here'}
            </div>
            <div style={{
              color: 'var(--text2)',
              fontSize: 'var(--fs-sm)',
              marginBottom: '18px',
              letterSpacing: '-0.01em',
            }}>
              or <span style={{ color: 'var(--blue)', fontWeight: 600 }}>click to browse</span>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {['.xls', '.xlsx', 'ONtime Format', 'Secureye Format'].map(tag => (
                <span key={tag} style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  padding: '4px 12px',
                  borderRadius: '980px',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text2)',
                  fontWeight: 500,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — info cards stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <div style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 700,
            color: 'var(--text2)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '2px',
          }}>
            How it works
          </div>
          {rules.map((item) => (
            <div key={item.title} className="card" style={{
              padding: 'clamp(12px, 1.5vw, 18px)',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}>
              <div style={{
                width: '36px', height: '36px', flexShrink: 0,
                background: item.bg,
                borderRadius: '10px',
                display: 'grid', placeItems: 'center',
                fontSize: '17px',
              }}>
                  {item.icon}
              </div>
              <div>
                <div style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: '3px',
                  letterSpacing: '-0.02em',
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--text2)',
                  lineHeight: 1.6,
                }}>
                  {item.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
