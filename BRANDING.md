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

## Recommended image sizes

| Image | Optimum | Notes |
|---|---|---|
| `images.logo` | **120px tall** PNG (transparent) or SVG | Header renders it at 40px — 3× keeps it crisp on Retina. Width free (typ. 120–480px, ratio ≤ 4:1), no padding in the artwork |
| `images.favicon` | **512×512** square PNG (min 256×256) | Browsers scale down to 16–32px — use a bold, simple mark, not a wordmark |
| `public/icons/icon-192.png` | 192×192 | Android home screen |
| `public/icons/icon-512.png` | 512×512 | Install/splash |
| `public/icons/icon-512-maskable.png` | 512×512, mark inside central ~66% | Full-bleed background; Android crops to circle/squircle |
| `public/icons/apple-touch-icon.png` | 180×180 full-bleed | iOS rounds the corners itself |

Keep logos < 50 KB and icons < 100 KB.

## 3. Rebuild

```bash
npm run build
```

`NEXT_PUBLIC_*` env values and the branding are baked at build time — each
client gets their own build with their own `.env.local` (their Supabase
project) and their own `branding.config.json`.

## Per-company branding (logo + colour)

For a deployment that manages **multiple companies**, each company can show its
own logo and brand colour — configured in the **same JSON file**, under
`companyBranding`, keyed by the company's name (case-insensitive):

```json
"companyBranding": {
  "GulfZone": { "logo": "/branding/gulfzone.png", "color": "#1D4ED8" },
  "ALMANAR":  { "logo": "https://cdn.example.com/almanar.svg", "color": "#059669" }
}
```

- `logo` — a public path (`/branding/…`, gets the basePath), a full `https://`
  URL, or a `data:` URI. Empty → falls back to the app logo, then an initials
  tile tinted with `color`.
- `color` — hex; used as the payslip header band and the header initials-tile
  tint for that company.

Where it shows: the **app header** and **sidebar** when that company is
selected, and the **payslip** header (logo + colour band).

### Uploading a company logo from the UI (recommended)

**Companies → edit a company → Company Logo → choose a file.** The image is
sent to `POST /api/admin/company-logo`, which **compresses it to a 512×512 PNG**
(aspect preserved with transparent letterboxing), saves it to
`public/branding/companies/<slug>.png`, and writes that path into
`branding.config.json → companyBranding[<company>].logo` automatically.

- The saved PNG is served immediately at `/<basePath>/branding/companies/<slug>.png`.
- In **dev**, the header/sidebar update on the next reload (the JSON is
  re-read). In **production** the config is baked at build time, so a *new*
  logo path takes effect on the next `npm run build`; re-uploading over an
  existing company reuses the same path, so only the image bytes change.
- Persisting across side-by-side deploys: commit the updated
  `branding.config.json` **and** `public/branding/companies/*.png`, or copy
  `public/branding/` into the new release folder.

You can also set `logo`/`color` by hand (path, `https://` URL, or `data:` URI)
instead of uploading. For **payslips**, prefer an uploaded file or a public URL,
since payslips open in a separate print window without app authentication.

## What is NOT covered by this config

- **In-app accent colors** (Tailwind `blue-600` classes throughout the UI) —
  the interface stays blue regardless of icon colors. Making the full UI
  palette configurable is a larger CSS-variable refactor.
- **Company records** inside the app (companies table) — those are data,
  managed in the UI, and unrelated to product branding.
- **Email sender/branding** for welcome emails (configured with the email
  provider, when enabled).
