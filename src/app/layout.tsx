import type { Metadata, Viewport } from 'next';
import {
  Poppins,
  Libre_Baskerville,
  IBM_Plex_Mono,
  Montserrat,
  Merriweather,
  Ubuntu_Mono,
  Inter,
  Source_Serif_4,
  JetBrains_Mono,
  Open_Sans,
  Outfit,
} from 'next/font/google';
import { cookies } from 'next/headers';
import { CompanyProvider } from '@/context/CompanyContext';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BRANDING, brandAsset, brandFavicon } from '@/config/branding';
import {
  COLOR_MODE_COOKIE_NAME,
  parseColorMode,
  parseThemeId,
  THEME_COOKIE_NAME,
  THEME_INIT_SCRIPT,
} from '@/config/themes';
import '../styles/globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-libre-baskerville',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-merriweather',
  display: 'swap',
});

const ubuntuMono = Ubuntu_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-ubuntu-mono',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const fontVariables = [
  poppins.variable,
  ibmPlexMono.variable,
  libreBaskerville.variable,
  montserrat.variable,
  merriweather.variable,
  ubuntuMono.variable,
  inter.variable,
  sourceSerif.variable,
  jetbrainsMono.variable,
  openSans.variable,
  outfit.variable,
].join(' ');

const favicon = brandFavicon();

export const metadata: Metadata = {
  title: BRANDING.appName,
  description: BRANDING.description,
  icons: {
    icon: favicon
      ? [{ url: favicon }]
      : [
          { url: brandAsset('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
          { url: brandAsset('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
        ],
    apple: brandAsset('/icons/apple-touch-icon.png'),
  },
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialThemeId = parseThemeId(cookieStore.get(THEME_COOKIE_NAME)?.value);
  const initialColorMode = parseColorMode(cookieStore.get(COLOR_MODE_COOKIE_NAME)?.value);
  const darkClass = initialColorMode === 'dark' ? 'dark' : '';

  return (
    <html
      lang="en"
      data-theme={initialThemeId}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fontVariables} ${darkClass}`.trim()}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased">
        <ThemeProvider initialThemeId={initialThemeId} initialColorMode={initialColorMode}>
          <AuthProvider>
            <CompanyProvider>{children}</CompanyProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
