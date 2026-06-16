import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ToastProvider } from '../components/Toast';
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'Interactive Bees — Attendance',
  description: 'Biometric Attendance Intelligence Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
