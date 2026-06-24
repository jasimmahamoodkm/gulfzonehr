#!/usr/bin/env node
/**
 * Supabase environment guard.
 *
 * Purpose: make it IMPOSSIBLE to accidentally run the local/dev workflow
 * against the CLIENT (production) Supabase project. Runs automatically before
 * `npm run dev` and `npm run build` (via the predev/prebuild hooks).
 *
 * It reads the effective NEXT_PUBLIC_SUPABASE_URL (from the environment or
 * .env.local) and aborts if it points at any blocked project ref.
 *
 * The ONLY way to build/run against a blocked (production) project is to set,
 * deliberately and explicitly, on the production server only:
 *     ALLOW_PROD_DB=YES_I_AM_THE_PRODUCTION_SERVER
 * Never set this on a developer machine.
 */
const fs = require('fs');
const path = require('path');

// ---- Blocked project refs (CLIENT / PRODUCTION) ---------------------------
// Add any production project ref here. The dev workflow must never touch these.
const BLOCKED_REFS = [
  'ebdoxleodzmvmfykakig', // CLIENT production project — DO NOT USE LOCALLY
];

const OVERRIDE_VALUE = 'YES_I_AM_THE_PRODUCTION_SERVER';

// ---- Resolve the effective Supabase URL -----------------------------------
function readEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;            // ignore comments/blanks
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const envLocal = readEnvLocal();
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  envLocal.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || '(none)';

// ---- Enforce --------------------------------------------------------------
const RED = '\x1b[41m\x1b[37m\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

if (!url) {
  console.log(`${YELLOW}⚠  Supabase guard: NEXT_PUBLIC_SUPABASE_URL is not set. Continuing.${RESET}`);
  process.exit(0);
}

const isBlocked = BLOCKED_REFS.includes(ref);
const overridden = process.env.ALLOW_PROD_DB === OVERRIDE_VALUE;

if (isBlocked && !overridden) {
  console.error(`\n${RED}  ✖ BLOCKED: this command targets the CLIENT / PRODUCTION database  ${RESET}\n`);
  console.error(`  Supabase project ref : ${ref}`);
  console.error(`  This ref is on the protected production blocklist.\n`);
  console.error(`  The local dev workflow must NEVER read or write the client database.`);
  console.error(`  Point .env.local at your DEV project instead.\n`);
  console.error(`  (Production server only, and only intentionally:`);
  console.error(`     set ALLOW_PROD_DB=${OVERRIDE_VALUE})\n`);
  process.exit(1);
}

if (isBlocked && overridden) {
  console.log(`${YELLOW}⚠  Supabase guard: PRODUCTION override active — targeting ${ref}.${RESET}`);
  process.exit(0);
}

console.log(`${GREEN}✓ Supabase guard: targeting safe project '${ref}' (not the client database).${RESET}`);
process.exit(0);
