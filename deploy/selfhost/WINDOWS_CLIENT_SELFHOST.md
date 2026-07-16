# Self-hosting Supabase on the CLIENT Windows PC — step by step

Moves the database in-house (no cloud, $0) while the app keeps running.
Validated end-to-end on a Mac first (see `README.md`); this is the Windows
production version.

> **Read §1 first.** The client setup differs from the local trial in one
> critical way — the *browser* must reach Supabase, not just the server.

---

## 1. ⚠️ The critical difference: the browser talks to Supabase

This app queries Supabase **from the browser** (`supabase.from(...)` in React).
So `NEXT_PUBLIC_SUPABASE_URL` is resolved by **each user's browser**, not the
server.

- `http://localhost:8000` works on a single machine (the Mac trial) — it will
  **fail for every other user** on the client network (their `localhost` is
  their own PC).
- The app is served over **HTTPS**, so Supabase must also be **HTTPS** —
  a browser will **block** `http://<server-ip>:8000` as mixed content.

**Solution: reverse-proxy Supabase through the existing IIS site + certificate.**

```
Browser ──HTTPS──> IIS (hr.clientdomain.com:443)
                     ├── /HRportal/*  → http://localhost:3000   (Next.js via PM2)   [existing]
                     └── /supabase/*  → http://localhost:8000   (Supabase Kong)     [new]
```
and set `NEXT_PUBLIC_SUPABASE_URL=https://hr.clientdomain.com/supabase`.

*(Alternative: a `db.clientdomain.com` subdomain proxied to `localhost:8000` —
cleaner paths, but needs another DNS record + certificate.)*

## 2. Prerequisites
- Windows Server 2019/2022 or Win10/11 **Pro** — x64.
- **16 GB RAM** (8 GB usable for the stack) and **100 GB free disk**.
- Admin rights; virtualization enabled in BIOS.
- IIS with **URL Rewrite** + **ARR** (already installed for the app proxy).
- Keep the cloud project **alive** until the cutover is signed off (rollback).

## 3. Install Docker — free (WSL2 + Docker Engine, no Docker Desktop licence)
In an **elevated PowerShell**:
```powershell
wsl --install -d Ubuntu        # reboot if prompted
wsl --set-default-version 2
wsl --status                   # confirm version 2
```
Then inside Ubuntu (`wsl`):
```bash
sudo apt update && sudo apt install -y ca-certificates curl gnupg git
curl -fsSL https://get.docker.com | sudo sh          # Docker Engine (free)
sudo usermod -aG docker $USER && newgrp docker
sudo service docker start
docker run --rm hello-world                          # verify
```
Install Node (for the helper scripts):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
```

> **Critical:** keep everything in the **WSL2 Linux filesystem** (`~/…`).
> Never put the stack or Postgres data under `/mnt/c/...` — the Windows↔WSL
> bridge is slow and will cripple Postgres.

## 4. Bring up the Supabase stack (inside WSL2)
```bash
cd ~ && git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker && cp .env.example .env
```
Generate secrets (from a copy of the app repo, or copy `gen-keys.mjs` over):
```bash
node gen-keys.mjs
```
Edit `.env` and set:
- `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` — from the generator (must be one matched set)
- `POSTGRES_PASSWORD` — **strong, not the default**
- `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` — **strong, not the default**
- `SITE_URL=https://hr.clientdomain.com/HRportal`
- `API_EXTERNAL_URL=https://hr.clientdomain.com/supabase`

```bash
docker compose pull        # (or docker-compose, if that's what you have)
docker compose up -d
docker compose ps          # all services "healthy"
```

