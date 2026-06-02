-- =============================================================
-- GulfZone HR - Comprehensive RLS Fix Migration
-- Fixes:
--   1. Enable RLS on all unprotected tables
--   2. Drop all policies using broken auth.users.company_id
--   3. Create SECURITY DEFINER helper functions (no recursion)
--   4. Apply correct scoped policies for every table
-- =============================================================

-- ─────────────────────────────────────────
-- STEP 1: SECURITY DEFINER helper functions
-- These run as the DB owner, bypassing RLS,
-- so they never cause recursion.
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'Super Admin'
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
      AND r.name IN ('Super Admin', 'Company Admin', 'HR Manager', 'Department Manager')
  )
$$;

-- Returns the employee ID linked to the current auth user (by email match)
CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT e.id FROM public.employees e
  JOIN public.users u ON u.email = e.email
  WHERE u.id = auth.uid()
  LIMIT 1
$$;

-- ─────────────────────────────────────────
-- STEP 2: Enable RLS on tables missing it
-- ─────────────────────────────────────────
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_modules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_policies ENABLE ROW LEVEL SECURITY;

-- Already enabled (from prior migrations - safe to repeat)
ALTER TABLE public.documents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_approvers       ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────
-- STEP 3: Drop ALL existing policies on
-- affected tables (dynamic — catches any
-- policy name regardless of what it is)
-- ─────────────────────────────────────────
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'users', 'employees', 'companies', 'attendance', 'payroll',
        'roles', 'user_roles', 'role_permissions', 'leaves',
        'leave_types', 'employee_leave_balance', 'leave_approvers',
        'audit_logs', 'activity_logs', 'documents', 'modules',
        'role_modules', 'user_companies', 'audit_log_policies'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.policyname, rec.tablename);
  END LOOP;
END;
$$;

-- user_companies
DROP POLICY IF EXISTS user_companies_select_own    ON public.user_companies;
DROP POLICY IF EXISTS user_companies_admin         ON public.user_companies;
DROP POLICY IF EXISTS user_companies_service       ON public.user_companies;

-- audit_log_policies
DROP POLICY IF EXISTS audit_log_policies_read      ON public.audit_log_policies;

-- ─────────────────────────────────────────
-- STEP 4: Create correct policies
-- ─────────────────────────────────────────

-- ══════════════ USERS ══════════════
-- Users see only their own row; admins see everyone in same company
CREATE POLICY users_read_own ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_admin_read ON public.users
  FOR SELECT USING (
    public.is_company_admin_or_above()
    AND (company_id = public.get_my_company_id() OR company_id IS NULL OR public.is_super_admin())
  );

CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY users_insert ON public.users
  FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() = id);

CREATE POLICY users_admin_delete ON public.users
  FOR DELETE USING (public.is_super_admin());

-- ══════════════ COMPANIES ══════════════
-- Authenticated users see only their own company; admins can write
CREATE POLICY companies_read ON public.companies
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (id = public.get_my_company_id() OR public.is_super_admin())
  );

CREATE POLICY companies_write ON public.companies
  FOR ALL USING (public.is_company_admin_or_above() AND (id = public.get_my_company_id() OR public.is_super_admin()))
  WITH CHECK (public.is_company_admin_or_above());

