import type { Metadata, Viewport } from 'next';
import { CompanyProvider } from '@/context/CompanyContext';
import { AuthProvider } from '@/context/AuthContext';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'GulfZone HR Management System',
  description: 'Comprehensive HR management solution for GulfZone Group',
  icons: {
    icon: [
      { url: '/HRportal/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/HRportal/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/HRportal/icons/apple-touch-icon.png',
  },
  // iOS "Add to Home Screen": standalone window with its own title
  appleWebApp: {
    capable: true,
    title: 'GulfZone HR',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <CompanyProvider>{children}</CompanyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