## 5. Migrate the REAL data from the client cloud project
Get the **Session pooler** connection string: Supabase → Project Settings →
Database → Connection string → **Session pooler** (the *Direct* one is IPv6-only
and won't resolve from the container).

```bash
# password separately, so special chars like @ don't break a URL
export PGPASSWORD='<client DB password>'
CONN="host=aws-0-<region>.pooler.supabase.com port=5432 user=postgres.<client-ref> dbname=postgres sslmode=require"

# 1. public schema — STRUCTURE + DATA together (this also brings all RLS
#    policies & functions, and avoids the schema-drift problem)
docker exec -e PGPASSWORD="$PGPASSWORD" supabase-db \
  pg_dump "$CONN" --schema=public --no-owner --no-privileges > ~/prod_public.sql

# 2. auth users + identities (data only) — preserves real passwords
docker exec -e PGPASSWORD="$PGPASSWORD" supabase-db \
  pg_dump "$CONN" --data-only --no-owner --no-privileges \
  --table=auth.users --table=auth.identities > ~/prod_auth.sql

# 3. load into the local stack (fresh public schema, FK checks deferred)
docker exec -i supabase-db psql -U postgres -d postgres -c \
  "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
cat ~/prod_public.sql | docker exec -i supabase-db psql -U postgres -d postgres
{ echo "SET session_replication_role=replica;"; cat ~/prod_auth.sql; } \
  | docker exec -i supabase-db psql -U postgres -d postgres

# 4. grants — REQUIRED on self-hosted (cloud does this automatically)
cat grants.sql | docker exec -i supabase-db psql -U postgres -d postgres

# 5. verify
docker exec -i supabase-db psql -U postgres -d postgres -c \
 "select 'companies',count(*) from public.companies
  union all select 'employees',count(*) from public.employees
  union all select 'auth.users',count(*) from auth.users;"

rm -f ~/prod_public.sql ~/prod_auth.sql   # contain password hashes
```
> Without step 4 the app fails with `permission denied for function get_my_company_id`.

**Storage files** (uploaded documents) live in the cloud bucket, not the DB.
If the client has documents, download them from the cloud Storage bucket and
re-upload to the local one (Studio → Storage), or via the Storage API.

## 6. Expose Supabase through IIS (HTTPS)
In IIS Manager on the existing site, add a **URL Rewrite** inbound rule
*above* the `/HRportal` rule:

- **Pattern:** `^supabase/(.*)`
- **Action:** Rewrite → `http://localhost:8000/{R:1}`
- Enable **ARR proxy** (Application Request Routing → Server Proxy Settings →
  Enable proxy).

Verify from the server browser: `https://hr.clientdomain.com/supabase/auth/v1/health`
should return JSON.

## 7. Repoint the app
Edit `.env.local` in the app folder (Windows side):
```
NEXT_PUBLIC_SUPABASE_URL=https://hr.clientdomain.com/supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from step 4>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from step 4>
```
`ALLOW_PROD_DB` is no longer needed (the guard only blocks the cloud ref).
Then, **side-by-side** (per `deploy/windows/UPGRADE_PROCEDURE.md`):
```bat
cd C:\apps\GulfZoneHR-vNext
npm ci
npm run build
pm2 delete gulfzone-hr
pm2 start deploy\windows\ecosystem.config.js
pm2 save
```

## 8. Verify (from a DIFFERENT PC on the network — not the server)
This is the test that matters: it proves the browser can reach Supabase.
- Log in with a **real** user + their **real** password.
- Dashboard tiles, company switch, employees, payroll + payslip, reports export,
  documents/PDC, RBAC.
- Browser DevTools → Network: calls go to `https://hr.clientdomain.com/supabase/...`
  and return 200 (no `localhost`, no mixed-content warnings).

## 9. Autostart on reboot (WSL2 does NOT start by default)
Create a Task Scheduler task: **At startup**, *Run whether user is logged on or
not*, highest privileges:
```
Program:   C:\Windows\System32\wsl.exe
Arguments: -d Ubuntu -u root -e sh -c "service docker start && cd /home/<user>/supabase/docker && docker compose up -d"
```
Also ensure the containers have `restart: unless-stopped` (the Supabase compose
sets this) and PM2 resurrects (see `UPGRADE_PROCEDURE.md`).

## 10. Backups (now your responsibility — no cloud safety net)
Nightly, inside WSL2:
```bash
docker exec supabase-db pg_dump -U postgres -Fc postgres > ~/backups/db_$(date +%F).dump
tar czf ~/backups/storage_$(date +%F).tar.gz -C ~/supabase/docker/volumes storage
```
Schedule via Task Scheduler (`wsl -d Ubuntu -e bash ~/backup.sh`), keep 7 daily +
4 weekly, and **copy off the machine** (network share / USB / cloud).
**Test a restore once** before trusting it.

## 11. Rollback
- **Before cutover:** nothing to undo — the cloud is untouched (read-only dump).
- **Right after cutover:** repoint `.env.local` back to the cloud project,
  rebuild, `pm2 restart`. The cloud still has all data.
- ⚠️ **After users start entering data locally**, rolling back to the cloud
  loses anything written since cutover — you'd have to migrate back. So keep the
  cloud project alive (paused/free) for a couple of weeks, and decommission only
  once the local stack is proven.