-- ══════════════ EMPLOYEES ══════════════
-- HR+ sees all in company; others see own employee record only
CREATE POLICY employees_read_hr ON public.employees
  FOR SELECT USING (
    public.is_hr_or_above()
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY employees_read_own ON public.employees
  FOR SELECT USING (
    id = public.get_my_employee_id()
  );

CREATE POLICY employees_write ON public.employees
  FOR INSERT WITH CHECK (
    public.is_hr_or_above()
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY employees_update ON public.employees
  FOR UPDATE USING (
    public.is_hr_or_above()
    AND company_id = public.get_my_company_id()
  ) WITH CHECK (public.is_hr_or_above());

CREATE POLICY employees_delete ON public.employees
  FOR DELETE USING (
    public.is_company_admin_or_above()
    AND company_id = public.get_my_company_id()
  );

-- ══════════════ ROLES ══════════════
-- All authenticated users can read roles (needed for permission checks)
-- Only admins can write
CREATE POLICY roles_read ON public.roles
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (is_system = true OR company_id = public.get_my_company_id() OR public.is_super_admin())
  );

CREATE POLICY roles_write ON public.roles
  FOR ALL USING (
    public.is_company_admin_or_above()
    AND is_system = false
    AND company_id = public.get_my_company_id()
  ) WITH CHECK (
    public.is_company_admin_or_above()
    AND is_system = false
  );

-- ══════════════ USER_ROLES ══════════════
-- Users can read their own roles; admins manage all in company
CREATE POLICY user_roles_read_own ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY user_roles_admin_read ON public.user_roles
  FOR SELECT USING (
    public.is_company_admin_or_above()
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY user_roles_admin_write ON public.user_roles
  FOR ALL USING (
    public.is_company_admin_or_above()
    AND company_id = public.get_my_company_id()
  ) WITH CHECK (public.is_company_admin_or_above());

-- ══════════════ USER_COMPANIES ══════════════
CREATE POLICY user_companies_own ON public.user_companies
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY user_companies_admin ON public.user_companies
  FOR ALL USING (
    public.is_company_admin_or_above()
    AND company_id = public.get_my_company_id()
  ) WITH CHECK (public.is_company_admin_or_above());

-- ══════════════ ROLE_PERMISSIONS ══════════════
-- All authenticated users read (needed for permission checks at login)
-- Only admins write
CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND role_id IN (
      SELECT id FROM public.roles
      WHERE is_system = true OR company_id = public.get_my_company_id()
    )
  );

CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- ══════════════ MODULES ══════════════
-- All authenticated users can read modules (needed for sidebar nav)
CREATE POLICY modules_read ON public.modules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY modules_admin_write ON public.modules
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ══════════════ ROLE_MODULES ══════════════
-- All authenticated users read; only admins write
CREATE POLICY role_modules_read ON public.role_modules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY role_modules_admin_write ON public.role_modules
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- ══════════════ ATTENDANCE ══════════════
CREATE POLICY attendance_read_own ON public.attendance
  FOR SELECT USING (
    employee_id = public.get_my_employee_id()
  );

CREATE POLICY attendance_read_manager ON public.attendance
  FOR SELECT USING (
    public.is_manager_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  );

CREATE POLICY attendance_write_own ON public.attendance
  FOR INSERT WITH CHECK (
    employee_id = public.get_my_employee_id()
  );

CREATE POLICY attendance_write_manager ON public.attendance
  FOR ALL USING (
    public.is_hr_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  ) WITH CHECK (public.is_hr_or_above());

-- ══════════════ LEAVES ══════════════
CREATE POLICY leaves_read_own ON public.leaves
  FOR SELECT USING (employee_id = public.get_my_employee_id());

CREATE POLICY leaves_read_manager ON public.leaves
  FOR SELECT USING (
    public.is_manager_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  );

CREATE POLICY leaves_insert_own ON public.leaves
  FOR INSERT WITH CHECK (employee_id = public.get_my_employee_id());

CREATE POLICY leaves_manage_hr ON public.leaves
  FOR ALL USING (
    public.is_hr_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  ) WITH CHECK (public.is_hr_or_above());

CREATE POLICY leaves_update_manager ON public.leaves
  FOR UPDATE USING (
    public.is_manager_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  ) WITH CHECK (public.is_manager_or_above());

-- ══════════════ LEAVE_TYPES ══════════════
CREATE POLICY leave_types_read ON public.leave_types
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY leave_types_write ON public.leave_types
  FOR ALL USING (
    public.is_hr_or_above()
    AND company_id = public.get_my_company_id()
  ) WITH CHECK (
    public.is_hr_or_above()
    AND company_id = public.get_my_company_id()
  );

-- ══════════════ EMPLOYEE_LEAVE_BALANCE ══════════════
CREATE POLICY leave_balance_read_own ON public.employee_leave_balance
  FOR SELECT USING (employee_id = public.get_my_employee_id());

CREATE POLICY leave_balance_read_hr ON public.employee_leave_balance
  FOR SELECT USING (
    public.is_hr_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  );

CREATE POLICY leave_balance_write_hr ON public.employee_leave_balance
  FOR ALL USING (
    public.is_hr_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  ) WITH CHECK (public.is_hr_or_above());

-- ══════════════ PAYROLL ══════════════
-- Employees see only their own payroll; HR+ sees all in company
CREATE POLICY payroll_read_own ON public.payroll
  FOR SELECT USING (employee_id = public.get_my_employee_id());

CREATE POLICY payroll_read_hr ON public.payroll
  FOR SELECT USING (
    public.is_hr_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  );

CREATE POLICY payroll_write_hr ON public.payroll
  FOR ALL USING (
    public.is_hr_or_above()
    AND employee_id IN (
      SELECT id FROM public.employees WHERE company_id = public.get_my_company_id()
    )
  ) WITH CHECK (public.is_hr_or_above());

-- ══════════════ DOCUMENTS ══════════════
CREATE POLICY documents_read ON public.documents
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND company_id = public.get_my_company_id()
    AND (
      employee_id IS NULL  -- company-level docs (e.g. trade license)
      OR employee_id = public.get_my_employee_id()
      OR public.is_hr_or_above()
    )
  );

