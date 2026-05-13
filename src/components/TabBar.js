"use client";

export default function TabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg2)', borderRadius: '10px', padding: '3px' }}>
      {tabs.map(tab => (
        <button key={tab.key} onClick={() => onTabChange(tab.key)} style={{
          padding: '6px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.2s',
          background: activeTab === tab.key ? 'var(--card)' : 'transparent',
          color: activeTab === tab.key ? 'var(--text)' : 'var(--text2)',
          boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
        }}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
