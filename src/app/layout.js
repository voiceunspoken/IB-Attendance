import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import HeaderNav from '../components/HeaderNav';

export const metadata = {
  title: 'Interactive Bees — Attendance',
  description: 'Biometric Attendance Intelligence Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <HeaderNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