CREATE POLICY documents_write_own ON public.documents
  FOR INSERT WITH CHECK (
    company_id = public.get_my_company_id()
    AND (employee_id = public.get_my_employee_id() OR public.is_hr_or_above())
  );

CREATE POLICY documents_update ON public.documents
  FOR UPDATE USING (
    company_id = public.get_my_company_id()
    AND (employee_id = public.get_my_employee_id() OR public.is_hr_or_above())
  ) WITH CHECK (
    company_id = public.get_my_company_id()
    AND (employee_id = public.get_my_employee_id() OR public.is_hr_or_above())
  );

CREATE POLICY documents_delete ON public.documents
  FOR DELETE USING (
    public.is_hr_or_above()
    AND company_id = public.get_my_company_id()
  );

-- ══════════════ LEAVE_APPROVERS ══════════════
CREATE POLICY leave_approvers_read ON public.leave_approvers
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      approver_id = auth.uid()
      OR public.is_hr_or_above()
    )
  );

CREATE POLICY leave_approvers_write ON public.leave_approvers
  FOR ALL USING (public.is_hr_or_above())
  WITH CHECK (public.is_hr_or_above());

-- ══════════════ AUDIT_LOGS ══════════════
CREATE POLICY audit_logs_read ON public.audit_logs
  FOR SELECT USING (
    public.is_company_admin_or_above()
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND company_id = public.get_my_company_id()
  );

-- ══════════════ ACTIVITY_LOGS ══════════════
CREATE POLICY activity_logs_read_own ON public.activity_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY activity_logs_read_admin ON public.activity_logs
  FOR SELECT USING (public.is_company_admin_or_above());

CREATE POLICY activity_logs_insert ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ══════════════ AUDIT_LOG_POLICIES ══════════════
CREATE POLICY audit_log_policies_read ON public.audit_log_policies
  FOR SELECT USING (
    public.is_company_admin_or_above()
    AND company_id = public.get_my_company_id()
  );

CREATE POLICY audit_log_policies_write ON public.audit_log_policies
  FOR ALL USING (public.is_company_admin_or_above())
  WITH CHECK (public.is_company_admin_or_above());

-- ─────────────────────────────────────────
-- STEP 5: Performance indexes for RLS lookups
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_id           ON public.users(id);
CREATE INDEX IF NOT EXISTS idx_employees_email    ON public.employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_company  ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee    ON public.leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_employee   ON public.payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_emp     ON public.attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_company  ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON public.documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_elb_employee       ON public.employee_leave_balance(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id);

