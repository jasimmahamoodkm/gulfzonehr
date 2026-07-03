import type { MetadataRoute } from 'next';

// Web app manifest — makes "Add to Home Screen" install GulfZone HR as a
// standalone app (PWA) on iPhone/Android. Served at
// /HRportal/manifest.webmanifest; URLs inside the manifest are NOT
// basePath-prefixed automatically, so they carry /HRportal explicitly.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GulfZone HR Management System',
    short_name: 'GulfZone HR',
    description: 'HR management for GulfZone Group',
    start_url: '/HRportal/dashboard',
    scope: '/HRportal/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2563EB',
    icons: [
      { src: '/HRportal/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/HRportal/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/HRportal/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
