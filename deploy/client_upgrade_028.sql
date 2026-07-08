-- ============================================================================
-- GulfZone HR — CLIENT UPGRADE SCRIPT (migration 028: per-company branding)
-- Run this WHOLE file in the CLIENT Supabase SQL editor. Idempotent.
-- ============================================================================
-- Migration 028: per-company branding.
--
-- Each company can carry its own logo and brand colour, used in the payslip
-- header, the app header when that company is selected, and other relevant
-- areas. This is distinct from the per-build app branding in
-- branding.config.json (which brands the whole deployment for one client).
--
-- logo_url   : an image URL or data: URI (shown as the company logo)
-- brand_color: a hex colour (e.g. #0F172A) used as the payslip header band
-- Idempotent — safe to re-run.

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS brand_color varchar(7);
