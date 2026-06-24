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
