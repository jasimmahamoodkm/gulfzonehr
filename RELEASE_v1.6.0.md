# HR Management System — Release v1.6.0

**Tag:** `v1.6.0` · **Upgrades from:** v1.5.0

One-page runbook for deploying this release. Full procedure:
[`deploy/windows/UPGRADE_PROCEDURE.md`](deploy/windows/UPGRADE_PROCEDURE.md).

---

## What's new since v1.5.0

**Themes**
- Settings → Profile Settings now has a **Palette** picker: Heritage (default),
  Citrus, Slate, Sky, and Grove, plus Light / Dark / System appearance.
- The choice is stored in this browser (localStorage + cookie) so it survives
  logout and comes back on the next sign-in. It is not stored on the user
  record, so each workstation keeps its own palette.
- UI components use semantic tokens (`bg-primary`, `text-foreground`, etc.)
  so every page follows the selected palette.

**Stability / production polish**
- Auth, company loading, dashboards, and toasts no longer update state after
  you leave the page (timers and in-flight fetches are cancelled).
- Modals close with Escape, lock background scroll, and return focus.
- Logout no longer hardcodes a production Supabase auth key; it uses the app
  base path and clears all `sb-` session keys.
- `/` redirects to the role home instead of flashing placeholder dashboard
  numbers.

## Deploying to an EXISTING client (upgrading from v1.5.0)

### 1. Database — none
This release is application-only. Do **not** run any new SQL.

### 2. Application — side-by-side, per `UPGRADE_PROCEDURE.md`
```bat
:: extract the new release to a NEW folder (never overwrite the running one)
copy C:\apps\HRPortal\.env.local  C:\apps\HRPortal-vNext\.env.local
cd C:\apps\HRPortal-vNext
npm ci
set ALLOW_PROD_DB=YES_I_AM_THE_PRODUCTION_SERVER
npm run build
pm2 delete gulfzone-hr
pm2 start deploy\windows\ecosystem.config.js
pm2 save
```

### 3. Smoke test
- Sign in, open **Settings → Profile Settings**, switch palettes and Light/Dark.
  Confirm the sidebar, buttons, and tables follow the palette.
- Log out and sign in again — the same palette should return.
- Open Add Employee (or any modal) and press Escape — it should close.
- Visit `/` (or the site root) — you should land on the real dashboard, not
  fake stats.
- Dashboard tiles, company switch, leave request, payroll list.
- **Hard-refresh once** (Ctrl+Shift+R) to clear cached CSS/JS.

### 4. Rollback (~30 s)
Point PM2 back at the previous folder. No database change to undo.

## Deploying for a NEW client

Use the single setup script — no migrations to chase:

**[`deploy/NEW_CLIENT_SETUP.sql`](deploy/NEW_CLIENT_SETUP.sql)** → paste into the
SQL Editor of a brand-new Supabase project and run once. Then follow
[`deploy/windows/WINDOWS_DEPLOYMENT.md`](deploy/windows/WINDOWS_DEPLOYMENT.md)
and [`BRANDING.md`](BRANDING.md).
