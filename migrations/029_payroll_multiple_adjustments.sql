-- Migration 029: multiple payroll adjustments.
--
-- Extends migration 028 (single adjustment) so a payroll run can carry several
-- one-off add/deduct lines, each with its own description, e.g.
--   [{"type":"add","amount":500,"note":"Performance bonus"},
--    {"type":"deduct","amount":200,"note":"Advance recovery"}]
--
-- payroll.adjustment (signed net total) and adjustment_note (summary) are kept
-- in sync so existing payslips/reports keep working.
-- Idempotent — safe to re-run.

ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS adjustments jsonb;
