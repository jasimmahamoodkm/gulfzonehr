-- ============================================================
-- Migration 019: Complete Super Admin Fix for New Database
-- Run on NEW Supabase project: ebdoxleodzmvmfykakig
-- ============================================================
-- Fixes all known issues for Super Admin user to work correctly
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- STEP 1: SECURITY DEFINER HELPER FUNCTIONS (bypass RLS safely)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.users WHERE id = auth.uid()),
    (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_primary = TRUE LIMIT 1),
    (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin_or_above()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'Company Admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_hr_or_above()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'Company Admin', 'HR Manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('Super Admin', 'Company Admin', 'HR Manager', 'Department Manager', 'Manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT e.id FROM public.employees e
  JOIN public.users u ON u.email = e.email
  WHERE u.id = auth.uid()
  LIMIT 1
$$;

-- ─────────────────────────────────────────────────────────────
-- STEP 2: FIX users TABLE - ensure company_id is set
-- ─────────────────────────────────────────────────────────────

UPDATE public.users u
SET company_id = uc.company_id
FROM public.user_companies uc
WHERE uc.user_id = u.id
  AND uc.is_primary = TRUE
  AND u.company_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 3: FIX user_companies - add assigned_at column
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.user_companies
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP;

UPDATE public.user_companies
SET assigned_at = created_at
WHERE assigned_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 4: FIX modules - add is_system and updated_at
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS is_system  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

UPDATE public.modules SET is_system = TRUE WHERE is_system IS NULL;

-- Add missing admin modules if not present
INSERT INTO public.modules (name, description, icon, path, order_index, is_system)
VALUES
  ('RBAC Management',   'Manage roles and permissions',       'Lock',          '/admin/rbac',            10, TRUE),
  ('Audit Logs',        'View system audit logs',             'Shield',        '/admin/audit-logs',      11, TRUE),
  ('Leave Approvals',   'Approve or reject leave requests',   'CheckCircle',   '/admin/leave-approvals', 12, TRUE),
  ('Grade Configuration','Manage employee grades',            'GraduationCap', '/admin/grades',          13, TRUE)
ON CONFLICT DO NOTHING;

-- Assign all modules to Super Admin
INSERT INTO public.role_modules (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.name = 'Super Admin'
ON CONFLICT DO NOTHING;

-- Assign core modules to Company Admin
INSERT INTO public.role_modules (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.name = 'Company Admin'
  AND m.path IN ('/dashboard','/employees','/companies','/attendance','/leave','/payroll','/reports','/settings','/admin/rbac','/admin/audit-logs','/admin/leave-approvals','/admin/grades')
ON CONFLICT DO NOTHING;

-- Assign HR modules
INSERT INTO public.role_modules (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.name = 'HR Manager'
  AND m.path IN ('/dashboard','/employees','/attendance','/leave','/payroll','/reports','/settings','/admin/leave-approvals','/admin/grades')
ON CONFLICT DO NOTHING;

-- Assign Manager modules
INSERT INTO public.role_modules (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.name = 'Manager'
  AND m.path IN ('/dashboard','/employees','/attendance','/leave','/reports')
ON CONFLICT DO NOTHING;

-- Assign Employee modules
INSERT INTO public.role_modules (role_id, module_id)
SELECT r.id, m.id
FROM public.roles r
CROSS JOIN public.modules m
WHERE r.name = 'Employee'
  AND m.path IN ('/leave','/attendance','/settings')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- STEP 5: FIX leaves TABLE - add missing approval columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.leaves
  ADD COLUMN IF NOT EXISTS requested_by        UUID,
  ADD COLUMN IF NOT EXISTS approved_by         UUID,
  ADD COLUMN IF NOT EXISTS approval_date       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS manager_comments    TEXT,
  ADD COLUMN IF NOT EXISTS approval_status     VARCHAR,
  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT,
  ADD COLUMN IF NOT EXISTS is_comp_off         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS comp_off_request_id UUID,
  ADD COLUMN IF NOT EXISTS company_id          UUID REFERENCES public.companies(id) ON DELETE CASCADE;

UPDATE public.leaves SET approval_status = status WHERE approval_status IS NULL;
UPDATE public.leaves l SET company_id = e.company_id
FROM public.employees e WHERE l.employee_id = e.id AND l.company_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 6: FIX activity_logs TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR;

-- ─────────────────────────────────────────────────────────────
-- STEP 7: FIX audit_logs TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS resource_type  VARCHAR,
  ADD COLUMN IF NOT EXISTS resource_id    UUID,
  ADD COLUMN IF NOT EXISTS resource_name  VARCHAR,
  ADD COLUMN IF NOT EXISTS old_values     JSONB,
  ADD COLUMN IF NOT EXISTS new_values     JSONB,
  ADD COLUMN IF NOT EXISTS status         VARCHAR DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS error_message  TEXT;

UPDATE public.audit_logs SET
  resource_type = entity_type,
  resource_id   = entity_id
WHERE resource_type IS NULL AND entity_type IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 8: FIX payroll TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS leave_deduction_days   NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_deduction_amount NUMERIC DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- STEP 9: FIX employees TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 10: FIX grade_benefits TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.grade_benefits
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS value_type VARCHAR DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS currency   VARCHAR DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT TRUE;

UPDATE public.grade_benefits gb
SET company_id = eg.company_id
FROM public.employee_grades eg
WHERE gb.grade_id = eg.id AND gb.company_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 11: FIX grade_leave_config TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.grade_leave_config
  ADD COLUMN IF NOT EXISTS company_id                  UUID REFERENCES public.companies(id),
  ADD COLUMN IF NOT EXISTS days_per_year               INTEGER,
  ADD COLUMN IF NOT EXISTS carry_forward_days          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carry_forward_expiry_months INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS year                        INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at                  TIMESTAMP DEFAULT NOW();

UPDATE public.grade_leave_config SET days_per_year = days_allocated WHERE days_per_year IS NULL;
UPDATE public.grade_leave_config glc
SET company_id = eg.company_id
FROM public.employee_grades eg WHERE glc.grade_id = eg.id AND glc.company_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 12: FIX leave_approvers TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.leave_approvers
  ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS active         BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMP DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────
-- STEP 13: FIX leave_types TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────
-- STEP 14: FIX employee_leave_balance TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.employee_leave_balance
  ADD COLUMN IF NOT EXISTS total_days     INTEGER,
  ADD COLUMN IF NOT EXISTS used_days      INTEGER,
  ADD COLUMN IF NOT EXISTS pending_days   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_days INTEGER,
  ADD COLUMN IF NOT EXISTS last_updated   TIMESTAMP DEFAULT NOW();

UPDATE public.employee_leave_balance SET
  total_days     = days_allocated,
  used_days      = days_used,
  remaining_days = days_remaining
WHERE total_days IS NULL;

-- ─────────────────────────────────────────────────────────────
-- STEP 15: FIX employee_leave_deduction_tracking TABLE
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.employee_leave_deduction_tracking
  ADD COLUMN IF NOT EXISTS year                INTEGER,
  ADD COLUMN IF NOT EXISTS total_deducted_days NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMP DEFAULT NOW();

-- ─────────────────────────────────────────────────────────────
-- STEP 16: CREATE MISSING TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log_policies (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  resource_type   VARCHAR,
  retention_days  INTEGER DEFAULT 90,
  archive_enabled BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
ALTER TABLE public.audit_log_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_policies_admin" ON public.audit_log_policies
  FOR ALL USING (public.is_hr_or_above());

-- ─────────────────────────────────────────────────────────────
-- STEP 17: CREATE MISSING VIEWS
-- ─────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.audit_log_search CASCADE;
CREATE OR REPLACE VIEW public.audit_log_search AS
SELECT
  al.id,
  al.user_id,
  CONCAT(u.first_name, ' ', u.last_name)         AS user_name,
  al.company_id,
  c.name                                          AS company_name,
  al.action,
  COALESCE(al.resource_type, al.entity_type)     AS resource_type,
  COALESCE(al.resource_id,   al.entity_id)       AS resource_id,
  al.resource_name,
  COALESCE(al.status, 'success')                 AS status,
  al.created_at,
  al.ip_address,
  (al.old_values IS NOT NULL OR al.new_values IS NOT NULL OR al.changes IS NOT NULL) AS has_changes
FROM public.audit_logs al
LEFT JOIN public.users     u ON al.user_id    = u.id
LEFT JOIN public.companies c ON al.company_id = c.id;

DROP VIEW IF EXISTS public.leave_dashboard CASCADE;
CREATE OR REPLACE VIEW public.leave_dashboard AS
SELECT
  e.id                                           AS employee_id,
  CONCAT(e.first_name, ' ', e.last_name)        AS employee_name,
  e.company_id,
  lt.name                                        AS leave_type,
  COALESCE(elb.total_days, elb.days_allocated)  AS total_days,
  COALESCE(elb.used_days,  elb.days_used)       AS used_days,
  COALESCE(elb.pending_days, 0)                 AS pending_days,
  COALESCE(elb.remaining_days, elb.days_remaining) AS remaining_days,
  elb.year,
  CASE
    WHEN COALESCE(elb.total_days, elb.days_allocated, 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(elb.used_days, elb.days_used, 0)::NUMERIC
       / NULLIF(COALESCE(elb.total_days, elb.days_allocated), 0)) * 100, 1)
  END AS usage_percentage
FROM public.employees e
JOIN public.employee_leave_balance elb ON elb.employee_id = e.id
JOIN public.leave_types lt ON lt.id = elb.leave_type_id;

-- Recreate grade_summary view
DROP VIEW IF EXISTS public.grade_summary CASCADE;
CREATE OR REPLACE VIEW public.grade_summary AS
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
FROM public.employee_grades g
LEFT JOIN public.employees e ON e.grade_id = g.id AND e.status = 'active'
LEFT JOIN LATERAL (
  SELECT salary, currency
  FROM public.grade_salary_config sc
  WHERE sc.grade_id = g.id
    AND sc.effective_from <= CURRENT_DATE
    AND (sc.effective_to IS NULL OR sc.effective_to >= CURRENT_DATE)
  ORDER BY sc.effective_from DESC
  LIMIT 1
) s ON TRUE
GROUP BY g.id, g.company_id, g.name, g.level, g.description, g.active,
         g.created_at, g.updated_at, s.salary, s.currency;

-- ─────────────────────────────────────────────────────────────
-- STEP 18: COMPREHENSIVE RLS POLICIES
-- ─────────────────────────────────────────────────────────────

-- Drop all existing policies to start clean
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- COMPANIES
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_read" ON public.companies
  FOR SELECT USING (
    public.is_super_admin() OR
    id = public.get_my_company_id()
  );
CREATE POLICY "companies_write" ON public.companies
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read" ON public.users
  FOR SELECT USING (
    id = auth.uid() OR public.is_hr_or_above()
  );
CREATE POLICY "users_write" ON public.users
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- EMPLOYEES
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_read" ON public.employees
  FOR SELECT USING (
    public.is_hr_or_above() OR
    company_id = public.get_my_company_id() OR
    id = public.get_my_employee_id()
  );
CREATE POLICY "employees_write" ON public.employees
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- ATTENDANCE
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_read" ON public.attendance
  FOR SELECT USING (
    public.is_manager_or_above() OR
    employee_id = public.get_my_employee_id()
  );
CREATE POLICY "attendance_write" ON public.attendance
  FOR ALL USING (public.is_hr_or_above() OR employee_id = public.get_my_employee_id())
  WITH CHECK (public.is_hr_or_above() OR employee_id = public.get_my_employee_id());

-- LEAVES
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaves_read" ON public.leaves
  FOR SELECT USING (
    public.is_hr_or_above() OR
    employee_id = public.get_my_employee_id() OR
    company_id = public.get_my_company_id()
  );
CREATE POLICY "leaves_write" ON public.leaves
  FOR ALL USING (
    public.is_hr_or_above() OR
    employee_id = public.get_my_employee_id()
  )
  WITH CHECK (
    public.is_hr_or_above() OR
    employee_id = public.get_my_employee_id()
  );

-- PAYROLL
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_read" ON public.payroll
  FOR SELECT USING (
    public.is_hr_or_above() OR
    employee_id = public.get_my_employee_id()
  );
CREATE POLICY "payroll_write" ON public.payroll
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- DOCUMENTS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_read" ON public.documents
  FOR SELECT USING (
    public.is_hr_or_above() OR
    company_id = public.get_my_company_id() OR
    employee_id = public.get_my_employee_id()
  );
CREATE POLICY "documents_write" ON public.documents
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- ROLES
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read" ON public.roles
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "roles_write" ON public.roles
  FOR ALL USING (public.is_company_admin_or_above() AND is_system = FALSE)
  WITH CHECK (public.is_company_admin_or_above());

-- MODULES
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_read" ON public.modules
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "modules_write" ON public.modules
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ROLE_MODULES
ALTER TABLE public.role_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_modules_read" ON public.role_modules
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "role_modules_write" ON public.role_modules
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- USER_ROLES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_company_admin_or_above());
CREATE POLICY "user_roles_write" ON public.user_roles
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- USER_COMPANIES
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_companies_read" ON public.user_companies
  FOR SELECT USING (user_id = auth.uid() OR public.is_company_admin_or_above());
CREATE POLICY "user_companies_write" ON public.user_companies
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- ROLE_PERMISSIONS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_read" ON public.role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "role_permissions_write" ON public.role_permissions
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- LEAVE_TYPES
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_types_read" ON public.leave_types
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    company_id = public.get_my_company_id()
  );
CREATE POLICY "leave_types_write" ON public.leave_types
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- LEAVE_APPROVERS
ALTER TABLE public.leave_approvers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_approvers_read" ON public.leave_approvers
  FOR SELECT USING (public.is_manager_or_above());
CREATE POLICY "leave_approvers_write" ON public.leave_approvers
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- EMPLOYEE_GRADES
ALTER TABLE public.employee_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_grades_read" ON public.employee_grades
  FOR SELECT USING (company_id = public.get_my_company_id());
CREATE POLICY "employee_grades_write" ON public.employee_grades
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- GRADE_SALARY_CONFIG
ALTER TABLE public.grade_salary_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grade_salary_read" ON public.grade_salary_config
  FOR SELECT USING (public.is_hr_or_above());
CREATE POLICY "grade_salary_write" ON public.grade_salary_config
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- GRADE_BENEFITS
ALTER TABLE public.grade_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grade_benefits_read" ON public.grade_benefits
  FOR SELECT USING (public.is_hr_or_above());
CREATE POLICY "grade_benefits_write" ON public.grade_benefits
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- GRADE_LEAVE_CONFIG
ALTER TABLE public.grade_leave_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grade_leave_read" ON public.grade_leave_config
  FOR SELECT USING (public.is_hr_or_above());
CREATE POLICY "grade_leave_write" ON public.grade_leave_config
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- EMPLOYEE_LEAVE_BALANCE
ALTER TABLE public.employee_leave_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_balance_read" ON public.employee_leave_balance
  FOR SELECT USING (
    public.is_hr_or_above() OR
    employee_id = public.get_my_employee_id()
  );
CREATE POLICY "leave_balance_write" ON public.employee_leave_balance
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- AUDIT_LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_read" ON public.audit_logs
  FOR SELECT USING (public.is_hr_or_above());
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ACTIVITY_LOGS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_read" ON public.activity_logs
  FOR SELECT USING (public.is_hr_or_above());
CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- AUDIT_LOG_POLICIES
ALTER TABLE public.audit_log_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_policies_all" ON public.audit_log_policies
  FOR ALL USING (public.is_company_admin_or_above());

-- EMPLOYEE_LEAVE_DEDUCTION_TRACKING
ALTER TABLE public.employee_leave_deduction_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_deduction_read" ON public.employee_leave_deduction_tracking
  FOR SELECT USING (public.is_hr_or_above());
CREATE POLICY "leave_deduction_write" ON public.employee_leave_deduction_tracking
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- ─────────────────────────────────────────────────────────────
-- STEP 19: PERFORMANCE INDEXES
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_employees_company_id  ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_email       ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_status      ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id     ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee_id    ON public.leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_company_id     ON public.leaves(company_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status         ON public.leaves(status);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date   ON public.attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_id   ON public.payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_status        ON public.payroll(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company    ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created    ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_balance_emp     ON public.employee_leave_balance(employee_id);
CREATE INDEX IF NOT EXISTS idx_grade_benefits_grade  ON public.grade_benefits(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_leave_grade     ON public.grade_leave_config(grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_salary_grade    ON public.grade_salary_config(grade_id);

-- ─────────────────────────────────────────────────────────────
-- STEP 20: GRANT PERMISSIONS
-- ─────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- VERIFICATION
-- ─────────────────────────────────────────────────────────────

SELECT '✅ Helper functions'    AS check, public.is_super_admin() AS result
UNION ALL
SELECT '✅ Admin check',         public.is_company_admin_or_above()
UNION ALL
SELECT '✅ HR check',            public.is_hr_or_above()
UNION ALL
SELECT '✅ Company ID set',      (public.get_my_company_id() IS NOT NULL);
