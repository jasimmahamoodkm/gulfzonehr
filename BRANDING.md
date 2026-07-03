# Rebranding for a new client

All branding lives in **`branding.config.json`** (project root) — the single
source of truth consumed by `next.config.js`, the app UI, the PWA manifest and
the icon generator. To build the same product for another client:

## 1. Edit `branding.config.json`

| Field | Used for |
|---|---|
| `appName` | Browser tab title, PWA full name, signup page |
| `shortName` | Header logo text, home-screen icon label, login page |
| `organizationName` | Settings → Organization name |
| `description` | Metadata + manifest description |
| `initials` | Header logo tile and generated app icons (2–3 letters) |
| `images.logo` | Optional header logo image (e.g. `/branding/logo.png`, or a full URL). Empty → the initials tile is shown |
| `images.favicon` | Optional browser-tab icon (e.g. `/branding/favicon.png`). Empty → the generated initials icons are used |
| `colors.primary` / `primaryDark` | Icon tile gradient |
| `colors.themeColor` | Browser/PWA theme color (address bar, splash) |
| `colors.background` | PWA splash background |
| `basePath` | URL mount point (e.g. `/HRportal`, `/AcmeHR`) — also update the IIS `web.config` rewrite if changed |

## 2. Regenerate the icons

```bash
npm run generate-icons
```

Renders the initials on the gradient tile into `public/icons/` (favicon 192/512,
maskable, apple-touch-icon). **If the client has real logo artwork:**

- Put the files under `public/branding/` (e.g. `logo.png`, `favicon.png`) and
  set `images.logo` / `images.favicon` in the config — the header and browser
  tab use them automatically, falling back to the initials icons when empty.
- For the PWA/home-screen icons, drop their PNGs into `public/icons/` using the
  same four filenames: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`,
  `apple-touch-icon.png` (and skip the generator).

## 3. Rebuild

```bash
npm run build
```

`NEXT_PUBLIC_*` env values and the branding are baked at build time — each
client gets their own build with their own `.env.local` (their Supabase
project) and their own `branding.config.json`.

## What is NOT covered by this config

- **In-app accent colors** (Tailwind `blue-600` classes throughout the UI) —
  the interface stays blue regardless of icon colors. Making the full UI
  palette configurable is a larger CSS-variable refactor.
- **Company records** inside the app (companies table) — those are data,
  managed in the UI, and unrelated to product branding.
- **Email sender/branding** for welcome emails (configured with the email
  provider, when enabled).
