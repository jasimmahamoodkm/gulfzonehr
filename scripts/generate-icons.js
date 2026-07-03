#!/usr/bin/env node
/**
 * Generate the PWA / favicon PNG set from branding.config.json.
 *
 * Renders the brand initials on a gradient tile (same mark the header shows)
 * into public/icons/. Run after editing branding.config.json:
 *
 *     npm run generate-icons
 *
 * If a client supplies real logo artwork instead, skip this script and drop
 * their PNGs into public/icons/ using the same four filenames.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const branding = require('../branding.config.json');

const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

const { initials, colors } = branding;

// pad > 0 = maskable-style safe zone (full-bleed background, smaller glyph)
const svg = (pad) => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.primary}"/>
      <stop offset="1" stop-color="${colors.primaryDark}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${pad > 0 ? 0 : 96}" fill="url(#g)"/>
  <text x="256" y="${256 + (pad > 0 ? 150 * (1 - pad) : 150) * 0.62}"
        font-family="Helvetica, Arial, sans-serif" font-weight="bold"
        font-size="${pad > 0 ? 220 * (1 - pad) + 110 : 220}"
        fill="#ffffff" text-anchor="middle">${initials}</text>
</svg>`);

(async () => {
  await sharp(svg(0)).resize(512, 512).png().toFile(path.join(out, 'icon-512.png'));
  await sharp(svg(0)).resize(192, 192).png().toFile(path.join(out, 'icon-192.png'));
  await sharp(svg(0.25)).resize(512, 512).png().toFile(path.join(out, 'icon-512-maskable.png'));
  // Apple touch icon: full-bleed square (iOS applies its own corner rounding)
  await sharp(svg(0.15)).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));
  console.log(`✓ Icons generated for "${initials}" (${colors.primary}) → public/icons/`);
})().catch((e) => { console.error(e); process.exit(1); });
