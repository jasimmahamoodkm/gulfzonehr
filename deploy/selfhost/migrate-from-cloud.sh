#!/usr/bin/env bash
# Migrate real data from a Supabase CLOUD project into the local self-hosted
# stack: the whole `public` schema (companies, employees, grades, payroll, …)
# plus `auth` users/identities (so real people log in with their real
# passwords). Runs pg_dump/psql INSIDE the supabase-db container, so you don't
# need Postgres client tools on the host.
#
# Prereqs: local stack up, deployment.sql + grants.sql already loaded.
#
# Usage (get the URL from Supabase → Project Settings → Database →
#   Connection string → "Session pooler", which is IPv4-friendly):
#
#   deploy/selfhost/migrate-from-cloud.sh \
#     'postgresql://postgres.<ref>:<DB-PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres'
#
# ⚠️ DESTRUCTIVE to the LOCAL stack: it truncates the local public tables and
#    auth users, then loads the cloud data. The local DB is disposable, so
#    that's intended — but it is not reversible without re-seeding.
set -euo pipefail

CLOUD="${1:-}"
DB="${DB_CONTAINER:-supabase-db}"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"   # repo root
if [[ -z "$CLOUD" ]]; then
  echo "✖ Pass the cloud DB connection string. See the header of this script." >&2
  exit 1
fi

psql_local() { docker exec -i "$DB" psql -U postgres -d postgres "$@"; }

echo "▶ Sanity: cloud reachable + local schema present…"
docker exec "$DB" psql "$CLOUD" -t -c "select 'cloud ok: '||count(*)||' employees' from public.employees;"
psql_local -t -c "select 'local schema ok: '||count(*)||' tables' from pg_tables where schemaname='public';"

read -r -p "This will REPLACE all local public + auth.users data with the cloud's. Continue? [y/N] " ok
[[ "$ok" == "y" || "$ok" == "Y" ]] || { echo "aborted."; exit 0; }

echo "▶ 1/5 Dumping cloud public data…"
docker exec "$DB" pg_dump "$CLOUD" --data-only --schema=public --no-owner --no-privileges \
  > /tmp/mig_public.sql

echo "▶ 2/5 Dumping cloud auth users + identities…"
docker exec "$DB" pg_dump "$CLOUD" --data-only --no-owner --no-privileges \
  --table=auth.users --table=auth.identities > /tmp/mig_auth.sql

echo "▶ 3/5 Clearing local seed data…"
psql_local <<'SQL'
SET session_replication_role = replica;
TRUNCATE auth.identities, auth.users CASCADE;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', r.tablename);
  END LOOP;
END $$;
SQL

echo "▶ 4/5 Loading cloud data (FK checks deferred)…"
# Prepend session_replication_role=replica so FK/trigger order never blocks the load.
{ echo "SET session_replication_role = replica;"; cat /tmp/mig_auth.sql;   } | psql_local --set=ON_ERROR_STOP=0 2>&1 | grep -iE "error" | head -20 || true
{ echo "SET session_replication_role = replica;"; cat /tmp/mig_public.sql; } | psql_local --set=ON_ERROR_STOP=0 2>&1 | grep -iE "error" | head -20 || true

echo "▶ 5/5 Re-applying grants…"
psql_local < "$HERE/deploy/selfhost/grants.sql" >/dev/null

echo "▶ Verify:"
psql_local -c "select 'companies' t, count(*) from public.companies
  union all select 'employees', count(*) from public.employees
  union all select 'public.users', count(*) from public.users
  union all select 'auth.users', count(*) from auth.users
  union all select 'payroll', count(*) from public.payroll;"

rm -f /tmp/mig_public.sql /tmp/mig_auth.sql
echo "✅ Migration done. Log in with any real user's cloud email + password."
echo "   (If a user can't log in, their auth row may differ across GoTrue versions —"
echo "    reset just that one from Studio → Authentication, or via the admin API.)"
