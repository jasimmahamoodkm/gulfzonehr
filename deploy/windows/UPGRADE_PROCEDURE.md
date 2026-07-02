# GulfZone HR — Upgrade Procedure (with rollback)

Use this when a **previous version is already running** on the Windows server.
For a first-time install, use `WINDOWS_DEPLOYMENT.md` instead.

**Strategy:** side-by-side (blue/green) folders. The new version is built in a
*new* folder while the old version keeps serving users. Switching and rolling
back are both PM2 pointer changes taking seconds.

**Why the database never needs rollback:** all schema changes in this line of
releases are *additive* (new tables, new nullable columns, widened check
constraints). The old app version never reads or writes any of them, so it runs
unchanged against the upgraded schema. Rollback = switch the app folder back;
leave the database alone.

> ⚠️ Do **not** use `deploy.bat` for upgrades — it rebuilds **in place**, which
> destroys your fallback copy. Use the steps below.

---

## Phase 0 — Pre-flight (old version keeps running)

```bat
pm2 list
```
1. Confirm `gulfzone-hr` is **online**; note the current app folder
   (e.g. `C:\apps\GulfZoneHR`).
2. Open the app in a browser and confirm it works — this is the
   "known good" baseline.
3. Copy `.env.local` from the current folder to a safe location
   (it is the only file not in git).
4. Supabase Dashboard → **Database → Backups**: confirm a backup from today
   exists (precaution only; the procedure never modifies existing data).

## Phase 1 — Database update (zero downtime — do this first)

5. In the **client** Supabase **SQL Editor**, run **section 13
   ("FEATURE MIGRATIONS")** from `deploy/gulfzone_hr_deployment.sql`.
   It is **idempotent** — objects that already exist are skipped, so it is
   always safe to run the whole section.
6. Verify (all three must succeed; 0 rows is fine):

```sql
select count(*) from grade_change_requests;
select count(*) from pdc_cheques;
select archived_at from employees limit 1;
```

The old app is still serving users, unaffected — these objects are invisible
to it.

## Phase 2 — Build the new version side-by-side (old app still running)

7. Download the release and extract to a **new versioned folder** —
   never overwrite the running folder:

```
https://github.com/jasimmahamoodkm/gulfzonehr/archive/refs/heads/main.zip
→ extract to C:\apps\GulfZoneHR-vNEXT   (pick a version name, e.g. -v2, -v3…)
```

8. Copy `.env.local` from the old folder into the new folder.
   **It must be present before the build** — `NEXT_PUBLIC_*` values are baked
   in at build time. It must contain the client Supabase keys **and**
   `ALLOW_PROD_DB=YES_I_AM_THE_PRODUCTION_SERVER` (the guard blocks the build
   without it).
9. Build:

```bat
cd C:\apps\GulfZoneHR-vNEXT
npm ci
npm run build
```

❌ **If the build fails: STOP.** Nothing has changed for users — the old
version is still live. Fix and retry; do not proceed to Phase 3.

## Phase 3 — Switch over (~10 seconds of downtime)

```bat
pm2 delete gulfzone-hr
cd C:\apps\GulfZoneHR-vNEXT
pm2 start deploy\windows\ecosystem.config.js
pm2 save
```

IIS keeps proxying to `localhost:3000` — no IIS changes are needed.

## Phase 4 — Smoke test (~10 minutes)

- Login → dashboard: stat tiles show real numbers; clicking a tile opens its
  detail page (e.g. *Docs Expired* → Documents with the Expired tab active)
- Switch companies in the header → grades / employees / dashboard follow
- Employees: open a detail page (journey chart + change history render);
  Archive an employee → banner appears → Reactivate
- Raise a promotion request; approve it from a **second** HR account
  (self-approval is blocked by design)
- Documents → **PDC Cheques** tab: add a cheque, change its status
- Reports: generate each report, use a custom date range, **Export CSV**
- Logout → login as a normal employee → restricted navigation only
- `pm2 logs gulfzone-hr --lines 50` → no errors

## Phase 5 — ROLLBACK (if anything is wrong — ~30 seconds)

```bat
pm2 delete gulfzone-hr
cd C:\apps\GulfZoneHR          :: the untouched previous folder
pm2 start deploy\windows\ecosystem.config.js
pm2 save
```

You are back on the previous version exactly as it was.

- **Leave the database as-is.** The new tables/columns sit unused and harmless.
- Data written by new features during the failed attempt (promotion requests,
  archived flags, PDC cheques) is preserved in the database but not shown by
  the old UI — it reappears when you retry the upgrade.

## Phase 6 — Cleanup (after ~1 week stable)

- Delete or archive the previous version's folder.
- Keep this versioned-folder pattern for every future release — it is what
  makes rollback a 30-second operation.

---

## Quick reference

| Situation | Action |
|---|---|
| Build fails in Phase 2 | Nothing to undo — old app never stopped |
| Smoke test fails in Phase 4 | Phase 5 rollback (~30 s), DB untouched |
| Discovered a problem days later | Phase 5 rollback still works while the old folder exists |
| Old UI after rollback missing new-feature data | Expected — data is safe in the DB, hidden until you retry |
