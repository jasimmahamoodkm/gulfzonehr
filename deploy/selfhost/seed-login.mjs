#!/usr/bin/env node
// Create a working Super Admin login on a freshly self-hosted Supabase.
// A fresh stack has an empty auth.users, so the seeded public.users rows can't
// log in yet. This creates one auth user (via GoTrue) and wires the matching
// public.users + Super Admin role + company link so you can sign in.
//
// Run AFTER: the stack is up AND the deployment SQL (schema + seed) is loaded.
//
//   SERVICE_ROLE_KEY=... POSTGRES_PASSWORD=... \
//     node deploy/selfhost/seed-login.mjs
//
// Optional env: SUPABASE_URL (default http://localhost:8000),
//   DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD.
import pg from 'pg';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000';
const SERVICE = process.env.SERVICE_ROLE_KEY;
const EMAIL = process.env.ADMIN_EMAIL || 'admin@local.test';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@12345';
const DB = process.env.DATABASE_URL ||
  `postgres://postgres:${process.env.POSTGRES_PASSWORD || 'postgres'}@localhost:5432/postgres`;

if (!SERVICE) { console.error('✖ Set SERVICE_ROLE_KEY (from gen-keys.mjs).'); process.exit(1); }

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

// 2. Wire public.users + Super Admin role + company via Postgres.
const client = new pg.Client({ connectionString: DB });
await client.connect();
try {
  const { rows: co } = await client.query('select id, name from public.companies order by created_at limit 1');
  if (!co.length) { throw new Error('No companies found — load the deployment SQL (schema + seed) first.'); }
  const companyId = co[0].id;

  const { rows: role } = await client.query(
    "select id from public.roles where name = 'Super Admin' order by is_system desc nulls last limit 1"
  );
  if (!role.length) { throw new Error("No 'Super Admin' role found — load the deployment SQL first."); }
  const roleId = role[0].id;

  await client.query(
    `insert into public.users (id,email,first_name,last_name,role,company_id,is_temporary_password)
     values ($1,$2,'Local','Admin','Super Admin',$3,false)
     on conflict (id) do update set email = excluded.email`,
    [uid, EMAIL, companyId]
  );
  await client.query('insert into public.user_roles (user_id,role_id,company_id) values ($1,$2,$3)', [uid, roleId, companyId]);
  await client.query('insert into public.user_companies (user_id,company_id,is_primary) values ($1,$2,true)', [uid, companyId]);

  console.log(`\n✅ Super Admin login ready`);
  console.log(`   app:      http://localhost:3000/HRportal/login`);
  console.log(`   email:    ${EMAIL}`);
  console.log(`   password: ${PASSWORD}`);
  console.log(`   company:  ${co[0].name}`);
} finally {
  await client.end();
}
