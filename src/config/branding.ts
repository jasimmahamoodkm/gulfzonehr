// Typed access to the per-client branding configuration.
//
// branding.config.json (project root) is the SINGLE source of truth for the
// app name, logo initials, colors and base path. It is shared by:
//   - next.config.js            (basePath, root redirect)
//   - src/app/layout.tsx        (titles, favicon, apple-touch-icon)
//   - src/app/manifest.ts       (PWA manifest)
//   - UI components             (header logo, login/signup copy)
//   - scripts/generate-icons.js (PWA icon PNGs)
//
// To rebrand for another client: edit branding.config.json, run
// `npm run generate-icons`, rebuild. See BRANDING.md.
import branding from '../../branding.config.json';

export const BRANDING = branding;

/** Prefix a public asset path with the configured basePath. */
export const brandAsset = (p: string): string => `${BRANDING.basePath}${p}`;

/**
 * Resolve an optional branding image from config.
 * Returns null when not configured (caller falls back to the generated
 * initials icon). Absolute URLs pass through; public paths get the basePath.
 */
const resolveImage = (p: string | undefined): string | null => {
  if (!p) return null;
  return /^https?:\/\//.test(p) ? p : brandAsset(p);
};

/** Custom header logo image, or null → show the initials tile. */
export const brandLogo = (): string | null => resolveImage(BRANDING.images?.logo);

/** Custom favicon, or null → use the generated icon PNGs. */
export const brandFavicon = (): string | null => resolveImage(BRANDING.images?.favicon);
