import type { Metadata } from 'next';
import { CompanyProvider } from '@/context/CompanyContext';
import { AuthProvider } from '@/context/AuthContext';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'GulfZone HR Management System',
  description: 'Comprehensive HR management solution for GulfZone Group',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90" font-weight="bold" fill="%230F3460">G</text></svg>',
  },
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
