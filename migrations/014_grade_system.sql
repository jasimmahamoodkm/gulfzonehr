-- ============================================================
-- Migration 014: Employee Grade & Benefits Configuration System
-- ============================================================
-- Adds company-wise employee grade management with:
--   - Grade definitions per company
--   - Leave entitlement per grade per leave type
--   - Salary bands per grade
--   - Benefits per grade
-- ============================================================

-- 1. Employee Grades table
CREATE TABLE IF NOT EXISTS employee_grades (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  level       INTEGER NOT NULL DEFAULT 1, -- numeric level; 1 = junior, higher = senior
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

COMMENT ON TABLE employee_grades IS 'Grade/band definitions per company (e.g. Grade A, Senior Manager, Level 3)';
COMMENT ON COLUMN employee_grades.level IS 'Numeric sort order; lower = junior, higher = senior';

-- 2. Grade Leave Configuration table
-- Defines how many days of each leave type employees of a given grade are entitled to.
-- NULL year = default for all years; specific year overrides the default.
CREATE TABLE IF NOT EXISTS grade_leave_config (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_id                  UUID NOT NULL REFERENCES employee_grades(id) ON DELETE CASCADE,
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  leave_type_id             UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  days_per_year             INTEGER NOT NULL DEFAULT 0 CHECK (days_per_year >= 0),
  carry_forward_days        INTEGER NOT NULL DEFAULT 0 CHECK (carry_forward_days >= 0),
  carry_forward_expiry_months INTEGER NOT NULL DEFAULT 3 CHECK (carry_forward_expiry_months >= 0),
  year                      INTEGER, -- NULL = applies to all years
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE grade_leave_config IS 'Leave entitlement per grade per leave type (optionally per year)';
COMMENT ON COLUMN grade_leave_config.carry_forward_days IS 'Max unused days that carry forward to next year';
COMMENT ON COLUMN grade_leave_config.carry_forward_expiry_months IS 'Months after year end within which carried-forward days must be used';
COMMENT ON COLUMN grade_leave_config.year IS 'NULL = applies to all years; set for year-specific override';

-- Unique constraint: one entry per grade/leave_type combination (per year or default)
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_leave_config_unique
  ON grade_leave_config (grade_id, leave_type_id, COALESCE(year, 0));

-- 3. Grade Salary Configuration table
CREATE TABLE IF NOT EXISTS grade_salary_config (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_id       UUID NOT NULL REFERENCES employee_grades(id) ON DELETE CASCADE,
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  salary         DECIMAL(12,2) NOT NULL CHECK (salary >= 0),
  currency       VARCHAR(3) NOT NULL DEFAULT 'AED',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to   DATE,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

COMMENT ON TABLE grade_salary_config IS 'Fixed salary per grade per company';

-- 4. Grade Benefits table
CREATE TABLE IF NOT EXISTS grade_benefits (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade_id     UUID NOT NULL REFERENCES employee_grades(id) ON DELETE CASCADE,
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  benefit_name VARCHAR(100) NOT NULL,
  -- Benefit types: Health Insurance, Housing Allowance, Transport Allowance,
  --                Education Allowance, Annual Bonus, Performance Bonus,
  --                Meal Allowance, Phone Allowance, Annual Flight Ticket,
  --                Gratuity, Pension, Other
  benefit_type VARCHAR(50) NOT NULL DEFAULT 'Other',
  benefit_value DECIMAL(12,2),            -- monetary amount or percentage value
  value_type    VARCHAR(10) NOT NULL DEFAULT 'fixed' CHECK (value_type IN ('fixed', 'percentage')),
  currency      VARCHAR(3) NOT NULL DEFAULT 'AED',
  description   TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE grade_benefits IS 'Benefits package per grade per company';
COMMENT ON COLUMN grade_benefits.value_type IS 'fixed = AED amount, percentage = % of basic salary';

-- 5. Add grade_id to employees table
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES employee_grades(id) ON DELETE SET NULL;

COMMENT ON COLUMN employees.grade_id IS 'Employee grade/band (links to employee_grades)';

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employee_grades_company     ON employee_grades(company_id);
CREATE INDEX IF NOT EXISTS idx_employee_grades_active      ON employee_grades(company_id, active);
CREATE INDEX IF NOT EXISTS idx_grade_leave_config_grade    ON grade_leave_config(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_leave_config_company  ON grade_leave_config(company_id);
CREATE INDEX IF NOT EXISTS idx_grade_salary_config_grade   ON grade_salary_config(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_salary_config_company ON grade_salary_config(company_id);
CREATE INDEX IF NOT EXISTS idx_grade_benefits_grade        ON grade_benefits(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_benefits_company      ON grade_benefits(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_grade             ON employees(grade_id) WHERE grade_id IS NOT NULL;

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION (create if not already present)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS set_employee_grades_updated_at ON employee_grades;
CREATE TRIGGER set_employee_grades_updated_at
  BEFORE UPDATE ON employee_grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_grade_leave_config_updated_at ON grade_leave_config;
CREATE TRIGGER set_grade_leave_config_updated_at
  BEFORE UPDATE ON grade_leave_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_grade_salary_config_updated_at ON grade_salary_config;
CREATE TRIGGER set_grade_salary_config_updated_at
  BEFORE UPDATE ON grade_salary_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_grade_benefits_updated_at ON grade_benefits;
CREATE TRIGGER set_grade_benefits_updated_at
  BEFORE UPDATE ON grade_benefits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- Drop existing policies first so re-runs are safe
-- ============================================================
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('employee_grades','grade_leave_config','grade_salary_config','grade_benefits')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.policyname, rec.tablename);
  END LOOP;
END;
$$;

-- employee_grades
ALTER TABLE employee_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_select_own_company" ON employee_grades
  FOR SELECT USING (company_id = public.get_my_company_id());

CREATE POLICY "grade_insert_admin" ON employee_grades
  FOR INSERT WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.is_company_admin_or_above()
  );

CREATE POLICY "grade_update_admin" ON employee_grades
  FOR UPDATE USING (
    company_id = public.get_my_company_id()
    AND public.is_company_admin_or_above()
  );

CREATE POLICY "grade_delete_admin" ON employee_grades
  FOR DELETE USING (
    company_id = public.get_my_company_id()
    AND public.is_company_admin_or_above()
  );

-- grade_leave_config
ALTER TABLE grade_leave_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_leave_select_own_company" ON grade_leave_config
  FOR SELECT USING (company_id = public.get_my_company_id());

CREATE POLICY "grade_leave_insert_admin" ON grade_leave_config
  FOR INSERT WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.is_hr_or_above()
  );

CREATE POLICY "grade_leave_update_admin" ON grade_leave_config
  FOR UPDATE USING (
    company_id = public.get_my_company_id()
    AND public.is_hr_or_above()
  );

CREATE POLICY "grade_leave_delete_admin" ON grade_leave_config
  FOR DELETE USING (
    company_id = public.get_my_company_id()
    AND public.is_hr_or_above()
  );

-- grade_salary_config
ALTER TABLE grade_salary_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_salary_select_own_company" ON grade_salary_config
  FOR SELECT USING (company_id = public.get_my_company_id());

CREATE POLICY "grade_salary_insert_admin" ON grade_salary_config
  FOR INSERT WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.is_company_admin_or_above()
  );

CREATE POLICY "grade_salary_update_admin" ON grade_salary_config
  FOR UPDATE USING (
    company_id = public.get_my_company_id()
    AND public.is_company_admin_or_above()
  );

CREATE POLICY "grade_salary_delete_admin" ON grade_salary_config
  FOR DELETE USING (
    company_id = public.get_my_company_id()
    AND public.is_company_admin_or_above()
  );

-- grade_benefits
ALTER TABLE grade_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_benefits_select_own_company" ON grade_benefits
  FOR SELECT USING (company_id = public.get_my_company_id());

CREATE POLICY "grade_benefits_insert_admin" ON grade_benefits
  FOR INSERT WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.is_hr_or_above()
  );

CREATE POLICY "grade_benefits_update_admin" ON grade_benefits
  FOR UPDATE USING (
    company_id = public.get_my_company_id()
    AND public.is_hr_or_above()
  );

CREATE POLICY "grade_benefits_delete_admin" ON grade_benefits
  FOR DELETE USING (
    company_id = public.get_my_company_id()
    AND public.is_hr_or_above()
  );

-- ============================================================
-- HELPER VIEW: grade summary with employee count
-- ============================================================
CREATE OR REPLACE VIEW grade_summary AS
SELECT
  g.id,
  g.company_id,
  g.name,
  g.level,
  g.description,
  g.active,
  g.created_at,
  g.updated_at,
  COUNT(e.id) AS employee_count,
  s.salary,
  s.currency
FROM employee_grades g
LEFT JOIN employees e ON e.grade_id = g.id AND e.status = 'Active'
LEFT JOIN LATERAL (
  SELECT salary, currency
  FROM grade_salary_config sc
  WHERE sc.grade_id = g.id
    AND sc.effective_from <= CURRENT_DATE
    AND (sc.effective_to IS NULL OR sc.effective_to >= CURRENT_DATE)
  ORDER BY sc.effective_from DESC
  LIMIT 1
) s ON TRUE
GROUP BY g.id, g.company_id, g.name, g.level, g.description, g.active,
         g.created_at, g.updated_at, s.salary, s.currency;

-- ============================================================
-- INSERT DEFAULT GRADES for existing companies (optional seed)
-- (Run this only if you want starter grades — comment out if not needed)
-- ============================================================
-- INSERT INTO employee_grades (company_id, name, level, description)
-- SELECT id, 'Grade A', 1, 'Entry level positions' FROM companies
-- ON CONFLICT (company_id, name) DO NOTHING;
-- INSERT INTO employee_grades (company_id, name, level, description)
-- SELECT id, 'Grade B', 2, 'Mid level positions' FROM companies
-- ON CONFLICT (company_id, name) DO NOTHING;
-- INSERT INTO employee_grades (company_id, name, level, description)
-- SELECT id, 'Grade C', 3, 'Senior positions' FROM companies
-- ON CONFLICT (company_id, name) DO NOTHING;
-- INSERT INTO employee_grades (company_id, name, level, description)
-- SELECT id, 'Grade D', 4, 'Managerial positions' FROM companies
-- ON CONFLICT (company_id, name) DO NOTHING;
-- INSERT INTO employee_grades (company_id, name, level, description)
-- SELECT id, 'Grade E', 5, 'Executive positions' FROM companies
-- ON CONFLICT (company_id, name) DO NOTHING;
