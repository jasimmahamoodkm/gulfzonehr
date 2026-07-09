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
  // Full URLs and data: URIs pass through untouched; public paths get basePath.
  return /^(https?:\/\/|data:)/.test(p) ? p : brandAsset(p);
};

/** Custom header logo image, or null → show the initials tile. */
export const brandLogo = (): string | null => resolveImage(BRANDING.images?.logo);

/** Custom favicon, or null → use the generated icon PNGs. */
export const brandFavicon = (): string | null => resolveImage(BRANDING.images?.favicon);

/**
 * Per-company branding from branding.config.json → companyBranding, keyed by
 * company name (case-insensitive). Same mechanism as the main app logo:
 * edit the JSON, drop artwork in public/branding, rebuild. Returns nulls when
 * the company isn't configured so callers fall back to the app branding.
 */
export const companyBranding = (
  name?: string | null,
): { logo: string | null; color: string | null } => {
  const map = (BRANDING as { companyBranding?: Record<string, { logo?: string; color?: string }> }).companyBranding;
  if (!name || !map) return { logo: null, color: null };
  const key = Object.keys(map).find((k) => k.toLowerCase() === name.toLowerCase());
  const entry = key ? map[key] : undefined;
  return { logo: resolveImage(entry?.logo), color: entry?.color?.trim() || null };
};
