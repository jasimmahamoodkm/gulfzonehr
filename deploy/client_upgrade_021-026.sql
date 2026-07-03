-- ============================================================================
-- GulfZone HR — CLIENT UPGRADE SCRIPT (migrations 021–026)
-- ============================================================================
-- Run this WHOLE file in the CLIENT Supabase SQL editor when upgrading an
-- existing installation. It is idempotent — safe to re-run.
--
-- ⚠ Do NOT run gulfzone_hr_deployment.sql on an existing database: its
--   seed/business-data sections are for a FRESH database only and will
--   fail with duplicate-key errors against live data.
-- ============================================================================
--     021 employee_change_history · 022 manager_id · 023 annual_benefit_payments
--     024 promotion/demotion workflow · 025 employee archive · 026 PDC cheques
-- ============================================================================

-- ──── migrations/021_employee_change_history.sql ────
-- Migration 021: Employee grade & salary change history
-- Records every grade or salary change per employee so the timeline can be
-- reconstructed (feeds the Employee Journey widget). Forward-only, idempotent.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_change_history (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  change_type     varchar NOT NULL CHECK (change_type IN ('grade', 'salary')),
  old_grade_id    uuid REFERENCES public.employee_grades(id) ON DELETE SET NULL,
  new_grade_id    uuid REFERENCES public.employee_grades(id) ON DELETE SET NULL,
  old_salary      numeric(12,2),
  new_salary      numeric(12,2),
  currency        varchar(3) DEFAULT 'AED',
  effective_month varchar(7),               -- 'YYYY-MM' the change takes effect
  note            text,
  changed_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at      timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emp_change_history_employee
  ON public.employee_change_history (employee_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_emp_change_history_company
  ON public.employee_change_history (company_id);

-- ---------------------------------------------------------------------------
-- RLS  (read: HR+ or the employee themselves; writes: service role / HR+)
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_change_history_read   ON public.employee_change_history;
DROP POLICY IF EXISTS employee_change_history_insert ON public.employee_change_history;
DROP POLICY IF EXISTS employee_change_history_update ON public.employee_change_history;
DROP POLICY IF EXISTS employee_change_history_delete ON public.employee_change_history;

CREATE POLICY employee_change_history_read ON public.employee_change_history
  FOR SELECT TO public
  USING (
    public.is_hr_or_above()
    OR employee_id = public.get_my_employee_id()
  );

CREATE POLICY employee_change_history_insert ON public.employee_change_history
  FOR INSERT TO public
  WITH CHECK (public.is_hr_or_above());

CREATE POLICY employee_change_history_update ON public.employee_change_history
  FOR UPDATE TO public
  USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

CREATE POLICY employee_change_history_delete ON public.employee_change_history
  FOR DELETE TO public
  USING (public.is_hr_or_above());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_change_history TO authenticated;
GRANT ALL ON public.employee_change_history TO service_role;

-- ──── migrations/022_employees_manager_id.sql ────
-- Migration 022: add employees.manager_id (reporting manager)
-- This column backs the "Assign Manager" feature and the manager-scoped data
-- views. It was originally applied directly to the production project, so this
-- file exists to bring DEV / fresh environments in line. Idempotent.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id uuid;

-- Self-referencing FK: an employee's manager is another employee.
DO $$ BEGIN
  ALTER TABLE public.employees
    ADD CONSTRAINT employees_manager_id_fkey
    FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_employees_manager_id
  ON public.employees (manager_id);

-- ──── migrations/023_annual_benefit_payments.sql ────
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

-- ──── migrations/024_grade_change_requests.sql ────
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

-- ──── migrations/025_employee_archive.sql ────
-- Migration 025: archive employees instead of hard-deleting them.
-- Archiving sets status = 'Inactive' and records archived_at (and who did it),
-- so the employee's full history stays viewable with its current status and the
-- date it was archived. Reactivating clears archived_at.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employees.archived_at IS
  'When set, the employee is archived (status Inactive). NULL = active record.';

CREATE INDEX IF NOT EXISTS idx_employees_archived_at
  ON public.employees (archived_at);

-- ──── migrations/026_pdc_cheques.sql ────
-- Migration 026: Post-Dated Cheque (PDC) tracking.
-- Tracks both Payable (cheques the company issues) and Receivable (cheques the
-- company receives) post-dated cheques, with due date, party, amount and a
-- clearing status. Surfaced under the Documents area.

CREATE TABLE IF NOT EXISTS public.pdc_cheques (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cheque_type    varchar NOT NULL CHECK (cheque_type IN ('payable', 'receivable')),
  cheque_number  varchar NOT NULL,
  bank_name      varchar,
  amount         numeric(14,2) NOT NULL DEFAULT 0,
  currency       varchar(3) DEFAULT 'AED',
  cheque_date    date NOT NULL,                       -- the post-dated / due date
  party_name     varchar,                             -- payee (payable) / drawer (receivable)
  reference      varchar,                             -- linked invoice / PO / contract ref
  status         varchar NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'cleared', 'bounced', 'cancelled')),
  notes          text,
  created_by     uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at     timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pdc_cheques_company_type   ON public.pdc_cheques (company_id, cheque_type);
CREATE INDEX IF NOT EXISTS idx_pdc_cheques_company_status ON public.pdc_cheques (company_id, status);
CREATE INDEX IF NOT EXISTS idx_pdc_cheques_due            ON public.pdc_cheques (cheque_date);

ALTER TABLE public.pdc_cheques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdc_cheques_read   ON public.pdc_cheques;
DROP POLICY IF EXISTS pdc_cheques_insert ON public.pdc_cheques;
DROP POLICY IF EXISTS pdc_cheques_update ON public.pdc_cheques;
DROP POLICY IF EXISTS pdc_cheques_delete ON public.pdc_cheques;

-- Anyone with company access can view; HR Manager or above can manage.
CREATE POLICY pdc_cheques_read ON public.pdc_cheques
  FOR SELECT TO public
  USING (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR public.user_has_company_access(company_id)));

CREATE POLICY pdc_cheques_insert ON public.pdc_cheques
  FOR INSERT TO public
  WITH CHECK (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id))));

CREATE POLICY pdc_cheques_update ON public.pdc_cheques
  FOR UPDATE TO public
  USING (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id))))
  WITH CHECK (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id))));

CREATE POLICY pdc_cheques_delete ON public.pdc_cheques
  FOR DELETE TO public
  USING (((select auth.uid()) IS NOT NULL) AND (public.is_super_admin() OR (public.is_company_admin_or_above() AND public.user_has_company_access(company_id))));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdc_cheques TO authenticated;
GRANT ALL ON public.pdc_cheques TO service_role;
