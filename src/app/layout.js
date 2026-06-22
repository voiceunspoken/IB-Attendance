import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import { ToastProvider } from '../components/Toast';
import { NotificationProvider } from '../components/NotificationProvider';
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
            <NotificationProvider>
              <AppShell>{children}</AppShell>
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
