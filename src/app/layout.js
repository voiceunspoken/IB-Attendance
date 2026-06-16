import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
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
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
