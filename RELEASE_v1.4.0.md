# GulfZone HR — Release v1.4.0

**Commit:** `aaad7f8` (main) · **Tag:** `v1.4.0` · **Date:** 2026-07-09
**Upgrades from:** the previous client release (`467f6e8`)

This is the one-page runbook for deploying v1.4.0 to the client Windows server.
Full procedure: [`deploy/windows/UPGRADE_PROCEDURE.md`](deploy/windows/UPGRADE_PROCEDURE.md).
First-time install instead: [`deploy/windows/WINDOWS_DEPLOYMENT.md`](deploy/windows/WINDOWS_DEPLOYMENT.md).

---

## What's new since 467f6e8

- **PWA install** — "Add to Home Screen" on iPhone/Android (app icon, standalone window).
- **Mobile fixes** — sidebar no longer covers the screen, no horizontal overflow, headers/grids/tables reflow correctly on phones.
- **White-label branding** — app name, logo, favicon, colours driven by `branding.config.json` (see [`BRANDING.md`](BRANDING.md)).
- **Per-company branding** — each company can show its own logo + colour on the header, sidebar and payslips. Set via **Companies → edit → Company Logo** (uploads, auto-compressed to a 512×512 PNG, path written to the config).
- **Global leave types** — leave types are shared across all companies (de-duplicated); requires migration 027.
- **PDC "Due (10d)" dashboard tile** — counts pending post-dated cheques due within 10 days; clicks through to the PDC page.
- **Performance pass** — memoized table lookups, trimmed over-fetching, deduplicated Supabase clients.
- **Fixes** — grade configuration works across companies, "Failed to load companies" cold-load race resolved, and more.

## Deployment steps (side-by-side, ~10s downtime, 30s rollback)

### Phase 0 — Pre-flight
1. `pm2 list` — confirm `gulfzone-hr` is online; note the current folder (e.g. `C:\apps\GulfZoneHR`).
2. Back up `.env.local` from that folder.
3. Confirm a recent client Supabase backup exists.

### Phase 1 — Database (zero downtime, do first)
Run **ONLY** this in the **client** Supabase SQL editor:

```
deploy/client_upgrade_027.sql          (global leave types — the only new migration)
```

Verify it succeeds:
```sql
select count(*) from leave_types;      -- should return without error
```

> ⚠️ Do **NOT** run `deploy/gulfzone_hr_deployment.sql` on the live DB — its seed
> sections are for a fresh database only and fail with duplicate-key errors.
> There is **no migration 028** to run — company branding is file/JSON-based.

### Phase 2 — Build the new version in a NEW folder (old keeps serving)
```bat
:: download https://github.com/jasimmahamoodkm/gulfzonehr/archive/refs/heads/main.zip
:: extract to C:\apps\GulfZoneHR-vNext   (do NOT overwrite the running folder)
copy C:\apps\GulfZoneHR\.env.local  C:\apps\GulfZoneHR-vNext\.env.local
cd C:\apps\GulfZoneHR-vNext
npm ci
set ALLOW_PROD_DB=YES_I_AM_THE_PRODUCTION_SERVER
npm run build
```
`.env.local` must contain the client Supabase keys **and**
`ALLOW_PROD_DB=YES_I_AM_THE_PRODUCTION_SERVER` (the build guard blocks otherwise).
❌ If the build fails, stop — users are still on the old version.

### Phase 3 — Switch over (~10s)
```bat
pm2 delete gulfzone-hr
cd C:\apps\GulfZoneHR-vNext
pm2 start deploy\windows\ecosystem.config.js
pm2 save
```

### Phase 4 — Smoke test
- Log in → dashboard shows all 6 tiles incl. **PDC Due (10d)**.
- Switch companies → header/sidebar logos and data follow.
- Open a **payslip** → company logo + details render.
- **Reports** → generate + Export CSV.
- Companies, Employees, Payroll, Documents/PDC, Leaves load with no error.
- `pm2 logs gulfzone-hr --lines 50` → no errors.
- **Hard-refresh once** (Ctrl+Shift+R) to clear cached bundles from the old build.

### Phase 5 — Rollback (if needed, ~30s)
```bat
pm2 delete gulfzone-hr
cd C:\apps\GulfZoneHR          :: the untouched previous folder
pm2 start deploy\windows\ecosystem.config.js
pm2 save
```
Leave the database as-is — migration 027 is additive and the old version ignores it.

## Notes
- **Branding assets** (app logo, favicon, GulfZone/ALMANAR logos) are committed
  under `public/branding/` — the build is self-contained.
- **Company logos uploaded later** on the server write to
  `public/branding/companies/` and update `branding.config.json`; to keep them
  across future side-by-side deploys, copy `public/branding/` into the new
  release folder (or commit the files).
- **Auto-start after reboot**: `pm2-windows-startup` fires at user **logon**, not
  boot. For unattended reboots, add a Task Scheduler "At startup" job running
  `pm2 resurrect`.
