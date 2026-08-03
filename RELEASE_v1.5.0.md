# HR Management System — Release v1.5.0

**Tag:** `v1.5.0` · **Upgrades from:** v1.4.0

One-page runbook for deploying this release. Full procedure:
[`deploy/windows/UPGRADE_PROCEDURE.md`](deploy/windows/UPGRADE_PROCEDURE.md).

---

## What's new since v1.4.0

**Payroll**
- **Extra Adjustments** — add any number of one-off **add / deduct** lines when
  processing payroll, each with a short description. Net pay updates live; every
  line appears on the payslip (screen and printed) and in the payroll totals.
- The old free-form **"Other Deductions"** field is gone — an adjustment does the
  same job with a description. Existing records still display their old value.
- **Delete** now removes the row immediately, reports failures, and rolls back if
  the delete didn't happen (previously it could look unchanged until a refresh).

**Mobile / UI**
- Fixed the leave-request date pickers breaking out of the frame on phones; the
  calendar is now clamped to the screen (applies to every date field in the app).
- Dropdown lists now match the width of their box instead of the OS's smaller
  popup — leave, payroll, attendance, documents and PDC forms.
- Wider leave-request modal with larger Employee / Leave Type fields.
- Consistent select sizing app-wide (42px, 16px text — also stops iOS zooming).
- Settings tab bar no longer overflows on narrow screens.

**Branding** — neutral product naming ("HR Management System" / "HR Portal").

## Deploying to an EXISTING client (upgrading from v1.4.0)

### 1. Database — run these in the client's SQL editor, in order
```
deploy/client_upgrade_028_payroll_adjustment.sql
deploy/client_upgrade_029_payroll_adjustments.sql
```
Both are idempotent. The 029 script ends with `NOTIFY pgrst, 'reload schema';`
— **this matters**: after adding columns the API caches the old schema, and
payroll queries fail until it is refreshed.

Verify:
```sql
select column_name from information_schema.columns
where table_name = 'payroll' and column_name like 'adjust%';
-- expect: adjustment, adjustment_note, adjustments
```

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
- Process a payroll run with **two adjustments** (one add, one deduct) → check
  net pay, then open the payslip and Print/Save PDF.
- Delete a payroll record → the row should disappear immediately.
- On a phone: open a leave request, use both date pickers and both dropdowns.
- Dashboard tiles, company switch, reports export, documents/PDC.
- **Hard-refresh once** (Ctrl+Shift+R) to clear cached bundles.

### 4. Rollback (~30 s)
Point PM2 back at the previous folder. Leave the database alone — the new
columns are additive and the old build ignores them.

## Deploying for a NEW client

Use the single setup script — no migrations to chase:

**[`deploy/NEW_CLIENT_SETUP.sql`](deploy/NEW_CLIENT_SETUP.sql)** → paste into the
SQL Editor of a brand-new Supabase project and run once. It creates all tables,
indexes, RLS policies and helper functions, the documents storage bucket, and
the reference data (roles, modules, permissions, leave types) — but no companies
or employees. Its header has copy-paste SQL for creating the first company and
Super Admin, and the `.env.local` values to set.

Then follow [`deploy/windows/WINDOWS_DEPLOYMENT.md`](deploy/windows/WINDOWS_DEPLOYMENT.md)
for the first-time server install, and [`BRANDING.md`](BRANDING.md) to set the
client's name, logo and colours.

## Self-hosting the database (optional, $0)

To keep the database on the client's own machine instead of the Supabase cloud,
see [`deploy/selfhost/WINDOWS_CLIENT_SELFHOST.md`](deploy/selfhost/WINDOWS_CLIENT_SELFHOST.md)
— WSL2 + Docker Engine, data migration, and the IIS HTTPS reverse-proxy step
(the browser talks to Supabase directly, so it must be reachable over HTTPS).
