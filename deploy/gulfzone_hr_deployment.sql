-- ============================================================================
-- GulfZone HR Management System — Full Deployment Script
-- ============================================================================
-- Target      : Supabase / PostgreSQL 15+
-- Generated   : 2026-06-06
-- Contents    : Extensions, Tables, Constraints, Indexes, Functions, RLS,
--               Views, Storage bucket + policies, and seed/business data.
--
-- USAGE
--   1. Create a fresh Supabase project.
--   2. Open SQL Editor → paste this entire file → Run.
--      (Idempotent: safe to re-run — uses IF NOT EXISTS / ON CONFLICT.)
--   3. Recreate the Auth users (see "AUTH USERS" note at the bottom) so that
--      the application logins map to the public.users rows seeded here.
--   4. Enable "Leaked password protection" in Auth → Providers (recommended).
--
-- NOTE ON RLS HELPER FUNCTIONS
--   The is_*/get_my_* helper functions are SECURITY DEFINER by design — they
--   are referenced inside RLS policies and must bypass RLS to avoid recursion.
--   EXECUTE is granted to `authenticated` (required) and revoked from `anon`.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  email character varying NOT NULL,
  phone character varying,
  address text,
  city character varying,
  country character varying,
  industry character varying,
  founded_year integer,
  employee_count integer DEFAULT 0,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  email character varying NOT NULL,
  first_name character varying,
  last_name character varying,
  role character varying DEFAULT 'employee'::character varying,
  company_id uuid,
  is_temporary_password boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  company_id uuid,
  is_system boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.modules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  icon character varying,
  path character varying,
  order_index integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  is_system boolean DEFAULT true,
  updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  role_id uuid NOT NULL,
  resource character varying NOT NULL,
  action character varying NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.role_modules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  role_id uuid NOT NULL,
  module_id uuid NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  company_id uuid NOT NULL,
  assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  assigned_by uuid
);

CREATE TABLE IF NOT EXISTS public.user_companies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  assigned_at timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.employee_grades (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  base_salary numeric(12,2),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  level integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  days_allocated integer,
  is_paid boolean DEFAULT true,
  requires_approval boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  days_per_year integer NOT NULL DEFAULT 0,
  allow_half_day boolean NOT NULL DEFAULT false,
  color character varying(7) DEFAULT '#3B82F6'::character varying,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying NOT NULL,
  phone character varying,
  "position" character varying,
  department character varying,
  date_of_joining date,
  date_of_birth date,
  address text,
  city character varying,
  country character varying,
  salary numeric(12,2),
  employment_type character varying,
  status character varying DEFAULT 'active'::character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  grade_id uuid,
  user_id uuid,
  manager_id uuid
);

CREATE TABLE IF NOT EXISTS public.grade_salary_config (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  grade_id uuid NOT NULL,
  salary_component character varying NOT NULL,
  amount numeric(12,2),
  is_deduction boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  salary numeric(12,2) NOT NULL,
  currency character varying(3) NOT NULL DEFAULT 'AED'::character varying,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  company_id uuid
);

