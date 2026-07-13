#!/usr/bin/env node
// Generate the three secrets self-hosted Supabase needs, ready to paste into
// its docker .env:  JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY.
// The anon/service keys are JWTs (HS256) signed with JWT_SECRET, exactly the
// format supabase-js expects. No dependencies — pure node:crypto.
//
//   node deploy/selfhost/gen-keys.mjs            # fresh random secret
//   JWT_SECRET=... node deploy/selfhost/gen-keys.mjs   # reuse a secret
import crypto from 'node:crypto';

const b64url = (s) => Buffer.from(s).toString('base64url');
const sign = (payload, secret) => {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};

const secret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'); // 64 chars
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10; // 10 years

const anon = sign({ role: 'anon', iss: 'supabase', iat, exp }, secret);
const service = sign({ role: 'service_role', iss: 'supabase', iat, exp }, secret);

console.log('# Paste these into supabase/docker/.env');
console.log(`JWT_SECRET=${secret}`);
console.log(`ANON_KEY=${anon}`);
console.log(`SERVICE_ROLE_KEY=${service}`);
console.log('');
console.log('# And into the app .env.local');
console.log('NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000');
console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${service}`);
