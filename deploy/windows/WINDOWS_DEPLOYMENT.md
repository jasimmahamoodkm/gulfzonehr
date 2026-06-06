# GulfZone HR — Windows Server Deployment Runbook

Hosting the GulfZone HR application (Next.js + cloud Supabase) on a Windows Server.

## Architecture

```
Internet ──HTTPS:443──▶ IIS (SSL, domain, reverse proxy)
                          │  /HRportal/*  ─▶  http://localhost:3000  (Next.js via PM2)
                          │                          │
                          │                          └──HTTPS──▶ Supabase (cloud DB/Auth/Storage)
```

- The database, authentication, and file storage all stay in **cloud Supabase**.
- The Windows Server only runs the Next.js Node process and IIS in front of it.

---

## Prerequisites (install once)

| Component | Source | Notes |
|-----------|--------|-------|
| Node.js LTS v20+ | https://nodejs.org (Windows MSI) | Includes npm |
| IIS | Windows "Turn Windows features on/off" | Web Server role |
| URL Rewrite 2.1 | https://www.iis.net/downloads/microsoft/url-rewrite | IIS module |
| Application Request Routing (ARR) | https://www.iis.net/downloads/microsoft/application-request-routing | Enables reverse proxy |
| SSL certificate | Your CA / Let's Encrypt (win-acme) | Bound to the IIS site |

After installing ARR: **IIS Manager → server node → Application Request Routing Cache → Server Proxy Settings → tick "Enable proxy" → Apply.**

---

## Step 1 — Copy the application

1. Copy the project to `C:\apps\GulfZoneHR`.
2. Confirm `package.json` and `next.config.js` are in that folder.

## Step 2 — Configure environment variables

1. Copy `deploy\windows\.env.local.example` to `.env.local` **at the project root**.
2. Fill in the real Supabase values (URL, anon key, service role key) and the production domain in `NEXT_PUBLIC_APP_URL`.

> `NEXT_PUBLIC_*` values are compiled into the build — set them **before** building.

## Step 3 — Install PM2 (process manager / Windows auto-start)

```cmd
npm install -g pm2 pm2-windows-startup
pm2-startup install
```

## Step 4 — Build & start

From the project root:

```cmd
cd C:\apps\GulfZoneHR
deploy\windows\deploy.bat
```

This runs `npm ci`, `npm run build`, and starts the app under PM2. Verify:

```cmd
pm2 status
```

The app now listens on `http://localhost:3000/HRportal`.

## Step 5 — Configure IIS reverse proxy

1. Create (or pick) an IIS site bound to your domain on **port 443** with the SSL certificate.
2. Copy `deploy\windows\web.config` to that site's root (e.g. `C:\inetpub\wwwroot\web.config`).
3. In **IIS Manager → URL Rewrite → View Server Variables**, add `HTTP_X_FORWARDED_HOST` and `HTTP_X_FORWARDED_PROTO` to the allowed list (the `web.config` sets them).
4. Restart the site.

The app is now public at: **`https://hr.clientdomain.com/HRportal`**

## Step 6 — Firewall

- Inbound: allow **TCP 443** (and **80** for the HTTP→HTTPS redirect).
- Outbound: allow **TCP 443** so the server can reach Supabase.
- Do **not** expose port 3000 publicly — only IIS talks to it locally.

## Step 7 — Recreate Auth users (one-time, if fresh Supabase)

If you deployed a fresh Supabase project using `deploy/gulfzone_hr_deployment.sql`, recreate the login accounts (the SQL seeds `public.users` but cannot create Auth passwords):
- Use the app's **Admin → Employees → Add Employee** flow, or
- Supabase Dashboard → Authentication → Add user (same email; ideally same UUID).
- Enable **Auth → Providers → Leaked password protection**.

---

## Day-2 operations

| Task | Command |
|------|---------|
| Check status | `pm2 status` |
| View live logs | `pm2 logs gulfzone-hr` |
| Restart app | `pm2 restart gulfzone-hr` |
| Stop app | `pm2 stop gulfzone-hr` |
| Deploy an update | copy new files → `deploy\windows\deploy.bat` |
| After server reboot | PM2 auto-starts the app (pm2-windows-startup) |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| 502 / 504 from IIS | Node not running, or ARR proxy disabled | `pm2 status`; enable ARR proxy |
| Blank page / assets 404 | `basePath` mismatch | URL must include `/HRportal`; rebuild after env change |
| Login fails / session drops | Site not served over HTTPS | Bind SSL; force HTTPS (web.config rule 1) |
| "supabaseUrl is required" | Missing/!built env vars | Check `.env.local`, then `npm run build` again |
| Works on localhost:3000 but not via domain | IIS rewrite/ARR not configured | Re-check Step 5 |

## Alternative: NSSM instead of PM2
If you prefer a native Windows service over PM2:
```cmd
nssm install GulfZoneHR "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next start -p 3000"
nssm set GulfZoneHR AppDirectory C:\apps\GulfZoneHR
nssm start GulfZoneHR
```
