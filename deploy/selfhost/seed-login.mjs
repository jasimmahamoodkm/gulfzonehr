#!/usr/bin/env node
// Create a working Super Admin login on a freshly self-hosted Supabase.
// A fresh stack has an empty auth.users, so the seeded public.users rows can't
// log in yet. This creates one auth user (via GoTrue) and wires the matching
// public.users + Super Admin role + company link so you can sign in.
//
// Run AFTER: the stack is up, the deployment SQL is loaded, and grants.sql ran.
//
//   SERVICE_ROLE_KEY=... node deploy/selfhost/seed-login.mjs
//
// Optional env: SUPABASE_URL (default http://localhost:8000),
//   DB_CONTAINER (default supabase-db), ADMIN_EMAIL, ADMIN_PASSWORD.
//
// The DB wiring runs via `docker exec <db container> psql` so it hits raw
// Postgres directly (the host's 5432 goes through the Supavisor pooler, which
// needs a tenant id — this avoids that).
import { execFileSync } from 'node:child_process';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SERVICE = process.env.SERVICE_ROLE_KEY;
const DB = process.env.DB_CONTAINER || 'supabase-db';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@local.test';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';

if (!SERVICE) { console.error('✖ Set SERVICE_ROLE_KEY (from gen-keys.mjs / the stack .env).'); process.exit(1); }

const psql = (sql) =>
  execFileSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', sql],
    { encoding: 'utf8' }).trim();

// 1. Create the auth user via the GoTrue admin API.
const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
});
const body = await res.json();
if (!res.ok) { console.error('✖ GoTrue create-user failed:', body); process.exit(1); }
const uid = body.id;
console.log('• auth user created:', uid, EMAIL);

// 2. Wire public.users + Super Admin role + company (raw Postgres via docker exec).
const esc = (s) => s.replace(/'/g, "''");
psql(`
DO $$
DECLARE cid uuid; rid uuid; uid uuid := '${uid}';
BEGIN
  SELECT id INTO cid FROM public.companies ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN RAISE EXCEPTION 'No companies — load the deployment SQL first.'; END IF;
  SELECT id INTO rid FROM public.roles WHERE name = 'Super Admin' ORDER BY is_system DESC NULLS LAST LIMIT 1;
  IF rid IS NULL THEN RAISE EXCEPTION 'No Super Admin role — load the deployment SQL first.'; END IF;
  INSERT INTO public.users (id,email,first_name,last_name,role,company_id,is_temporary_password)
    VALUES (uid,'${esc(EMAIL)}','Local','Admin','Super Admin',cid,false)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  INSERT INTO public.user_roles (user_id,role_id,company_id) VALUES (uid,rid,cid) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_companies (user_id,company_id,is_primary) VALUES (uid,cid,true) ON CONFLICT DO NOTHING;
END $$;`);

const company = psql("SELECT c.name FROM public.companies c JOIN public.user_roles ur ON ur.company_id=c.id WHERE ur.user_id='" + uid + "' LIMIT 1;");
console.log(`\n✅ Super Admin login ready`);
console.log(`   app:      http://localhost:3000/HRportal/login`);
console.log(`   email:    ${EMAIL}`);
console.log(`   password: ${PASSWORD}`);
console.log(`   company:  ${company}`);
