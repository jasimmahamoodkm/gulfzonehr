-- Migration 017: Payroll leave deduction tracking
-- Tracks cumulative excess-leave days already deducted per employee per year
-- so the same excess days are never deducted twice.

CREATE TABLE IF NOT EXISTS employee_leave_deduction_tracking (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year                  INTEGER NOT NULL,
  total_deducted_days   DECIMAL(6,2) NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_deduction_tracking_emp
  ON employee_leave_deduction_tracking(employee_id, year);

-- Add leave deduction columns to payroll so the payslip can show the breakdown
ALTER TABLE payroll
  ADD COLUMN IF NOT EXISTS leave_deduction_days   DECIMAL(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_deduction_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
