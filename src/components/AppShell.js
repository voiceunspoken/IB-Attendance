"use client";

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function AppShell({ children }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on navigation
  useEffect(() => {
    if (!sidebarOpen) return;
    const id = setTimeout(() => setSidebarOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname, sidebarOpen]);

  const isLoginPage = pathname === '/login';

  // Login page: no sidebar, full width
  if (isLoginPage) {
    return <main style={{ minHeight: '100vh' }}>{children}</main>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {isAuthenticated && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isMobile={isMobile}
        />
      )}

      {/* Hamburger button — mobile only, visible when sidebar is closed */}
      {isAuthenticated && isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          style={{
            position: 'fixed', top: '12px', left: '12px', zIndex: 50,
            width: '36px', height: '36px', borderRadius: '10px',
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
            display: 'grid', placeItems: 'center', fontSize: '18px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >☰</button>
      )}

      {/* Main content area — add padding on mobile for hamburger */}
      <main style={{
        flex: 1, minWidth: 0,
        paddingTop: isAuthenticated && isMobile && !sidebarOpen ? '56px' : '0',
        transition: 'padding-top 0.2s ease',
      }}>
        {children}
      </main>
    </div>
  );
}
