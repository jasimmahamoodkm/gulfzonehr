import type { Metadata, Viewport } from 'next';
import { CompanyProvider } from '@/context/CompanyContext';
import { AuthProvider } from '@/context/AuthContext';
import { BRANDING, brandAsset } from '@/config/branding';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: BRANDING.appName,
  description: BRANDING.description,
  icons: {
    icon: [
      { url: brandAsset('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { url: brandAsset('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
    ],
    apple: brandAsset('/icons/apple-touch-icon.png'),
  },
  // iOS "Add to Home Screen": standalone window with its own title
  appleWebApp: {
    capable: true,
    title: BRANDING.shortName,
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: BRANDING.colors.themeColor,
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
