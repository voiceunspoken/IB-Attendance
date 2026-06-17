"use client";

import { use } from 'react';
import Link from 'next/link';
import { EmployeeProvider, useEmployeeData } from './context';
import { FiSearch, FiArrowLeft } from 'react-icons/fi';

export default function EmployeeLayout({ children, params }) {
  const unwrappedParams = use(params);
  const code = unwrappedParams.code;

  return (
    <EmployeeProvider code={code}>
      <EmployeeLayoutInner>{children}</EmployeeLayoutInner>
    </EmployeeProvider>
  );
}

function EmployeeLayoutInner({ children }) {
  const { emp, loading } = useEmployeeData();

  if (loading) return (
    <div className="page-wrapper animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>
    </div>
  );

  if (!emp) return (
    <div className="page-wrapper animate-fade-in">
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.25, color: 'var(--text3)' }}><FiSearch size={36} /></div>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', color: 'var(--text2)' }}>Employee not found</div>
        <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>No employee matches this code or no records exist.</div>
        <Link href="/team" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'var(--accent)', color: '#fff', textDecoration: 'none' }}><FiArrowLeft size={14} /> Go Back</Link>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
