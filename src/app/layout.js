import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../components/AuthProvider';
import HeaderNav from '../components/HeaderNav';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'Interactive Bees — Attendance',
  description: 'Biometric Attendance Intelligence Dashboard for Interactive Bees. Track attendance, manage leaves, and view reports.',
  keywords: ['attendance', 'HR', 'leave management', 'Interactive Bees'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AuthProvider>
          <HeaderNav />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