CREATE TABLE IF NOT EXISTS public.grade_benefits (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  grade_id uuid NOT NULL,
  benefit_type character varying NOT NULL,
  benefit_value numeric(12,2),
  description text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  company_id uuid,
  value_type character varying DEFAULT 'fixed'::character varying,
  currency character varying DEFAULT 'AED'::character varying,
  active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.grade_leave_config (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  grade_id uuid NOT NULL,
  leave_type_id uuid NOT NULL,
  days_allocated integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  company_id uuid,
  days_per_year integer,
  carry_forward_days integer DEFAULT 0,
  carry_forward_expiry_months integer DEFAULT 3,
  year integer,
  updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  date date NOT NULL,
  check_in time without time zone,
  check_out time without time zone,
  status character varying,
  notes text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.leaves (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  leave_type character varying,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer,
  reason text,
  status character varying DEFAULT 'pending'::character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  requested_by uuid,
  approved_by uuid,
  approval_date timestamp without time zone,
  manager_comments text,
  approval_status character varying,
  rejection_reason text,
  is_comp_off boolean DEFAULT false,
  comp_off_request_id uuid,
  company_id uuid
);

CREATE TABLE IF NOT EXISTS public.leave_approvers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  approver_id uuid NOT NULL,
  leave_type character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  approval_level integer DEFAULT 1,
  active boolean DEFAULT true,
  updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_leave_balance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  leave_type_id uuid NOT NULL,
  year integer NOT NULL,
  days_allocated integer,
  days_used integer DEFAULT 0,
  days_remaining integer,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  total_days integer,
  used_days integer,
  pending_days integer DEFAULT 0,
  remaining_days integer,
  last_updated timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  employee_id uuid NOT NULL,
  month character varying,
  salary numeric(12,2),
  bonus numeric(12,2) DEFAULT 0,
  deductions numeric(12,2) DEFAULT 0,
  net_pay numeric(12,2),
  status character varying DEFAULT 'draft'::character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  leave_deduction_days numeric DEFAULT 0,
  leave_deduction_amount numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.employee_leave_deduction_tracking (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  payroll_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  leave_type character varying,
  days_deducted integer,
  amount_deducted numeric(12,2),
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  year integer,
  total_deducted_days numeric DEFAULT 0,
  updated_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  employee_id uuid,
  document_type character varying NOT NULL,
  document_number character varying NOT NULL,
  issue_date date NOT NULL,
  expiry_date date NOT NULL,
  issuing_authority character varying NOT NULL,
  file_url character varying,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  company_id uuid,
  action character varying NOT NULL,
  entity_type character varying NOT NULL DEFAULT ''::character varying,
  entity_id uuid,
  changes jsonb,
  ip_address character varying,
  user_agent text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  resource_type character varying,
  resource_id uuid,
  resource_name character varying,
  old_values jsonb,
  new_values jsonb,
  status character varying DEFAULT 'success'::character varying,
  error_message text
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  company_id uuid,
  activity_type character varying NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  ip_address character varying
);

CREATE TABLE IF NOT EXISTS public.audit_log_policies (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid,
  resource_type character varying,
  retention_days integer DEFAULT 90,
  archive_enabled boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. PRIMARY KEYS
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table OR invalid_table_definition THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.roles ADD CONSTRAINT roles_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.modules ADD CONSTRAINT modules_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_modules ADD CONSTRAINT role_modules_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_companies ADD CONSTRAINT user_companies_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_grades ADD CONSTRAINT employee_grades_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_salary_config ADD CONSTRAINT grade_salary_config_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_benefits ADD CONSTRAINT grade_benefits_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.attendance ADD CONSTRAINT attendance_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leaves ADD CONSTRAINT leaves_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_leave_balance ADD CONSTRAINT employee_leave_balance_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.payroll ADD CONSTRAINT payroll_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_leave_deduction_tracking ADD CONSTRAINT employee_leave_deduction_tracking_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.audit_log_policies ADD CONSTRAINT audit_log_policies_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. UNIQUE CONSTRAINTS
-- ----------------------------------------------------------------------------
DO $$ BEGIN ALTER TABLE public.companies ADD CONSTRAINT companies_email_key UNIQUE (email); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.roles ADD CONSTRAINT roles_name_key UNIQUE (name); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.modules ADD CONSTRAINT modules_name_key UNIQUE (name); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_modules ADD CONSTRAINT role_modules_role_id_module_id_key UNIQUE (role_id, module_id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_id_resource_action_key UNIQUE (role_id, resource, action); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_companies ADD CONSTRAINT user_companies_user_id_company_id_key UNIQUE (user_id, company_id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_id_company_id_key UNIQUE (user_id, role_id, company_id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_grades ADD CONSTRAINT employee_grades_company_id_name_key UNIQUE (company_id, name); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_email_key UNIQUE (email); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_benefits ADD CONSTRAINT grade_benefits_grade_id_benefit_type_key UNIQUE (grade_id, benefit_type); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_grade_id_leave_type_id_key UNIQUE (grade_id, leave_type_id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_salary_config ADD CONSTRAINT grade_salary_config_grade_id_salary_component_key UNIQUE (grade_id, salary_component); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_company_id_name_key UNIQUE (company_id, name); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_company_id_employee_id_approver_id_leave_ty_key UNIQUE (company_id, employee_id, approver_id, leave_type); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_leave_balance ADD CONSTRAINT employee_leave_balance_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year); EXCEPTION WHEN others THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 4. FOREIGN KEYS
-- ----------------------------------------------------------------------------
DO $$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.roles ADD CONSTRAINT roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_modules ADD CONSTRAINT role_modules_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.role_modules ADD CONSTRAINT role_modules_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id); EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_companies ADD CONSTRAINT user_companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_companies ADD CONSTRAINT user_companies_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_grades ADD CONSTRAINT employee_grades_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES employee_grades(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_salary_config ADD CONSTRAINT grade_salary_config_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES employee_grades(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_salary_config ADD CONSTRAINT grade_salary_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_benefits ADD CONSTRAINT grade_benefits_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES employee_grades(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_benefits ADD CONSTRAINT grade_benefits_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES employee_grades(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.attendance ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leaves ADD CONSTRAINT leaves_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leaves ADD CONSTRAINT leaves_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_leave_balance ADD CONSTRAINT employee_leave_balance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_leave_balance ADD CONSTRAINT employee_leave_balance_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.payroll ADD CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_leave_deduction_tracking ADD CONSTRAINT employee_leave_deduction_tracking_payroll_id_fkey FOREIGN KEY (payroll_id) REFERENCES payroll(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.employee_leave_deduction_tracking ADD CONSTRAINT employee_leave_deduction_tracking_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.documents ADD CONSTRAINT documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.documents ADD CONSTRAINT documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.audit_log_policies ADD CONSTRAINT audit_log_policies_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $$;

COMMIT;

-- ----------------------------------------------------------------------------
-- 5. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON public.activity_logs USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance USING btree (date);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance USING btree (employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON public.attendance USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_policies_company_id ON public.audit_log_policies USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_companies_email ON public.companies USING btree (email);
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies USING btree (name);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON public.documents USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON public.documents USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON public.documents USING btree (expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_grades_company_id ON public.employee_grades USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_elb_leave_type_id ON public.employee_leave_balance USING btree (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_balance_year ON public.employee_leave_balance USING btree (year);
CREATE INDEX IF NOT EXISTS idx_leave_balance_emp ON public.employee_leave_balance USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_deduction_employee_id ON public.employee_leave_deduction_tracking USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_deduction_payroll_id ON public.employee_leave_deduction_tracking USING btree (payroll_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees USING btree (department);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees USING btree (email);
CREATE INDEX IF NOT EXISTS idx_employees_grade_id ON public.employees USING btree (grade_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON public.employees USING btree (manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees USING btree (status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_grade_benefits_company ON public.grade_benefits USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_grade_benefits_grade ON public.grade_benefits USING btree (grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_leave_company ON public.grade_leave_config USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_grade_leave_config_leave_type_id ON public.grade_leave_config USING btree (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_grade_leave_grade ON public.grade_leave_config USING btree (grade_id);
CREATE INDEX IF NOT EXISTS idx_grade_salary_config_company_id ON public.grade_salary_config USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_grade_salary_grade ON public.grade_salary_config USING btree (grade_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvers_approver_id ON public.leave_approvers USING btree (approver_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvers_company_id ON public.leave_approvers USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvers_employee_id ON public.leave_approvers USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_company_id ON public.leave_types USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_leaves_approval_status ON public.leaves USING btree (approval_status);
CREATE INDEX IF NOT EXISTS idx_leaves_company_id ON public.leaves USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON public.leaves USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_leaves_start_date ON public.leaves USING btree (start_date);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON public.leaves USING btree (status);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_id ON public.payroll USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON public.payroll USING btree (month);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON public.payroll USING btree (status);
CREATE INDEX IF NOT EXISTS idx_role_modules_module_id ON public.role_modules USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_role_modules_role_id ON public.role_modules USING btree (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_resource ON public.role_permissions USING btree (resource);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);
CREATE INDEX IF NOT EXISTS idx_roles_company_id ON public.roles USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles USING btree (name);
CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON public.user_companies USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON public.user_companies USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON public.user_roles USING btree (assigned_by);
CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON public.user_roles USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles USING btree (role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users USING btree (company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);

-- ----------------------------------------------------------------------------
-- 6. RLS HELPER FUNCTIONS (SECURITY DEFINER, pinned search_path)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_company_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT company_id FROM public.users WHERE id = auth.uid()),
    (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_primary = TRUE LIMIT 1),
    (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() LIMIT 1)
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_my_employee_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id FROM public.employees e
  JOIN public.users u ON u.email = e.email
  WHERE u.id = auth.uid()
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.get_my_employee_ids_as_manager()
 RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id FROM public.employees e
  WHERE e.user_id = auth.uid()
     OR e.manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin')
$function$;

CREATE OR REPLACE FUNCTION public.is_company_admin_or_above()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('Super Admin', 'Company Admin'))
$function$;

CREATE OR REPLACE FUNCTION public.is_hr_or_above()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('Super Admin', 'Company Admin', 'HR Manager'))
$function$;

CREATE OR REPLACE FUNCTION public.is_manager_or_above()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('Super Admin', 'Company Admin', 'HR Manager', 'Department Manager', 'Manager'))
$function$;

CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND company_id = p_company_id)
$function$;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id uuid, p_company_id uuid, p_action character varying, p_resource_type character varying,
  p_resource_id uuid DEFAULT NULL, p_resource_name character varying DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL, p_new_values jsonb DEFAULT NULL,
  p_ip_address character varying DEFAULT NULL, p_user_agent text DEFAULT NULL,
  p_status character varying DEFAULT 'success', p_error_message text DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, company_id, action, entity_type, entity_id,
    resource_type, resource_id, resource_name, old_values, new_values,
    ip_address, user_agent, status, error_message)
  VALUES (
    p_user_id, p_company_id, p_action, COALESCE(p_resource_type, ''), p_resource_id,
    p_resource_type, p_resource_id, p_resource_name, p_old_values, p_new_values,
    p_ip_address, p_user_agent, COALESCE(p_status, 'success'), p_error_message)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$function$;

-- Function execution grants (anon revoked; authenticated required for RLS)
REVOKE EXECUTE ON FUNCTION public.get_my_company_id(), public.is_super_admin(),
  public.is_company_admin_or_above(), public.is_hr_or_above(), public.is_manager_or_above(),
  public.get_my_employee_id(), public.user_has_company_access(uuid),
  public.get_my_employee_ids_as_manager() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_company_id(), public.is_super_admin(),
  public.is_company_admin_or_above(), public.is_hr_or_above(), public.is_manager_or_above(),
  public.get_my_employee_id(), public.user_has_company_access(uuid),
  public.get_my_employee_ids_as_manager() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid,uuid,varchar,varchar,uuid,varchar,jsonb,jsonb,varchar,text,varchar,text) FROM anon, authenticated, public;
GRANT  EXECUTE ON FUNCTION public.log_audit_event(uuid,uuid,varchar,varchar,uuid,varchar,jsonb,jsonb,varchar,text,varchar,text) TO service_role;

-- Table privileges
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ----------------------------------------------------------------------------
-- 7. ENABLE ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.companies                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_modules                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_grades                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_salary_config               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_benefits                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_leave_config                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves                            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_approvers                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_balance            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leave_deduction_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log_policies                ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 8. RLS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS activity_logs_insert ON public.activity_logs;
CREATE POLICY activity_logs_insert ON public.activity_logs FOR INSERT TO public WITH CHECK (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS activity_logs_read ON public.activity_logs;
CREATE POLICY activity_logs_read ON public.activity_logs FOR SELECT TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS attendance_delete ON public.attendance;
CREATE POLICY attendance_delete ON public.attendance FOR DELETE TO public USING ((is_hr_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS attendance_insert ON public.attendance;
CREATE POLICY attendance_insert ON public.attendance FOR INSERT TO public WITH CHECK ((is_hr_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS attendance_read ON public.attendance;
CREATE POLICY attendance_read ON public.attendance FOR SELECT TO public USING ((is_manager_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS attendance_update ON public.attendance;
CREATE POLICY attendance_update ON public.attendance FOR UPDATE TO public USING ((is_hr_or_above() OR (employee_id = get_my_employee_id()))) WITH CHECK ((is_hr_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS audit_log_policies_delete ON public.audit_log_policies;
CREATE POLICY audit_log_policies_delete ON public.audit_log_policies FOR DELETE TO public USING (is_company_admin_or_above());
DROP POLICY IF EXISTS audit_log_policies_insert ON public.audit_log_policies;
CREATE POLICY audit_log_policies_insert ON public.audit_log_policies FOR INSERT TO public WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS audit_log_policies_select ON public.audit_log_policies;
CREATE POLICY audit_log_policies_select ON public.audit_log_policies FOR SELECT TO public USING (is_company_admin_or_above());
DROP POLICY IF EXISTS audit_log_policies_update ON public.audit_log_policies;
CREATE POLICY audit_log_policies_update ON public.audit_log_policies FOR UPDATE TO public USING (is_company_admin_or_above()) WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT TO public WITH CHECK (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS audit_logs_read ON public.audit_logs;
CREATE POLICY audit_logs_read ON public.audit_logs FOR SELECT TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS companies_delete ON public.companies;
CREATE POLICY companies_delete ON public.companies FOR DELETE TO public USING (is_super_admin());
DROP POLICY IF EXISTS companies_insert ON public.companies;
CREATE POLICY companies_insert ON public.companies FOR INSERT TO public WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS companies_read ON public.companies;
CREATE POLICY companies_read ON public.companies FOR SELECT TO public USING ((((select auth.uid()) IS NOT NULL) AND (is_super_admin() OR user_has_company_access(id))));
DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies FOR UPDATE TO public USING ((is_super_admin() OR (is_company_admin_or_above() AND user_has_company_access(id)))) WITH CHECK ((is_super_admin() OR (is_company_admin_or_above() AND user_has_company_access(id))));
DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_delete ON public.documents FOR DELETE TO public USING ((((select auth.uid()) IS NOT NULL) AND (is_super_admin() OR (is_hr_or_above() AND user_has_company_access(company_id)))));
DROP POLICY IF EXISTS documents_read ON public.documents;
CREATE POLICY documents_read ON public.documents FOR SELECT TO public USING ((((select auth.uid()) IS NOT NULL) AND (is_super_admin() OR user_has_company_access(company_id))));
DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents FOR UPDATE TO public USING ((((select auth.uid()) IS NOT NULL) AND (is_super_admin() OR (user_has_company_access(company_id) AND (is_hr_or_above() OR (employee_id = get_my_employee_id())))))) WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (is_super_admin() OR (user_has_company_access(company_id) AND (is_hr_or_above() OR (employee_id = get_my_employee_id()))))));
DROP POLICY IF EXISTS documents_write ON public.documents;
CREATE POLICY documents_write ON public.documents FOR INSERT TO public WITH CHECK ((((select auth.uid()) IS NOT NULL) AND (is_super_admin() OR (user_has_company_access(company_id) AND (is_hr_or_above() OR (employee_id = get_my_employee_id()))))));
DROP POLICY IF EXISTS employee_grades_delete ON public.employee_grades;
CREATE POLICY employee_grades_delete ON public.employee_grades FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS employee_grades_insert ON public.employee_grades;
CREATE POLICY employee_grades_insert ON public.employee_grades FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS employee_grades_read ON public.employee_grades;
CREATE POLICY employee_grades_read ON public.employee_grades FOR SELECT TO public USING ((is_hr_or_above() OR (company_id = get_my_company_id()) OR (((select auth.uid()) IS NOT NULL) AND (id IN (SELECT employees.grade_id FROM employees WHERE ((employees.user_id = (select auth.uid())) AND (employees.grade_id IS NOT NULL)))))));
DROP POLICY IF EXISTS employee_grades_update ON public.employee_grades;
CREATE POLICY employee_grades_update ON public.employee_grades FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS employee_leave_balance_delete ON public.employee_leave_balance;
CREATE POLICY employee_leave_balance_delete ON public.employee_leave_balance FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS employee_leave_balance_insert ON public.employee_leave_balance;
CREATE POLICY employee_leave_balance_insert ON public.employee_leave_balance FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS employee_leave_balance_update ON public.employee_leave_balance;
CREATE POLICY employee_leave_balance_update ON public.employee_leave_balance FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS leave_balance_read ON public.employee_leave_balance;
CREATE POLICY leave_balance_read ON public.employee_leave_balance FOR SELECT TO public USING ((is_hr_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS employee_leave_deduction_tracking_delete ON public.employee_leave_deduction_tracking;
CREATE POLICY employee_leave_deduction_tracking_delete ON public.employee_leave_deduction_tracking FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS employee_leave_deduction_tracking_insert ON public.employee_leave_deduction_tracking;
CREATE POLICY employee_leave_deduction_tracking_insert ON public.employee_leave_deduction_tracking FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS employee_leave_deduction_tracking_update ON public.employee_leave_deduction_tracking;
CREATE POLICY employee_leave_deduction_tracking_update ON public.employee_leave_deduction_tracking FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS leave_deduction_read ON public.employee_leave_deduction_tracking;
CREATE POLICY leave_deduction_read ON public.employee_leave_deduction_tracking FOR SELECT TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS employees_delete ON public.employees;
CREATE POLICY employees_delete ON public.employees FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS employees_insert ON public.employees;
CREATE POLICY employees_insert ON public.employees FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS employees_read ON public.employees;
CREATE POLICY employees_read ON public.employees FOR SELECT TO public USING ((is_hr_or_above() OR (company_id = get_my_company_id()) OR (id = get_my_employee_id())));
DROP POLICY IF EXISTS employees_update ON public.employees;
CREATE POLICY employees_update ON public.employees FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS grade_benefits_delete ON public.grade_benefits;
CREATE POLICY grade_benefits_delete ON public.grade_benefits FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS grade_benefits_insert ON public.grade_benefits;
CREATE POLICY grade_benefits_insert ON public.grade_benefits FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS grade_benefits_read ON public.grade_benefits;
CREATE POLICY grade_benefits_read ON public.grade_benefits FOR SELECT TO public USING ((is_hr_or_above() OR (((select auth.uid()) IS NOT NULL) AND (grade_id IN (SELECT employees.grade_id FROM employees WHERE ((employees.user_id = (select auth.uid())) AND (employees.grade_id IS NOT NULL)))))));
DROP POLICY IF EXISTS grade_benefits_update ON public.grade_benefits;
CREATE POLICY grade_benefits_update ON public.grade_benefits FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS grade_leave_config_delete ON public.grade_leave_config;
CREATE POLICY grade_leave_config_delete ON public.grade_leave_config FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS grade_leave_config_insert ON public.grade_leave_config;
CREATE POLICY grade_leave_config_insert ON public.grade_leave_config FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS grade_leave_config_update ON public.grade_leave_config;
CREATE POLICY grade_leave_config_update ON public.grade_leave_config FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS grade_leave_read ON public.grade_leave_config;
CREATE POLICY grade_leave_read ON public.grade_leave_config FOR SELECT TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS grade_salary_config_delete ON public.grade_salary_config;
CREATE POLICY grade_salary_config_delete ON public.grade_salary_config FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS grade_salary_config_insert ON public.grade_salary_config;
CREATE POLICY grade_salary_config_insert ON public.grade_salary_config FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS grade_salary_config_update ON public.grade_salary_config;
CREATE POLICY grade_salary_config_update ON public.grade_salary_config FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS grade_salary_read ON public.grade_salary_config;
CREATE POLICY grade_salary_read ON public.grade_salary_config FOR SELECT TO public USING ((is_hr_or_above() OR (((select auth.uid()) IS NOT NULL) AND (grade_id IN (SELECT employees.grade_id FROM employees WHERE ((employees.user_id = (select auth.uid())) AND (employees.grade_id IS NOT NULL)))))));
DROP POLICY IF EXISTS leave_approvers_delete ON public.leave_approvers;
CREATE POLICY leave_approvers_delete ON public.leave_approvers FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS leave_approvers_insert ON public.leave_approvers;
CREATE POLICY leave_approvers_insert ON public.leave_approvers FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS leave_approvers_read ON public.leave_approvers;
CREATE POLICY leave_approvers_read ON public.leave_approvers FOR SELECT TO public USING (is_manager_or_above());
DROP POLICY IF EXISTS leave_approvers_update ON public.leave_approvers;
CREATE POLICY leave_approvers_update ON public.leave_approvers FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS leave_types_delete ON public.leave_types;
CREATE POLICY leave_types_delete ON public.leave_types FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS leave_types_insert ON public.leave_types;
CREATE POLICY leave_types_insert ON public.leave_types FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS leave_types_read ON public.leave_types;
CREATE POLICY leave_types_read ON public.leave_types FOR SELECT TO public USING ((((select auth.uid()) IS NOT NULL) AND (company_id = get_my_company_id())));
DROP POLICY IF EXISTS leave_types_update ON public.leave_types;
CREATE POLICY leave_types_update ON public.leave_types FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS leaves_delete ON public.leaves;
CREATE POLICY leaves_delete ON public.leaves FOR DELETE TO public USING ((is_hr_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS leaves_insert ON public.leaves;
CREATE POLICY leaves_insert ON public.leaves FOR INSERT TO public WITH CHECK ((is_hr_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS leaves_read ON public.leaves;
CREATE POLICY leaves_read ON public.leaves FOR SELECT TO public USING ((is_hr_or_above() OR (employee_id = get_my_employee_id()) OR (company_id = get_my_company_id())));
DROP POLICY IF EXISTS leaves_update ON public.leaves;
CREATE POLICY leaves_update ON public.leaves FOR UPDATE TO public USING ((is_hr_or_above() OR (employee_id = get_my_employee_id()))) WITH CHECK ((is_hr_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS modules_delete ON public.modules;
CREATE POLICY modules_delete ON public.modules FOR DELETE TO public USING (is_super_admin());
DROP POLICY IF EXISTS modules_insert ON public.modules;
CREATE POLICY modules_insert ON public.modules FOR INSERT TO public WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS modules_read ON public.modules;
CREATE POLICY modules_read ON public.modules FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS modules_update ON public.modules;
CREATE POLICY modules_update ON public.modules FOR UPDATE TO public USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS payroll_delete ON public.payroll;
CREATE POLICY payroll_delete ON public.payroll FOR DELETE TO public USING (is_hr_or_above());
DROP POLICY IF EXISTS payroll_insert ON public.payroll;
CREATE POLICY payroll_insert ON public.payroll FOR INSERT TO public WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS payroll_read ON public.payroll;
CREATE POLICY payroll_read ON public.payroll FOR SELECT TO public USING ((is_hr_or_above() OR (employee_id = get_my_employee_id())));
DROP POLICY IF EXISTS payroll_update ON public.payroll;
CREATE POLICY payroll_update ON public.payroll FOR UPDATE TO public USING (is_hr_or_above()) WITH CHECK (is_hr_or_above());
DROP POLICY IF EXISTS role_modules_delete ON public.role_modules;
CREATE POLICY role_modules_delete ON public.role_modules FOR DELETE TO public USING (is_company_admin_or_above());
DROP POLICY IF EXISTS role_modules_insert ON public.role_modules;
CREATE POLICY role_modules_insert ON public.role_modules FOR INSERT TO public WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS role_modules_read ON public.role_modules;
CREATE POLICY role_modules_read ON public.role_modules FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS role_modules_update ON public.role_modules;
CREATE POLICY role_modules_update ON public.role_modules FOR UPDATE TO public USING (is_company_admin_or_above()) WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS role_permissions_delete ON public.role_permissions;
CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE TO public USING (is_company_admin_or_above());
DROP POLICY IF EXISTS role_permissions_insert ON public.role_permissions;
CREATE POLICY role_permissions_insert ON public.role_permissions FOR INSERT TO public WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS role_permissions_update ON public.role_permissions;
CREATE POLICY role_permissions_update ON public.role_permissions FOR UPDATE TO public USING (is_company_admin_or_above()) WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS roles_delete ON public.roles;
CREATE POLICY roles_delete ON public.roles FOR DELETE TO public USING ((is_company_admin_or_above() AND (is_system = false)));
DROP POLICY IF EXISTS roles_insert ON public.roles;
CREATE POLICY roles_insert ON public.roles FOR INSERT TO public WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles FOR SELECT TO public USING (((select auth.uid()) IS NOT NULL));
DROP POLICY IF EXISTS roles_update ON public.roles;
CREATE POLICY roles_update ON public.roles FOR UPDATE TO public USING ((is_company_admin_or_above() AND (is_system = false))) WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS user_companies_delete ON public.user_companies;
CREATE POLICY user_companies_delete ON public.user_companies FOR DELETE TO public USING (is_company_admin_or_above());
DROP POLICY IF EXISTS user_companies_insert ON public.user_companies;
CREATE POLICY user_companies_insert ON public.user_companies FOR INSERT TO public WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS user_companies_read ON public.user_companies;
CREATE POLICY user_companies_read ON public.user_companies FOR SELECT TO public USING (((user_id = (select auth.uid())) OR is_company_admin_or_above()));
DROP POLICY IF EXISTS user_companies_update ON public.user_companies;
CREATE POLICY user_companies_update ON public.user_companies FOR UPDATE TO public USING (is_company_admin_or_above()) WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;
CREATE POLICY user_roles_delete ON public.user_roles FOR DELETE TO public USING (is_company_admin_or_above());
DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
CREATE POLICY user_roles_insert ON public.user_roles FOR INSERT TO public WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS user_roles_read ON public.user_roles;
CREATE POLICY user_roles_read ON public.user_roles FOR SELECT TO public USING (((user_id = (select auth.uid())) OR is_hr_or_above()));
DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
CREATE POLICY user_roles_update ON public.user_roles FOR UPDATE TO public USING (is_company_admin_or_above()) WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users FOR DELETE TO public USING (is_company_admin_or_above());
DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users FOR INSERT TO public WITH CHECK (is_company_admin_or_above());
DROP POLICY IF EXISTS users_read ON public.users;
CREATE POLICY users_read ON public.users FOR SELECT TO public USING (((id = (select auth.uid())) OR is_hr_or_above()));
DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE TO public USING (is_company_admin_or_above()) WITH CHECK (is_company_admin_or_above());

-- ----------------------------------------------------------------------------
-- 9. VIEWS (security_invoker — caller's RLS applies)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.audit_log_search WITH (security_invoker=on) AS
  SELECT al.id, al.user_id,
    concat(u.first_name, ' ', u.last_name) AS user_name,
    al.company_id, c.name AS company_name, al.action,
    COALESCE(al.resource_type, al.entity_type) AS resource_type,
    COALESCE(al.resource_id, al.entity_id) AS resource_id,
    al.resource_name,
    COALESCE(al.status, 'success'::character varying) AS status,
    al.created_at, al.ip_address,
    ((al.old_values IS NOT NULL) OR (al.new_values IS NOT NULL) OR (al.changes IS NOT NULL)) AS has_changes
  FROM ((audit_logs al
    LEFT JOIN users u ON ((al.user_id = u.id)))
    LEFT JOIN companies c ON ((al.company_id = c.id)));

CREATE OR REPLACE VIEW public.grade_summary WITH (security_invoker=on) AS
  SELECT g.id, g.company_id, g.name, g.level, g.description, g.active, g.created_at, g.updated_at,
    count(e.id) AS employee_count, s.salary, s.currency
  FROM ((employee_grades g
    LEFT JOIN employees e ON (((e.grade_id = g.id) AND ((e.status)::text = 'active'::text))))
    LEFT JOIN LATERAL ( SELECT sc.salary, sc.currency FROM grade_salary_config sc
      WHERE ((sc.grade_id = g.id) AND (sc.effective_from <= CURRENT_DATE) AND ((sc.effective_to IS NULL) OR (sc.effective_to >= CURRENT_DATE)))
      ORDER BY sc.effective_from DESC LIMIT 1) s ON (true))
  GROUP BY g.id, g.company_id, g.name, g.level, g.description, g.active, g.created_at, g.updated_at, s.salary, s.currency;

CREATE OR REPLACE VIEW public.leave_dashboard WITH (security_invoker=on) AS
  SELECT e.id AS employee_id, concat(e.first_name, ' ', e.last_name) AS employee_name,
    e.company_id, lt.name AS leave_type,
    COALESCE(elb.total_days, elb.days_allocated) AS total_days,
    COALESCE(elb.used_days, elb.days_used) AS used_days,
    COALESCE(elb.pending_days, 0) AS pending_days,
    COALESCE(elb.remaining_days, elb.days_remaining) AS remaining_days,
    elb.year,
    CASE WHEN (COALESCE(elb.total_days, elb.days_allocated, 0) = 0) THEN (0)::numeric
         ELSE round((((COALESCE(elb.used_days, elb.days_used, 0))::numeric / (NULLIF(COALESCE(elb.total_days, elb.days_allocated), 0))::numeric) * (100)::numeric), 1)
    END AS usage_percentage
  FROM ((employees e
    JOIN employee_leave_balance elb ON ((elb.employee_id = e.id)))
    JOIN leave_types lt ON ((lt.id = elb.leave_type_id)));

GRANT SELECT ON public.audit_log_search, public.grade_summary, public.leave_dashboard TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. STORAGE (documents bucket + policies)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 5242880)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS documents_storage_select ON storage.objects;
DROP POLICY IF EXISTS documents_storage_insert ON storage.objects;
DROP POLICY IF EXISTS documents_storage_update ON storage.objects;
DROP POLICY IF EXISTS documents_storage_delete ON storage.objects;
CREATE POLICY documents_storage_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY documents_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY documents_storage_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents');
CREATE POLICY documents_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');

-- ----------------------------------------------------------------------------
-- 11. SEED & MASTER DATA (companies, roles, modules, users, grades, leave types)
-- ----------------------------------------------------------------------------
INSERT INTO public.companies SELECT * FROM json_populate_record(NULL::public.companies, '{"id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GulfZone","email":"accounts@gulfzoneae.com","phone":"+971000000000","address":null,"city":"Dubai","country":"UAE","industry":null,"founded_year":null,"employee_count":0,"created_at":"2026-06-05T11:48:47.601816","updated_at":"2026-06-05T11:48:47.601816"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles SELECT * FROM json_populate_record(NULL::public.roles, '{"id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","name":"Super Admin","description":"System administrator with full access","company_id":null,"is_system":true,"created_at":"2026-06-05T11:24:00.019296","updated_at":"2026-06-05T11:24:00.019296"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles SELECT * FROM json_populate_record(NULL::public.roles, '{"id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","name":"Company Admin","description":"Company administrator","company_id":null,"is_system":true,"created_at":"2026-06-05T11:24:00.019296","updated_at":"2026-06-05T11:24:00.019296"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles SELECT * FROM json_populate_record(NULL::public.roles, '{"id":"c4772f20-73de-4476-a5d0-5f7f23cab040","name":"HR Manager","description":"Human Resources Manager","company_id":null,"is_system":true,"created_at":"2026-06-05T11:24:00.019296","updated_at":"2026-06-05T11:24:00.019296"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles SELECT * FROM json_populate_record(NULL::public.roles, '{"id":"bfc0d225-98d9-47c6-b29b-4c15449d9753","name":"Employee","description":"Regular employee","company_id":null,"is_system":true,"created_at":"2026-06-05T11:24:00.019296","updated_at":"2026-06-05T11:24:00.019296"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.roles SELECT * FROM json_populate_record(NULL::public.roles, '{"id":"18615db2-d8bb-4e51-a065-748fd5fb9903","name":"Manager","description":"Department manager","company_id":null,"is_system":true,"created_at":"2026-06-05T11:24:00.019296","updated_at":"2026-06-05T11:24:00.019296"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"d13efe80-c235-40c3-9a0e-ea9e1ae89104","name":"Dashboard","description":"Main dashboard and analytics","icon":"LayoutDashboard","path":"/dashboard","order_index":1,"created_at":"2026-06-05T11:24:00.019296","is_system":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"35b8730b-9368-4976-b98a-27f88878a6b5","name":"Employees","description":"Employee management","icon":"Users","path":"/employees","order_index":2,"created_at":"2026-06-05T11:24:00.019296","is_system":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"e5106205-525d-419b-a6b7-4fb3ddefcec2","name":"Companies","description":"Company management","icon":"Building2","path":"/companies","order_index":3,"created_at":"2026-06-05T11:24:00.019296","is_system":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"fc6d4d2e-a8d7-4283-ad3b-0663b5d10e3c","name":"Attendance","description":"Attendance tracking","icon":"Clock","path":"/attendance","order_index":4,"created_at":"2026-06-05T11:24:00.019296","is_system":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"f175111e-3e20-4e7f-80ef-63de46adaad2","name":"Leave","description":"Leave management","icon":"Calendar","path":"/leave","order_index":5,"created_at":"2026-06-05T11:24:00.019296","is_system":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"cc9b06d6-394b-4322-8933-95283677a33e","name":"Payroll","description":"Payroll processing","icon":"DollarSign","path":"/payroll","order_index":6,"created_at":"2026-06-05T11:24:00.019296","is_system":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"0e8a9732-4048-4c6b-ba3e-dc2cd7b9ca7a","name":"Reports","description":"Reports and analytics","icon":"BarChart3","path":"/reports","order_index":7,"created_at":"2026-06-05T11:24:00.019296","is_system":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"111ccdf1-5f5f-4c66-a8e4-d9f771bac96b","name":"Settings","description":"System settings","icon":"Settings","path":"/settings","order_index":8,"created_at":"2026-06-05T11:24:00.019296","is_system":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"9a576e8c-3f17-418d-a76b-2f5c32dfd684","name":"RBAC Management","description":"Manage roles and permissions","icon":"Lock","path":"/admin/rbac","order_index":10,"created_at":"2026-06-06T06:12:51.650498","is_system":true,"updated_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"6be57838-8862-4845-bbaa-6555a4670648","name":"Audit Logs","description":"View system audit logs","icon":"Shield","path":"/admin/audit-logs","order_index":11,"created_at":"2026-06-06T06:12:51.650498","is_system":true,"updated_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"88a44dbf-3501-4ebd-935e-043ce2f73398","name":"Leave Approvals","description":"Approve or reject leave requests","icon":"CheckCircle","path":"/admin/leave-approvals","order_index":12,"created_at":"2026-06-06T06:12:51.650498","is_system":true,"updated_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.modules SELECT * FROM json_populate_record(NULL::public.modules, '{"id":"8cae3b87-5f52-4b83-8167-42570fb0c5d6","name":"Grade Configuration","description":"Manage employee grades","icon":"GraduationCap","path":"/admin/grades","order_index":13,"created_at":"2026-06-06T06:12:51.650498","is_system":true,"updated_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users SELECT * FROM json_populate_record(NULL::public.users, '{"id":"607cbd34-3ec6-4663-a83c-4bcd27328fa1","email":"jasimmahamoodkm@gmail.com","first_name":"Jasim","last_name":"Mahmood","role":"super_admin","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_temporary_password":false,"created_at":"2026-06-05T12:59:00.372479","updated_at":"2026-06-05T12:59:00.372479"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users SELECT * FROM json_populate_record(NULL::public.users, '{"id":"e4d280f4-c55b-49d8-92f6-b48fafd184fd","email":"majid@gulfzoneae.com","first_name":"Majid","last_name":"Abdulla","role":"employee","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_temporary_password":false,"created_at":"2026-06-06T08:05:53.300122","updated_at":"2026-06-06T08:05:53.300122"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users SELECT * FROM json_populate_record(NULL::public.users, '{"id":"e4497f6e-adf9-4fcf-8a4a-81af382c3697","email":"salman@gulfzoneae.com","first_name":"Salman","last_name":"AKP","role":"employee","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_temporary_password":false,"created_at":"2026-06-06T08:48:22.682228","updated_at":"2026-06-06T08:48:22.682228"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users SELECT * FROM json_populate_record(NULL::public.users, '{"id":"625631e2-d318-464f-aff7-5f0eeba12b3b","email":"khalid@gulfzoneae.com","first_name":"Khalid","last_name":"AKP","role":"employee","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_temporary_password":false,"created_at":"2026-06-06T10:29:08.93323","updated_at":"2026-06-06T10:29:08.93323"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users SELECT * FROM json_populate_record(NULL::public.users, '{"id":"780338a0-54cd-4501-a879-5b9a41017454","email":"sameer@gulfzoneae.com","first_name":"Sameer","last_name":"Ahmad","role":"employee","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_temporary_password":false,"created_at":"2026-06-06T11:03:47.519233","updated_at":"2026-06-06T11:03:47.519233"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.users SELECT * FROM json_populate_record(NULL::public.users, '{"id":"8202813d-a56d-446c-81a8-49a643579f25","email":"latheef@gulfzoneae.com","first_name":"Latheef","last_name":"VP","role":"employee","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_temporary_password":false,"created_at":"2026-06-06T12:15:32.777821","updated_at":"2026-06-06T12:15:32.777821"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_companies SELECT * FROM json_populate_record(NULL::public.user_companies, '{"id":"d834578b-79af-46a7-b174-d623faf7ca0a","user_id":"607cbd34-3ec6-4663-a83c-4bcd27328fa1","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_primary":true,"created_at":"2026-06-05T13:08:11.401704","assigned_at":"2026-06-05T13:08:11.401704"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_companies SELECT * FROM json_populate_record(NULL::public.user_companies, '{"id":"7914d176-3537-43be-b6f9-27f776d094b5","user_id":"e4d280f4-c55b-49d8-92f6-b48fafd184fd","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_primary":true,"created_at":"2026-06-06T08:05:55.061909","assigned_at":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_companies SELECT * FROM json_populate_record(NULL::public.user_companies, '{"id":"00f02b78-1260-4830-a0c7-6a41f35d6fb2","user_id":"e4497f6e-adf9-4fcf-8a4a-81af382c3697","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_primary":true,"created_at":"2026-06-06T08:48:24.17434","assigned_at":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_companies SELECT * FROM json_populate_record(NULL::public.user_companies, '{"id":"f7ba4b8d-a0ad-4d54-a3da-5dade37c96ff","user_id":"625631e2-d318-464f-aff7-5f0eeba12b3b","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_primary":true,"created_at":"2026-06-06T10:29:10.561619","assigned_at":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_companies SELECT * FROM json_populate_record(NULL::public.user_companies, '{"id":"881c6256-9da9-4ce8-a42d-352b21c05e89","user_id":"780338a0-54cd-4501-a879-5b9a41017454","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_primary":true,"created_at":"2026-06-06T11:03:49.201218","assigned_at":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_companies SELECT * FROM json_populate_record(NULL::public.user_companies, '{"id":"ab4e9d81-b8b2-4b16-99a8-5c58c54f6dc1","user_id":"8202813d-a56d-446c-81a8-49a643579f25","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","is_primary":true,"created_at":"2026-06-06T12:15:34.544205","assigned_at":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles SELECT * FROM json_populate_record(NULL::public.user_roles, '{"id":"74da3802-1326-4449-b7e4-8efa6fc041c8","user_id":"607cbd34-3ec6-4663-a83c-4bcd27328fa1","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","assigned_at":"2026-06-05T13:08:57.359183","assigned_by":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles SELECT * FROM json_populate_record(NULL::public.user_roles, '{"id":"13c12049-0ed1-49e6-a6fb-b78f13ab15be","user_id":"e4d280f4-c55b-49d8-92f6-b48fafd184fd","role_id":"bfc0d225-98d9-47c6-b29b-4c15449d9753","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","assigned_at":"2026-06-06T08:05:54.616898","assigned_by":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles SELECT * FROM json_populate_record(NULL::public.user_roles, '{"id":"bff310aa-4a22-41c2-8d13-001c4d319f39","user_id":"e4497f6e-adf9-4fcf-8a4a-81af382c3697","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","assigned_at":"2026-06-06T09:26:58.396785","assigned_by":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles SELECT * FROM json_populate_record(NULL::public.user_roles, '{"id":"b8a70915-a459-4c69-9c2b-0aa770088d62","user_id":"625631e2-d318-464f-aff7-5f0eeba12b3b","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","assigned_at":"2026-06-06T10:33:55.573626","assigned_by":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles SELECT * FROM json_populate_record(NULL::public.user_roles, '{"id":"a07d6c1e-f186-4863-93cc-d366cccc90af","user_id":"780338a0-54cd-4501-a879-5b9a41017454","role_id":"18615db2-d8bb-4e51-a065-748fd5fb9903","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","assigned_at":"2026-06-06T11:04:38.577722","assigned_by":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_roles SELECT * FROM json_populate_record(NULL::public.user_roles, '{"id":"cd950d86-776f-48d3-9687-aef7f7f193f5","user_id":"8202813d-a56d-446c-81a8-49a643579f25","role_id":"bfc0d225-98d9-47c6-b29b-4c15449d9753","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","assigned_at":"2026-06-06T12:15:34.124634","assigned_by":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"c6e196f0-1043-4a74-9d0c-c4076e8c06d2","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"d13efe80-c235-40c3-9a0e-ea9e1ae89104","created_at":"2026-06-05T13:09:33.745289"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"8d1514a6-2241-47a0-87ca-4bfbf40a4d60","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"35b8730b-9368-4976-b98a-27f88878a6b5","created_at":"2026-06-05T13:09:33.745289"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"625ed41a-8753-447d-81b4-d2dbf92336a1","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"e5106205-525d-419b-a6b7-4fb3ddefcec2","created_at":"2026-06-05T13:09:33.745289"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"52684f8b-b3f2-44c7-bd65-62fb8cb5ca0d","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"fc6d4d2e-a8d7-4283-ad3b-0663b5d10e3c","created_at":"2026-06-05T13:09:33.745289"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"83f12947-de01-4915-95ed-6186db110a1c","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"f175111e-3e20-4e7f-80ef-63de46adaad2","created_at":"2026-06-05T13:09:33.745289"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"922123e1-4857-4d57-a4f1-9df80118216d","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"cc9b06d6-394b-4322-8933-95283677a33e","created_at":"2026-06-05T13:09:33.745289"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"eeb0ca6e-bb6e-430e-a009-52c9250dd990","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"0e8a9732-4048-4c6b-ba3e-dc2cd7b9ca7a","created_at":"2026-06-05T13:09:33.745289"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"e5552580-eebe-4ecf-92f8-c3a96060fdad","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"111ccdf1-5f5f-4c66-a8e4-d9f771bac96b","created_at":"2026-06-05T13:09:33.745289"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"9bfd64d6-ecfd-4612-9f09-b733ed2f10d0","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"d13efe80-c235-40c3-9a0e-ea9e1ae89104","created_at":"2026-06-05T15:49:16.869421"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"df2b12db-a5bf-4cdd-ae75-4214a6ee1f25","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"35b8730b-9368-4976-b98a-27f88878a6b5","created_at":"2026-06-05T15:49:22.798182"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"cc63dcb0-1fc8-41c7-9d1c-0e3e0716e0dd","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"e5106205-525d-419b-a6b7-4fb3ddefcec2","created_at":"2026-06-05T15:49:32.323673"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"182a68cb-733e-4383-9aff-6800bac28153","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"cc9b06d6-394b-4322-8933-95283677a33e","created_at":"2026-06-05T15:49:41.133198"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"4af483b7-90fe-41cc-bd64-6b1b4a8fa7ca","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"0e8a9732-4048-4c6b-ba3e-dc2cd7b9ca7a","created_at":"2026-06-05T15:49:57.224004"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"b480b179-3b21-4946-86cd-d1db3576ae45","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"f175111e-3e20-4e7f-80ef-63de46adaad2","created_at":"2026-06-05T15:50:28.946576"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"ddf9f7d7-20cc-4f41-ad5e-486893423dbb","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"fc6d4d2e-a8d7-4283-ad3b-0663b5d10e3c","created_at":"2026-06-05T15:50:33.645724"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"6a5567d0-814c-4bc3-abb2-16e62b97f2aa","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"111ccdf1-5f5f-4c66-a8e4-d9f771bac96b","created_at":"2026-06-05T15:50:37.249571"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"10fa81a2-6127-46d4-8ca1-0e0c4f540a8e","role_id":"bfc0d225-98d9-47c6-b29b-4c15449d9753","module_id":"35b8730b-9368-4976-b98a-27f88878a6b5","created_at":"2026-06-05T15:50:50.85772"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"76982485-35c4-4cde-9ce0-102f7f2586a2","role_id":"bfc0d225-98d9-47c6-b29b-4c15449d9753","module_id":"f175111e-3e20-4e7f-80ef-63de46adaad2","created_at":"2026-06-05T15:51:23.730003"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"670fb878-ba0b-4ef2-b652-d3c3c76229d6","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"9a576e8c-3f17-418d-a76b-2f5c32dfd684","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"1935f2bb-4394-47da-a8e4-941ba9df05b5","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"6be57838-8862-4845-bbaa-6555a4670648","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"82515f03-a673-4917-94e2-bb7f5056e7d6","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"88a44dbf-3501-4ebd-935e-043ce2f73398","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"f411588e-9649-4aab-9a96-ac4863bfbb09","role_id":"a5ab36f7-713e-4fdb-8a98-91b95a14c7fc","module_id":"8cae3b87-5f52-4b83-8167-42570fb0c5d6","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"eb6bfb1e-d1f4-4c60-998a-1af3ccc3cd3f","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"9a576e8c-3f17-418d-a76b-2f5c32dfd684","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"824fcdf6-88d9-4617-aaf5-da6348489729","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"6be57838-8862-4845-bbaa-6555a4670648","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"47e9471d-f706-4755-a96e-5b091ff607ac","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"88a44dbf-3501-4ebd-935e-043ce2f73398","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"1ac59f4a-01e3-4cf8-9882-2ec87bafa571","role_id":"d4818c32-a224-4b1f-a451-5f293ffaa16f","module_id":"8cae3b87-5f52-4b83-8167-42570fb0c5d6","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"822c62e5-df84-44d0-9a94-2cdb29780770","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"d13efe80-c235-40c3-9a0e-ea9e1ae89104","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"18cf6003-0a87-4231-8d14-4821a076a3fd","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"35b8730b-9368-4976-b98a-27f88878a6b5","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"d493fde3-4c53-46e3-8dde-6705d685ae4f","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"fc6d4d2e-a8d7-4283-ad3b-0663b5d10e3c","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"1992119e-f537-4e17-88a3-afceedad14a8","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"f175111e-3e20-4e7f-80ef-63de46adaad2","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"00a7b5b9-2fc5-470e-aeb2-b4fbd8b0f2f2","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"cc9b06d6-394b-4322-8933-95283677a33e","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"235fa37f-02ce-41d4-92a6-b490163df6da","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"0e8a9732-4048-4c6b-ba3e-dc2cd7b9ca7a","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"532aaaff-6996-4577-87f7-7b5ebc5b5bad","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"111ccdf1-5f5f-4c66-a8e4-d9f771bac96b","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"091434e1-aaf1-4f29-8004-7d6b47d5fa5f","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"88a44dbf-3501-4ebd-935e-043ce2f73398","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"7d6885b3-a4b7-438b-9c33-2ab325ffb5c0","role_id":"c4772f20-73de-4476-a5d0-5f7f23cab040","module_id":"8cae3b87-5f52-4b83-8167-42570fb0c5d6","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"cfe41ea0-d3e1-47bd-8e73-e2ac39ede3e2","role_id":"18615db2-d8bb-4e51-a065-748fd5fb9903","module_id":"d13efe80-c235-40c3-9a0e-ea9e1ae89104","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"03c9ff2f-9053-47a1-b4eb-e6d73f2f9565","role_id":"18615db2-d8bb-4e51-a065-748fd5fb9903","module_id":"35b8730b-9368-4976-b98a-27f88878a6b5","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"846539e8-cb7b-4449-bb68-0618fe606c8c","role_id":"18615db2-d8bb-4e51-a065-748fd5fb9903","module_id":"fc6d4d2e-a8d7-4283-ad3b-0663b5d10e3c","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"882d2a60-a0b0-4e73-b8b3-1d47aef338e9","role_id":"18615db2-d8bb-4e51-a065-748fd5fb9903","module_id":"f175111e-3e20-4e7f-80ef-63de46adaad2","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"faa809f5-7fd0-485a-82c5-c6c88bd68d5d","role_id":"18615db2-d8bb-4e51-a065-748fd5fb9903","module_id":"0e8a9732-4048-4c6b-ba3e-dc2cd7b9ca7a","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"c7085428-4c72-498e-9f45-128e1a6e6591","role_id":"bfc0d225-98d9-47c6-b29b-4c15449d9753","module_id":"fc6d4d2e-a8d7-4283-ad3b-0663b5d10e3c","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.role_modules SELECT * FROM json_populate_record(NULL::public.role_modules, '{"id":"100b0a2a-c7b5-411e-a6aa-8346e6b21646","role_id":"bfc0d225-98d9-47c6-b29b-4c15449d9753","module_id":"111ccdf1-5f5f-4c66-a8e4-d9f771bac96b","created_at":"2026-06-06T06:12:51.650498"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"1aebcc42-df22-4c4d-8d4a-c38decc4d4b8","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZEMP1","description":"Employee Level 1","base_salary":null,"created_at":"2026-06-06T07:16:46.348263","updated_at":"2026-06-06T07:16:46.348263","level":1,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"20286352-f246-4341-a04d-3c58aee5f93b","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZEMP2","description":"Employee Level 2","base_salary":null,"created_at":"2026-06-06T07:17:21.624299","updated_at":"2026-06-06T07:17:21.624299","level":2,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"9e916dff-8721-4af3-96fe-c6a84e3e8206","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZEMP3","description":"Employee Level 3","base_salary":null,"created_at":"2026-06-06T07:17:43.857157","updated_at":"2026-06-06T07:17:43.857157","level":3,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"0582895c-d25c-41a3-ab40-cc3d4c718b22","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZEMP4","description":"Employee Level 4","base_salary":null,"created_at":"2026-06-06T07:18:05.993605","updated_at":"2026-06-06T07:18:05.993605","level":4,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"de254473-16c3-485a-b4a2-5f4df24a16e2","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZSUP1","description":"Supervisor Level 1","base_salary":null,"created_at":"2026-06-06T07:18:33.223812","updated_at":"2026-06-06T07:18:33.223812","level":1,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"3825a162-b370-4f05-ad66-2fa19ad11058","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZSUP2","description":"Supervisor Level 2","base_salary":null,"created_at":"2026-06-06T07:18:55.328155","updated_at":"2026-06-06T07:18:55.328155","level":2,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"62a512bc-e99e-4fe0-a7dc-b0f378914321","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZSUP3","description":"Supervisor Level 3","base_salary":null,"created_at":"2026-06-06T07:19:13.45693","updated_at":"2026-06-06T07:19:13.45693","level":3,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"07967548-8e6d-4edd-8b1e-dd920b9c5b2e","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZMGR1","description":"Manager Level 1","base_salary":null,"created_at":"2026-06-06T07:20:03.271122","updated_at":"2026-06-06T07:20:03.271122","level":1,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"e90159f5-984d-4517-b845-d88c00745549","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZMGR2","description":"Manager Level 2","base_salary":null,"created_at":"2026-06-06T07:20:25.653818","updated_at":"2026-06-06T07:20:25.653818","level":2,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_grades SELECT * FROM json_populate_record(NULL::public.employee_grades, '{"id":"db41f3a3-4d03-4fdd-b669-8d15273a3ba6","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"GZMGR3","description":"Manager Level 3","base_salary":null,"created_at":"2026-06-06T07:20:42.628426","updated_at":"2026-06-06T07:20:42.628426","level":3,"active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"1cc4875a-f8f5-4b78-b5b8-7b495db0c8f1","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Annual Leave","description":"Paid annual leave as per UAE Labour Law Art. 29. 30 days per year after completion of 1 year of service.","days_allocated":null,"is_paid":true,"requires_approval":true,"created_at":"2026-06-05T15:30:13.999173","days_per_year":30,"allow_half_day":true,"color":"#3B82F6","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"ff48b23b-5069-42c2-844a-eea3a24b5161","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Sick Leave","description":"Medical sick leave as per UAE Labour Law Art. 31. First 15 days full pay, next 30 days half pay.","days_allocated":null,"is_paid":true,"requires_approval":false,"created_at":"2026-06-05T15:30:13.999173","days_per_year":90,"allow_half_day":false,"color":"#EF4444","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"7b9fc276-c3db-47fe-8c75-869d4628ccfb","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Maternity Leave","description":"Maternity leave as per UAE Labour Law Art. 30. 45 days full pay + 15 days half pay.","days_allocated":null,"is_paid":true,"requires_approval":true,"created_at":"2026-06-05T15:30:13.999173","days_per_year":60,"allow_half_day":false,"color":"#EC4899","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"3d90f150-58f1-42c0-b427-44c4333af782","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Paternity Leave","description":"Paternity leave as per UAE Labour Law Art. 32. 5 paid days within 6 months of childbirth.","days_allocated":null,"is_paid":true,"requires_approval":true,"created_at":"2026-06-05T15:30:13.999173","days_per_year":5,"allow_half_day":false,"color":"#8B5CF6","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"9b6efb2d-3825-48e9-a6c5-8de4a7e838b4","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Bereavement Leave","description":"Compassionate leave as per UAE Labour Law Art. 33. 5 days for spouse, 3 days for parents/children/siblings.","days_allocated":null,"is_paid":true,"requires_approval":false,"created_at":"2026-06-05T15:30:13.999173","days_per_year":5,"allow_half_day":false,"color":"#6B7280","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"06fdce13-7f0f-4b14-b28b-40e3ffb4fd8f","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Hajj Leave","description":"Pilgrimage leave as per UAE Labour Law. 30 days unpaid, granted once during employment.","days_allocated":null,"is_paid":true,"requires_approval":true,"created_at":"2026-06-05T15:30:13.999173","days_per_year":30,"allow_half_day":false,"color":"#F59E0B","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"a8383c35-b7d5-45be-859b-e9360ecd7fcd","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Study Leave","description":"Educational leave as per UAE Labour Law Art. 34. 10 paid days for examinations per year.","days_allocated":null,"is_paid":true,"requires_approval":true,"created_at":"2026-06-05T15:30:13.999173","days_per_year":10,"allow_half_day":false,"color":"#10B981","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"33d734f1-ef76-4735-948a-28b81d8ab1bc","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Parental Leave","description":"Parental leave as per UAE Labour Law Art. 32. 5 paid days for non-birth parent within 6 months.","days_allocated":null,"is_paid":true,"requires_approval":true,"created_at":"2026-06-05T15:30:13.999173","days_per_year":5,"allow_half_day":false,"color":"#F472B6","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"86eccc06-2650-4530-b603-6c97a3c6fa91","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Unpaid Leave","description":"Leave without pay, granted at employer discretion. Duration as agreed between parties.","days_allocated":null,"is_paid":true,"requires_approval":true,"created_at":"2026-06-05T15:30:13.999173","days_per_year":0,"allow_half_day":true,"color":"#9CA3AF","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"4c53a15a-05af-4c71-83c9-c44aec3823bc","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"CompOff Leave","description":"Compensatory off for working on weekly day off or public holiday as per UAE Labour Law.","days_allocated":null,"is_paid":true,"requires_approval":true,"created_at":"2026-06-05T15:30:13.999173","days_per_year":3,"allow_half_day":false,"color":"#F97316","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"c142718c-4453-4bf5-b186-5942b012a2aa","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"Emergency Leave","description":"Short-term emergency leave for urgent personal or family matters.","days_allocated":null,"is_paid":true,"requires_approval":false,"created_at":"2026-06-05T15:30:13.999173","days_per_year":3,"allow_half_day":false,"color":"#DC2626","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leave_types SELECT * FROM json_populate_record(NULL::public.leave_types, '{"id":"0fcef210-ce58-4d65-9e9e-1e43ee495f7c","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","name":"National Service Leave","description":"Mandatory national service leave for UAE nationals as per Federal Law.","days_allocated":null,"is_paid":true,"requires_approval":false,"created_at":"2026-06-05T15:30:13.999173","days_per_year":0,"allow_half_day":false,"color":"#059669","active":true,"updated_at":"2026-06-05T15:45:57.51852"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_salary_config SELECT * FROM json_populate_record(NULL::public.grade_salary_config, '{"id":"cd6f593b-6a67-41fb-a33b-cdb069f873d9","grade_id":"1aebcc42-df22-4c4d-8d4a-c38decc4d4b8","salary_component":"Basic Salary","amount":null,"is_deduction":false,"created_at":"2026-06-06T07:47:59.878355","updated_at":"2026-06-06T07:47:59.878355","salary":2000.00,"currency":"AED","effective_from":"2026-06-06","effective_to":"2036-06-02","notes":null,"company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_salary_config SELECT * FROM json_populate_record(NULL::public.grade_salary_config, '{"id":"a931ce57-254a-4d9d-b751-abf23fa75d69","grade_id":"07967548-8e6d-4edd-8b1e-dd920b9c5b2e","salary_component":"Basic Salary","amount":null,"is_deduction":false,"created_at":"2026-06-06T08:46:46.119491","updated_at":"2026-06-06T08:46:46.119491","salary":4000.00,"currency":"AED","effective_from":"2026-06-06","effective_to":null,"notes":null,"company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_salary_config SELECT * FROM json_populate_record(NULL::public.grade_salary_config, '{"id":"77cf87e1-accf-41fe-ac9e-6f5ab1edeccd","grade_id":"db41f3a3-4d03-4fdd-b669-8d15273a3ba6","salary_component":"Basic Salary","amount":null,"is_deduction":false,"created_at":"2026-06-06T10:27:31.137824","updated_at":"2026-06-06T10:27:31.137824","salary":8000.00,"currency":"AED","effective_from":"2026-06-06","effective_to":null,"notes":null,"company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_salary_config SELECT * FROM json_populate_record(NULL::public.grade_salary_config, '{"id":"e7c1369f-c64e-4fba-9795-439f84c9ed5b","grade_id":"e90159f5-984d-4517-b845-d88c00745549","salary_component":"Basic Salary","amount":null,"is_deduction":false,"created_at":"2026-06-06T11:02:12.293022","updated_at":"2026-06-06T11:02:12.293022","salary":6000.00,"currency":"AED","effective_from":"2026-06-06","effective_to":null,"notes":null,"company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_salary_config SELECT * FROM json_populate_record(NULL::public.grade_salary_config, '{"id":"1996abef-2189-4dc0-b20f-c5daf2df1c84","grade_id":"0582895c-d25c-41a3-ab40-cc3d4c718b22","salary_component":"Basic Salary","amount":null,"is_deduction":false,"created_at":"2026-06-06T12:13:46.941043","updated_at":"2026-06-06T12:13:46.941043","salary":3000.00,"currency":"AED","effective_from":"2026-06-06","effective_to":null,"notes":null,"company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_salary_config SELECT * FROM json_populate_record(NULL::public.grade_salary_config, '{"id":"7dedd19c-81c0-41f7-85a6-2987244e0d02","grade_id":"9e916dff-8721-4af3-96fe-c6a84e3e8206","salary_component":"Basic Salary","amount":null,"is_deduction":false,"created_at":"2026-06-06T12:43:57.048591","updated_at":"2026-06-06T12:43:57.048591","salary":2500.00,"currency":"AED","effective_from":"2026-06-06","effective_to":null,"notes":null,"company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"804e98b6-3345-4f31-9ea8-c52f17956a76","grade_id":"1aebcc42-df22-4c4d-8d4a-c38decc4d4b8","benefit_type":"Annual Flight Ticket","benefit_value":1000.00,"description":null,"created_at":"2026-06-06T07:51:43.912049","updated_at":"2026-06-06T07:51:43.912049","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"7e406dbd-a5b2-4430-998f-867734051bfd","grade_id":"07967548-8e6d-4edd-8b1e-dd920b9c5b2e","benefit_type":"Housing Allowance","benefit_value":500.00,"description":null,"created_at":"2026-06-06T08:47:03.226652","updated_at":"2026-06-06T08:47:03.226652","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"edef5a56-2161-49e8-bc6c-3f5cabbc11df","grade_id":"07967548-8e6d-4edd-8b1e-dd920b9c5b2e","benefit_type":"Annual Flight Ticket","benefit_value":2000.00,"description":null,"created_at":"2026-06-06T08:47:21.952171","updated_at":"2026-06-06T08:47:21.952171","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"87e14b12-b05c-4943-a151-c7313ac215e4","grade_id":"07967548-8e6d-4edd-8b1e-dd920b9c5b2e","benefit_type":"Transport Allowance","benefit_value":500.00,"description":null,"created_at":"2026-06-06T08:47:39.218271","updated_at":"2026-06-06T08:47:39.218271","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"93d35f6d-9556-4eec-8832-d60331defae5","grade_id":"db41f3a3-4d03-4fdd-b669-8d15273a3ba6","benefit_type":"Annual Flight Ticket","benefit_value":3000.00,"description":null,"created_at":"2026-06-06T10:27:48.032608","updated_at":"2026-06-06T10:27:48.032608","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"b471562d-dae5-499e-a816-b1aa7eb0bdf8","grade_id":"db41f3a3-4d03-4fdd-b669-8d15273a3ba6","benefit_type":"Housing Allowance","benefit_value":2500.00,"description":null,"created_at":"2026-06-06T10:28:04.524806","updated_at":"2026-06-06T10:28:04.524806","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"e31250c5-f79f-4c8a-9468-d32c39bf5ef2","grade_id":"db41f3a3-4d03-4fdd-b669-8d15273a3ba6","benefit_type":"Transport Allowance","benefit_value":1500.00,"description":null,"created_at":"2026-06-06T10:28:18.35669","updated_at":"2026-06-06T10:28:18.35669","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"ba5196cf-43c9-48f9-a00c-cace38955ae8","grade_id":"db41f3a3-4d03-4fdd-b669-8d15273a3ba6","benefit_type":"Phone Allowance","benefit_value":300.00,"description":null,"created_at":"2026-06-06T10:28:30.525732","updated_at":"2026-06-06T10:28:30.525732","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"23e17f0a-65fe-4749-9cab-6a7079c94124","grade_id":"e90159f5-984d-4517-b845-d88c00745549","benefit_type":"Annual Flight Ticket","benefit_value":2500.00,"description":null,"created_at":"2026-06-06T11:02:31.372958","updated_at":"2026-06-06T11:02:31.372958","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"c8029efa-2260-4bf4-83d3-a930edf5b1cb","grade_id":"e90159f5-984d-4517-b845-d88c00745549","benefit_type":"Housing Allowance","benefit_value":1500.00,"description":null,"created_at":"2026-06-06T11:02:42.811073","updated_at":"2026-06-06T11:02:42.811073","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"81318dc1-985d-4685-8ac4-3497ff9028ee","grade_id":"e90159f5-984d-4517-b845-d88c00745549","benefit_type":"Transport Allowance","benefit_value":1000.00,"description":null,"created_at":"2026-06-06T11:02:58.543367","updated_at":"2026-06-06T11:02:58.543367","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"851847ba-3842-41eb-b046-03ce7923c52b","grade_id":"e90159f5-984d-4517-b845-d88c00745549","benefit_type":"Phone Allowance","benefit_value":300.00,"description":null,"created_at":"2026-06-06T11:03:13.329402","updated_at":"2026-06-06T11:03:13.329402","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"faa0c3af-5aa8-48f3-b43c-2ce9c595e8e8","grade_id":"0582895c-d25c-41a3-ab40-cc3d4c718b22","benefit_type":"Annual Flight Ticket","benefit_value":1500.00,"description":null,"created_at":"2026-06-06T12:14:02.773933","updated_at":"2026-06-06T12:14:02.773933","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"a0c8f90d-2a71-4667-85c6-29c62e464c41","grade_id":"0582895c-d25c-41a3-ab40-cc3d4c718b22","benefit_type":"Phone Allowance","benefit_value":200.00,"description":null,"created_at":"2026-06-06T12:14:18.252259","updated_at":"2026-06-06T12:14:18.252259","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"08945333-8f00-4112-a49d-42f1eba41d90","grade_id":"0582895c-d25c-41a3-ab40-cc3d4c718b22","benefit_type":"Housing Allowance","benefit_value":500.00,"description":null,"created_at":"2026-06-06T12:14:28.601163","updated_at":"2026-06-06T12:14:28.601163","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"4b28f729-62c1-4eda-96d4-f04073ad7c12","grade_id":"0582895c-d25c-41a3-ab40-cc3d4c718b22","benefit_type":"Transport Allowance","benefit_value":700.00,"description":null,"created_at":"2026-06-06T12:14:41.804014","updated_at":"2026-06-06T12:14:41.804014","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"00528628-dce6-4b8e-8d82-7576bfc9b212","grade_id":"9e916dff-8721-4af3-96fe-c6a84e3e8206","benefit_type":"Annual Flight Ticket","benefit_value":1200.00,"description":null,"created_at":"2026-06-06T12:44:11.489916","updated_at":"2026-06-06T12:44:11.489916","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_benefits SELECT * FROM json_populate_record(NULL::public.grade_benefits, '{"id":"14f3a861-5a2c-40a6-9dcf-b1a3a65e6ec9","grade_id":"9e916dff-8721-4af3-96fe-c6a84e3e8206","benefit_type":"Housing Allowance","benefit_value":500.00,"description":null,"created_at":"2026-06-06T12:44:22.941885","updated_at":"2026-06-06T12:44:22.941885","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","value_type":"fixed","currency":"AED","active":true}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_leave_config SELECT * FROM json_populate_record(NULL::public.grade_leave_config, '{"id":"a70b4ecf-8ac1-4c9e-867f-b0dea3440e1a","grade_id":"1aebcc42-df22-4c4d-8d4a-c38decc4d4b8","leave_type_id":"1cc4875a-f8f5-4b78-b5b8-7b495db0c8f1","days_allocated":null,"created_at":"2026-06-06T07:21:13.401522","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","days_per_year":30,"carry_forward_days":0,"carry_forward_expiry_months":12,"year":null,"updated_at":"2026-06-06T07:21:13.401522"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_leave_config SELECT * FROM json_populate_record(NULL::public.grade_leave_config, '{"id":"3f16f86a-8099-4ca0-91ab-1410f9f749d0","grade_id":"07967548-8e6d-4edd-8b1e-dd920b9c5b2e","leave_type_id":"1cc4875a-f8f5-4b78-b5b8-7b495db0c8f1","days_allocated":null,"created_at":"2026-06-06T08:46:20.527639","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","days_per_year":30,"carry_forward_days":0,"carry_forward_expiry_months":12,"year":null,"updated_at":"2026-06-06T08:46:20.527639"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_leave_config SELECT * FROM json_populate_record(NULL::public.grade_leave_config, '{"id":"54c4ff7e-785f-4028-8f14-da023e0ae083","grade_id":"db41f3a3-4d03-4fdd-b669-8d15273a3ba6","leave_type_id":"1cc4875a-f8f5-4b78-b5b8-7b495db0c8f1","days_allocated":null,"created_at":"2026-06-06T10:25:03.481597","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","days_per_year":30,"carry_forward_days":0,"carry_forward_expiry_months":12,"year":null,"updated_at":"2026-06-06T10:25:03.481597"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_leave_config SELECT * FROM json_populate_record(NULL::public.grade_leave_config, '{"id":"0afb81f3-8b5a-4552-b130-d53d791f45c5","grade_id":"e90159f5-984d-4517-b845-d88c00745549","leave_type_id":"1cc4875a-f8f5-4b78-b5b8-7b495db0c8f1","days_allocated":null,"created_at":"2026-06-06T11:01:59.241465","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","days_per_year":30,"carry_forward_days":0,"carry_forward_expiry_months":12,"year":null,"updated_at":"2026-06-06T11:01:59.241465"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_leave_config SELECT * FROM json_populate_record(NULL::public.grade_leave_config, '{"id":"bc6a7069-d6b7-4d77-9006-7d4efb6ef4cd","grade_id":"0582895c-d25c-41a3-ab40-cc3d4c718b22","leave_type_id":"1cc4875a-f8f5-4b78-b5b8-7b495db0c8f1","days_allocated":null,"created_at":"2026-06-06T12:13:26.721744","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","days_per_year":30,"carry_forward_days":0,"carry_forward_expiry_months":12,"year":null,"updated_at":"2026-06-06T12:13:26.721744"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.grade_leave_config SELECT * FROM json_populate_record(NULL::public.grade_leave_config, '{"id":"269c922c-ed6a-475d-9eb0-582104b08bcf","grade_id":"9e916dff-8721-4af3-96fe-c6a84e3e8206","leave_type_id":"1cc4875a-f8f5-4b78-b5b8-7b495db0c8f1","days_allocated":null,"created_at":"2026-06-06T12:41:58.979021","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","days_per_year":30,"carry_forward_days":0,"carry_forward_expiry_months":12,"year":null,"updated_at":"2026-06-06T12:41:58.979021"}') ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 12. BUSINESS DATA (employees, leave balances, leaves, payroll)
--     Employees without a manager are inserted first to satisfy the
--     self-referencing manager_id foreign key.
-- ----------------------------------------------------------------------------
INSERT INTO public.employees SELECT * FROM json_populate_record(NULL::public.employees, '{"id":"054ea3d5-4694-43db-b67f-2dcc560f0a96","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","first_name":"Salman","last_name":"AKP","email":"salman@gulfzoneae.com","phone":"","position":"","department":"HR & Admin","date_of_joining":"2026-05-01","date_of_birth":null,"address":null,"city":null,"country":null,"salary":null,"employment_type":null,"status":"Active","created_at":"2026-06-06T08:48:23.109021","updated_at":"2026-06-06T08:48:23.109021","grade_id":"07967548-8e6d-4edd-8b1e-dd920b9c5b2e","user_id":"e4497f6e-adf9-4fcf-8a4a-81af382c3697","manager_id":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employees SELECT * FROM json_populate_record(NULL::public.employees, '{"id":"3813411d-ed99-4dd2-8217-133e4b30aada","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","first_name":"Khalid","last_name":"AKP","email":"khalid@gulfzoneae.com","phone":"","position":"","department":"HR & Admin","date_of_joining":"2026-04-01","date_of_birth":null,"address":null,"city":null,"country":null,"salary":null,"employment_type":null,"status":"Active","created_at":"2026-06-06T10:29:09.402998","updated_at":"2026-06-06T10:29:09.402998","grade_id":"db41f3a3-4d03-4fdd-b669-8d15273a3ba6","user_id":"625631e2-d318-464f-aff7-5f0eeba12b3b","manager_id":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employees SELECT * FROM json_populate_record(NULL::public.employees, '{"id":"3f4dbd28-e57f-4e2b-9237-575a239d7e1c","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","first_name":"Sameer","last_name":"Ahmad","email":"sameer@gulfzoneae.com","phone":"","position":"","department":"Marketing","date_of_joining":"2026-06-02","date_of_birth":null,"address":null,"city":null,"country":null,"salary":null,"employment_type":null,"status":"Active","created_at":"2026-06-06T11:03:48.007707","updated_at":"2026-06-06T11:03:48.007707","grade_id":"e90159f5-984d-4517-b845-d88c00745549","user_id":"780338a0-54cd-4501-a879-5b9a41017454","manager_id":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employees SELECT * FROM json_populate_record(NULL::public.employees, '{"id":"5fcd7a93-ca94-4ea6-8342-d396e206c307","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","first_name":"Latheef","last_name":"VP","email":"latheef@gulfzoneae.com","phone":"","position":"","department":"Sales","date_of_joining":"2026-04-30","date_of_birth":null,"address":null,"city":null,"country":null,"salary":null,"employment_type":null,"status":"Active","created_at":"2026-06-06T12:15:33.217519","updated_at":"2026-06-06T12:15:33.217519","grade_id":"0582895c-d25c-41a3-ab40-cc3d4c718b22","user_id":"8202813d-a56d-446c-81a8-49a643579f25","manager_id":"3f4dbd28-e57f-4e2b-9237-575a239d7e1c"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employees SELECT * FROM json_populate_record(NULL::public.employees, '{"id":"879a3a9b-be73-42ec-9aba-1914a8394a1e","company_id":"e5edb3a7-63dd-4a85-af7f-fbd5307e4c69","first_name":"Majid","last_name":"Abdulla","email":"majid@gulfzoneae.com","phone":"","position":"","department":"Sales","date_of_joining":"2026-05-02","date_of_birth":null,"address":null,"city":null,"country":null,"salary":null,"employment_type":null,"status":"Active","created_at":"2026-06-06T08:05:53.741356","updated_at":"2026-06-06T08:05:53.741356","grade_id":"9e916dff-8721-4af3-96fe-c6a84e3e8206","user_id":"e4d280f4-c55b-49d8-92f6-b48fafd184fd","manager_id":"3f4dbd28-e57f-4e2b-9237-575a239d7e1c"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.employee_leave_balance SELECT * FROM json_populate_record(NULL::public.employee_leave_balance, '{"id":"80069186-20b1-4542-acd8-2c236a7021a5","employee_id":"879a3a9b-be73-42ec-9aba-1914a8394a1e","leave_type_id":"1cc4875a-f8f5-4b78-b5b8-7b495db0c8f1","year":2026,"days_allocated":null,"days_used":0,"days_remaining":null,"created_at":"2026-06-06T12:44:59.604809","updated_at":"2026-06-06T12:44:59.604809","total_days":30,"used_days":0,"pending_days":0,"remaining_days":null,"last_updated":"2026-06-06T12:44:59.604809"}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leaves SELECT * FROM json_populate_record(NULL::public.leaves, '{"id":"be0258b6-2e57-4c74-ba78-9dcadb4a0b75","employee_id":"3813411d-ed99-4dd2-8217-133e4b30aada","leave_type":"Personal","start_date":"2026-06-02","end_date":"2026-06-02","days":1,"reason":"Personal","status":"Pending","created_at":"2026-06-06T10:37:35.259533","updated_at":"2026-06-06T10:37:35.259533","requested_by":null,"approved_by":null,"approval_date":null,"manager_comments":null,"approval_status":"pending","rejection_reason":null,"is_comp_off":false,"comp_off_request_id":null,"company_id":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.leaves SELECT * FROM json_populate_record(NULL::public.leaves, '{"id":"277664a5-8fb4-41f7-a9e3-df2e038e0835","employee_id":"879a3a9b-be73-42ec-9aba-1914a8394a1e","leave_type":"Vacation","start_date":"2026-06-03","end_date":"2026-06-04","days":2,"reason":"Personal work","status":"Approved","created_at":"2026-06-06T08:24:03.326099","updated_at":"2026-06-06T08:24:03.326099","requested_by":null,"approved_by":"625631e2-d318-464f-aff7-5f0eeba12b3b","approval_date":"2026-06-06T10:37:46.44","manager_comments":null,"approval_status":"approved","rejection_reason":null,"is_comp_off":false,"comp_off_request_id":null,"company_id":null}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.payroll SELECT * FROM json_populate_record(NULL::public.payroll, '{"id":"df08c5f4-003d-4baf-be8e-7a40d766fee3","employee_id":"054ea3d5-4694-43db-b67f-2dcc560f0a96","month":"2026-05","salary":4000.00,"bonus":1000.00,"deductions":0.00,"net_pay":5000.00,"status":"Processed","created_at":"2026-06-06T11:52:18.203721","updated_at":"2026-06-06T11:52:18.203721","leave_deduction_days":0,"leave_deduction_amount":0}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.payroll SELECT * FROM json_populate_record(NULL::public.payroll, '{"id":"6a690cc4-2461-4e90-a884-7c797c4860ac","employee_id":"3813411d-ed99-4dd2-8217-133e4b30aada","month":"2026-05","salary":8000.00,"bonus":4300.00,"deductions":0.00,"net_pay":12300.00,"status":"Processed","created_at":"2026-06-06T11:52:20.254126","updated_at":"2026-06-06T11:52:20.254126","leave_deduction_days":0,"leave_deduction_amount":0}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.payroll SELECT * FROM json_populate_record(NULL::public.payroll, '{"id":"bc8fe92c-90eb-4539-847a-efe91fd531e6","employee_id":"3f4dbd28-e57f-4e2b-9237-575a239d7e1c","month":"2026-05","salary":6000.00,"bonus":2800.00,"deductions":0.00,"net_pay":8800.00,"status":"Processed","created_at":"2026-06-06T11:52:22.41614","updated_at":"2026-06-06T11:52:22.41614","leave_deduction_days":0,"leave_deduction_amount":0}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.payroll SELECT * FROM json_populate_record(NULL::public.payroll, '{"id":"9f44732b-a0bc-41f8-9966-c09b9a5d6f8d","employee_id":"879a3a9b-be73-42ec-9aba-1914a8394a1e","month":"2026-05","salary":2000.00,"bonus":0.00,"deductions":0.00,"net_pay":2000.00,"status":"Processed","created_at":"2026-06-06T11:52:24.46387","updated_at":"2026-06-06T11:52:24.46387","leave_deduction_days":0,"leave_deduction_amount":0}') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.payroll SELECT * FROM json_populate_record(NULL::public.payroll, '{"id":"063574b4-5ab2-4f29-8457-f8faefb84a59","employee_id":"5fcd7a93-ca94-4ea6-8342-d396e206c307","month":"2026-05","salary":3000.00,"bonus":1400.00,"deductions":0.00,"net_pay":4400.00,"status":"Processed","created_at":"2026-06-06T12:17:10.874706","updated_at":"2026-06-06T12:17:10.874706","leave_deduction_days":0,"leave_deduction_amount":0}') ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- AUTH USERS — IMPORTANT POST-DEPLOYMENT STEP
-- ============================================================================
-- The public.users rows above mirror Supabase Auth accounts (same UUID).
-- A SQL script cannot recreate auth.users (passwords are hashed by GoTrue).
-- After running this file, create the matching Auth users so logins work:
--
--   Option A (recommended): use the app's Admin → Employees "Add Employee"
--   flow, which provisions the Auth user + sets a temporary password.
--
--   Option B: Supabase Dashboard → Authentication → Add user, using the
--   SAME UUID + email as the seeded public.users rows, e.g.:
--     607cbd34-3ec6-4663-a83c-4bcd27328fa1  jasimmahamoodkm@gmail.com (Super Admin)
--     e4497f6e-adf9-4fcf-8a4a-81af382c3697  salman@gulfzoneae.com    (Company Admin)
--     625631e2-d318-464f-aff7-5f0eeba12b3b  khalid@gulfzoneae.com    (HR Manager)
--     780338a0-54cd-4501-a879-5b9a41017454  sameer@gulfzoneae.com    (Manager)
--     e4d280f4-c55b-49d8-92f6-b48fafd184fd  majid@gulfzoneae.com     (Employee)
--     8202813d-a56d-446c-81a8-49a643579f25  latheef@gulfzoneae.com   (Employee)
--
-- Also enable Auth → Providers → "Leaked password protection".
-- ============================================================================

-- ============================================================================
-- 13. FEATURE MIGRATIONS 021–026 (idempotent — safe to re-run)
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

-- ──── migrations/027_global_leave_types.sql ────
-- Migration 027: leave types become GLOBAL (shared by all companies).
--
-- Previously each company duplicated the same leave types ("Annual Leave",
-- "Sick Leave", …) because leave_types.company_id was NOT NULL and RLS
-- restricted reads to the caller's company. This migration:
--   1. makes company_id nullable (NULL = global),
--   2. de-duplicates types by name, remapping grade_leave_config and
--      employee_leave_balance references to the surviving row,
--   3. marks the survivors global and enforces unique names,
--   4. opens the read policy to all authenticated users.
-- Idempotent — safe to re-run.

-- 1. company_id nullable
ALTER TABLE public.leave_types ALTER COLUMN company_id DROP NOT NULL;

-- 2. De-duplicate by name (case-insensitive): keep the earliest row,
--    remap references, delete the duplicates.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (array_agg(id ORDER BY created_at, id))[1] AS keep_id,
           array_agg(id ORDER BY created_at, id)      AS all_ids
    FROM public.leave_types
    GROUP BY lower(name)
    HAVING count(*) > 1
  LOOP
    -- grade_leave_config → keeper (skip rows that would collide, then drop them)
    UPDATE public.grade_leave_config glc
       SET leave_type_id = r.keep_id
     WHERE glc.leave_type_id = ANY(r.all_ids)
       AND glc.leave_type_id <> r.keep_id
       AND NOT EXISTS (
         SELECT 1 FROM public.grade_leave_config g2
          WHERE g2.grade_id = glc.grade_id
            AND g2.leave_type_id = r.keep_id
            AND g2.year IS NOT DISTINCT FROM glc.year);
    DELETE FROM public.grade_leave_config
     WHERE leave_type_id = ANY(r.all_ids) AND leave_type_id <> r.keep_id;

    -- employee_leave_balance → keeper (same collision guard)
    UPDATE public.employee_leave_balance b
       SET leave_type_id = r.keep_id
     WHERE b.leave_type_id = ANY(r.all_ids)
       AND b.leave_type_id <> r.keep_id
       AND NOT EXISTS (
         SELECT 1 FROM public.employee_leave_balance b2
          WHERE b2.employee_id = b.employee_id
            AND b2.leave_type_id = r.keep_id
            AND b2.year = b.year);
    DELETE FROM public.employee_leave_balance
     WHERE leave_type_id = ANY(r.all_ids) AND leave_type_id <> r.keep_id;

    -- drop the duplicate type rows themselves
    DELETE FROM public.leave_types WHERE id = ANY(r.all_ids) AND id <> r.keep_id;
  END LOOP;
END $$;

-- 3. Survivors are global; names unique from here on
UPDATE public.leave_types SET company_id = NULL WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_types_name
  ON public.leave_types (lower(name));

-- 4. RLS: every authenticated user can read the global list
--    (insert/update/delete stay HR-and-above via the existing policies)
DROP POLICY IF EXISTS leave_types_read ON public.leave_types;
CREATE POLICY leave_types_read ON public.leave_types
  FOR SELECT TO public
  USING ((select auth.uid()) IS NOT NULL);

-- ──── migrations/028_company_branding.sql ────
-- Migration 028: per-company branding.
--
-- Each company can carry its own logo and brand colour, used in the payslip
-- header, the app header when that company is selected, and other relevant
-- areas. This is distinct from the per-build app branding in
-- branding.config.json (which brands the whole deployment for one client).
--
-- logo_url   : an image URL or data: URI (shown as the company logo)
-- brand_color: a hex colour (e.g. #0F172A) used as the payslip header band
-- Idempotent — safe to re-run.

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS brand_color varchar(7);
