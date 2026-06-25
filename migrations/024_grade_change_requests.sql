-- Migration 024: promotion / demotion (compensation change) approval workflow
--
-- A compensation change is now *requested*, then approved/rejected by an HR
-- Manager or above (who is not the requester). A request can change any of:
--   (a) the employee's grade,
--   (b) the employee's salary (same grade), and/or
--   (c) the employee's benefits (same grade).
-- Salary and benefits are normally grade-driven, so to support per-person
-- changes we add employee-level OVERRIDES that payroll prefers over the grade
-- default. Only on approval are the overrides written (and recorded in
-- employee_change_history for the salary-journey view).

-- ---------------------------------------------------------------------------
-- 1. Per-employee overrides (payroll prefers these over the grade default)
-- ---------------------------------------------------------------------------

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS salary_override numeric(12,2);

COMMENT ON COLUMN public.employees.salary_override IS
  'When set, payroll uses this basic salary instead of the grade salary config.';

CREATE TABLE IF NOT EXISTS public.employee_benefit_overrides (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id   uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  benefit_type varchar NOT NULL,
  benefit_value numeric(12,2) NOT NULL DEFAULT 0,
  value_type   varchar NOT NULL DEFAULT 'fixed',     -- 'fixed' | 'percentage'
  currency     varchar(3) DEFAULT 'AED',
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at   timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, benefit_type)                 -- one override per benefit per employee
);

CREATE INDEX IF NOT EXISTS idx_employee_benefit_overrides_employee
  ON public.employee_benefit_overrides (employee_id);

ALTER TABLE public.employee_benefit_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_benefit_overrides_read   ON public.employee_benefit_overrides;
DROP POLICY IF EXISTS employee_benefit_overrides_insert ON public.employee_benefit_overrides;
DROP POLICY IF EXISTS employee_benefit_overrides_update ON public.employee_benefit_overrides;
DROP POLICY IF EXISTS employee_benefit_overrides_delete ON public.employee_benefit_overrides;

CREATE POLICY employee_benefit_overrides_read ON public.employee_benefit_overrides
  FOR SELECT TO public
  USING (public.is_hr_or_above() OR employee_id = public.get_my_employee_id());
CREATE POLICY employee_benefit_overrides_insert ON public.employee_benefit_overrides
  FOR INSERT TO public WITH CHECK (public.is_hr_or_above());
CREATE POLICY employee_benefit_overrides_update ON public.employee_benefit_overrides
  FOR UPDATE TO public USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());
CREATE POLICY employee_benefit_overrides_delete ON public.employee_benefit_overrides
  FOR DELETE TO public USING (public.is_hr_or_above());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_benefit_overrides TO authenticated;
GRANT ALL ON public.employee_benefit_overrides TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Allow 'benefits' as a change_type in the history table
-- ---------------------------------------------------------------------------

ALTER TABLE public.employee_change_history
  DROP CONSTRAINT IF EXISTS employee_change_history_change_type_check;
ALTER TABLE public.employee_change_history
  ADD CONSTRAINT employee_change_history_change_type_check
  CHECK (change_type IN ('grade', 'salary', 'benefits'));

-- ---------------------------------------------------------------------------
-- 3. The request table (one row per promotion / demotion / change request)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.grade_change_requests (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id        uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id         uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  request_type       varchar NOT NULL CHECK (request_type IN ('promotion', 'demotion', 'lateral')),

  -- (a) grade change
  change_grade       boolean NOT NULL DEFAULT false,
  current_grade_id   uuid REFERENCES public.employee_grades(id) ON DELETE SET NULL,
  requested_grade_id uuid REFERENCES public.employee_grades(id) ON DELETE SET NULL,

  -- (b) salary change (same grade)
  change_salary      boolean NOT NULL DEFAULT false,
  current_salary     numeric(12,2),
  requested_salary   numeric(12,2),

  -- (c) benefits change (same grade) — array of
  --     { benefit_type, benefit_value, value_type, currency, action: 'add'|'update'|'remove' }
  change_benefits    boolean NOT NULL DEFAULT false,
  benefit_changes    jsonb,

  currency           varchar(3) DEFAULT 'AED',
  reason             text,
  status             varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  effective_month    varchar(7),
  requested_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  requested_at       timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  reviewed_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at        timestamp without time zone,
  review_note        text
);

CREATE INDEX IF NOT EXISTS idx_grade_change_requests_company_status
  ON public.grade_change_requests (company_id, status);
CREATE INDEX IF NOT EXISTS idx_grade_change_requests_employee
  ON public.grade_change_requests (employee_id);

ALTER TABLE public.grade_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grade_change_requests_read   ON public.grade_change_requests;
DROP POLICY IF EXISTS grade_change_requests_insert ON public.grade_change_requests;
DROP POLICY IF EXISTS grade_change_requests_update ON public.grade_change_requests;
DROP POLICY IF EXISTS grade_change_requests_delete ON public.grade_change_requests;

-- HR+ see all company requests; an employee can see requests about themselves.
CREATE POLICY grade_change_requests_read ON public.grade_change_requests
  FOR SELECT TO public
  USING (public.is_hr_or_above() OR employee_id = public.get_my_employee_id());

CREATE POLICY grade_change_requests_insert ON public.grade_change_requests
  FOR INSERT TO public WITH CHECK (public.is_hr_or_above());

CREATE POLICY grade_change_requests_update ON public.grade_change_requests
  FOR UPDATE TO public USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());

CREATE POLICY grade_change_requests_delete ON public.grade_change_requests
  FOR DELETE TO public USING (public.is_company_admin_or_above());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_change_requests TO authenticated;
GRANT ALL ON public.grade_change_requests TO service_role;
