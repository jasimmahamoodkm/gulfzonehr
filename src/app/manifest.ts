import type { MetadataRoute } from 'next';
import { BRANDING, brandAsset } from '@/config/branding';

// Web app manifest — makes "Add to Home Screen" install the app as a
// standalone PWA on iPhone/Android. Served at <basePath>/manifest.webmanifest;
// URLs inside the manifest are NOT basePath-prefixed automatically, so they
// carry the configured basePath explicitly.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRANDING.appName,
    short_name: BRANDING.shortName,
    description: BRANDING.description,
    start_url: brandAsset('/dashboard'),
    scope: `${BRANDING.basePath}/`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: BRANDING.colors.background,
    theme_color: BRANDING.colors.themeColor,
    icons: [
      { src: brandAsset('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: brandAsset('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
      { src: brandAsset('/icons/icon-512-maskable.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
