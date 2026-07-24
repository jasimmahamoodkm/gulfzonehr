-- Migration 028: manual payroll adjustment.
--
-- When generating payroll, an admin can add or deduct an extra amount beyond
-- the preset grade benefits for that month (e.g. a one-off bonus, an advance
-- recovery), with a short description shown on the payslip.
--
--   adjustment      signed amount: positive = addition, negative = deduction
--   adjustment_note short description shown on the payslip
-- Idempotent — safe to re-run.

ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS adjustment numeric(12,2) DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS adjustment_note varchar;
