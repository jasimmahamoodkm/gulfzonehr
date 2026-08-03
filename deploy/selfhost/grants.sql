-- Self-hosted Supabase: grant the API roles access to the app objects.
--
-- The managed Supabase cloud grants these automatically; a self-hosted stack
-- does NOT, so without this the app fails with e.g.
--   "permission denied for function get_my_company_id"
-- (the RLS helper functions and tables aren't executable/selectable by the
-- authenticated/anon roles). Run this ONCE, right after loading
-- gulfzone_hr_deployment.sql. Idempotent — safe to re-run.
--
--   docker exec -i supabase-db psql -U postgres -d postgres < deploy/selfhost/grants.sql

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- RLS helper functions (get_my_company_id, is_super_admin, …) must be callable.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Table access (RLS still filters rows on top of these grants).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Apply automatically to any objects created later, too.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
