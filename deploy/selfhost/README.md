# Self-hosted Supabase — local trial (Mac mini)

Run the **exact same Supabase stack** (Postgres + Auth + REST + Storage) on your
Mac, at $0, and point the app at it. **No app code changes** — only env vars.
Prove it here, then repeat on the client Windows PC.

Everything below is a one-time setup. Budget ~30–45 min (mostly image downloads).

---

## 0. Prerequisites
- **Docker** running on the Mac. Free options: **OrbStack** (lightest on Apple
  Silicon) or **Colima** (`brew install colima docker docker-compose`).
- **Give the VM enough resources** — the Supabase stack is ~10 containers and
  needs ≥4 GB RAM (2 GB will OOM). On Colima:
  ```bash
  colima stop 2>/dev/null; colima start --cpu 4 --memory 8
  ```
- **Compose command:** if `docker compose version` errors, you have the
  standalone binary — use **`docker-compose`** (hyphen) everywhere below instead
  of `docker compose` (space).
- `git`, `node` (already have). `psql` is optional — the steps use the DB
  container's psql.

## 1. Get the Supabase docker stack
```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

## 2. Generate secrets and put them in `.env`
From the GulfZone repo:
```bash
node deploy/selfhost/gen-keys.mjs
```
Copy the printed `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` into `supabase/docker/.env`
(replace the defaults). Also set a strong `POSTGRES_PASSWORD` there. Leave the
default ports (API gateway on **8000**, Postgres on **5432**).

> Change `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` too — that's the Studio login.

## 3. Start the stack
```bash
docker-compose up -d      # (or `docker compose up -d` if you have the plugin)
docker-compose ps         # wait until all services are "healthy"
```
First run pulls ~1–2 GB of images.
Studio (admin UI) is now at **http://localhost:8000** (Postgres at `localhost:5432`).

## 4. Load the schema + seed
The **full deployment SQL** is for a fresh DB — perfect here (creates all tables,
the 117 RLS policies, helper functions, storage bucket, and seed data):
```bash
# from the GulfZone repo root; uses the container's psql
docker exec -i supabase-db psql -U postgres -d postgres \
  < deploy/gulfzone_hr_deployment.sql
```
(Container name may differ — check `docker-compose ps`; it's the `db` service.)

## 4b. Grant the API roles access (REQUIRED on self-hosted)
The cloud does this automatically; a self-hosted stack does not — without it the
app fails with `permission denied for function get_my_company_id`.
```bash
docker exec -i supabase-db psql -U postgres -d postgres < deploy/selfhost/grants.sql
```

## 5. Create a Super Admin login
A fresh stack has no auth users yet. Create one and wire it to a company:
```bash
# from the GulfZone repo root
SERVICE_ROLE_KEY='<service key from step 2>' \
  node deploy/selfhost/seed-login.mjs
```
Prints an email + password to log in with (default `admin@local.test` / `Admin@12345`).

## 6. Point the app at local Supabase
In the GulfZone repo, edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from step 2>
SUPABASE_SERVICE_ROLE_KEY=<service key from step 2>
```
Then:
```bash
npm run dev     # the guard only blocks the CLIENT cloud ref, localhost is fine
```
Open http://localhost:3000/HRportal and log in with the step-5 credentials.

## 7. What to verify
Everything should work unchanged: login, dashboard tiles, company switch,
employees, grades + salary/benefit config, payroll + payslip, leaves, documents,
PDC, reports export, RBAC. This confirms the whole stack (data + auth + RLS)
runs locally.

---

## Moving your real cloud data in (optional, when ready)
Instead of the seed, migrate the actual data:
```bash
# from the cloud project (get the connection string from Supabase → Settings → Database)
pg_dump "postgresql://postgres:[PW]@db.zmucqoeihukhmotzxrgs.supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges -f public.sql
pg_dump "…same…" --schema=auth --no-owner --no-privileges -f auth.sql   # preserves logins + bcrypt passwords

# into local (schema first via step 4 with a data-less schema, or restore both dumps)
docker exec -i supabase-db psql -U postgres -d postgres < auth.sql
docker exec -i supabase-db psql -U postgres -d postgres < public.sql
```
Restoring `auth.sql` brings real users **with their existing passwords**, so no
password resets. (For the trial, the seed + step 5 is simpler.)

## Backups (own your data)
```bash
docker exec supabase-db pg_dump -U postgres postgres > backup_$(date +%F).sql
```
Schedule that nightly (cron on Mac, Task Scheduler on the client Windows PC).

## Teardown
```bash
cd supabase/docker && docker-compose down         # keep data
docker-compose down -v                            # delete data volumes too
```

## Notes for the client Windows PC (later)
- Same steps; Docker via **WSL2 + Docker Engine** (free, no Docker Desktop licence).
- Keep the Postgres data volume + nightly `pg_dump` **outside** the side-by-side
  app folders so it survives app upgrades.
- The app's `.env.local` points at the local stack; `ALLOW_PROD_DB` is no longer
  needed because you're not touching the old cloud project.
