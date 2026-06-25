-- Migration 023: annual benefit payment tracking
-- Records when an annual benefit (e.g. Annual Flight Ticket, Annual Bonus) is
-- paid to an employee, so it can be paid ONCE per calendar year in whatever
-- month the admin chooses, and shown as "already paid" in other months.

CREATE TABLE IF NOT EXISTS public.annual_benefit_payments (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id   uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  benefit_type varchar NOT NULL,
  year         integer NOT NULL,
  paid_month   varchar(7) NOT NULL,            -- 'YYYY-MM'
  amount       numeric(12,2),
  payroll_id   uuid REFERENCES public.payroll(id) ON DELETE SET NULL,
  created_at   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, benefit_type, year)     -- once per benefit per year
);

CREATE INDEX IF NOT EXISTS idx_annual_benefit_payments_emp_year
  ON public.annual_benefit_payments (employee_id, year);

ALTER TABLE public.annual_benefit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS annual_benefit_payments_read   ON public.annual_benefit_payments;
DROP POLICY IF EXISTS annual_benefit_payments_insert ON public.annual_benefit_payments;
DROP POLICY IF EXISTS annual_benefit_payments_update ON public.annual_benefit_payments;
DROP POLICY IF EXISTS annual_benefit_payments_delete ON public.annual_benefit_payments;

CREATE POLICY annual_benefit_payments_read ON public.annual_benefit_payments
  FOR SELECT TO public
  USING (public.is_hr_or_above() OR employee_id = public.get_my_employee_id());

CREATE POLICY annual_benefit_payments_insert ON public.annual_benefit_payments
  FOR INSERT TO public WITH CHECK (public.is_hr_or_above());

CREATE POLICY annual_benefit_payments_update ON public.annual_benefit_payments
  FOR UPDATE TO public USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());

CREATE POLICY annual_benefit_payments_delete ON public.annual_benefit_payments
  FOR DELETE TO public USING (public.is_hr_or_above());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.annual_benefit_payments TO authenticated;
GRANT ALL ON public.annual_benefit_payments TO service_role;
