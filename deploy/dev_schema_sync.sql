-- ============================================================================
-- GulfZone HR — DEV / fresh-environment SCHEMA SYNC (no data)
-- ============================================================================
-- Brings a DEV or fresh Supabase project's SCHEMA fully in line with the
-- current codebase: tables, MISSING COLUMNS on existing tables, constraints,
-- indexes, functions, RLS, views, and the storage bucket. NO business data.
-- Idempotent: safe to run repeatedly. Run on the DEV project's SQL editor.
-- ============================================================================

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
-- 1b. COLUMN RECONCILIATION
--     Adds any columns missing from pre-existing (older) tables. Columns are
--     added NULLABLE so this never fails on tables that already have rows.
-- ----------------------------------------------------------------------------
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS name character varying;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email character varying;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone character varying;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city character varying;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS country character varying;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS industry character varying;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS founded_year integer;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS employee_count integer DEFAULT 0;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email character varying;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name character varying;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name character varying;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role character varying DEFAULT 'employee'::character varying;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_temporary_password boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS name character varying;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS name character varying;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS icon character varying;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS path character varying;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS order_index integer;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT true;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS role_id uuid;
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS resource character varying;
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS action character varying;
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.role_modules ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.role_modules ADD COLUMN IF NOT EXISTS role_id uuid;
ALTER TABLE public.role_modules ADD COLUMN IF NOT EXISTS module_id uuid;
ALTER TABLE public.role_modules ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_id uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS assigned_by uuid;
ALTER TABLE public.user_companies ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.user_companies ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.user_companies ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.user_companies ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;
ALTER TABLE public.user_companies ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.user_companies ADD COLUMN IF NOT EXISTS assigned_at timestamp without time zone;
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS name character varying;
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS base_salary numeric(12,2);
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
ALTER TABLE public.employee_grades ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS name character varying;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS days_allocated integer;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT true;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT true;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS days_per_year integer DEFAULT 0;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS allow_half_day boolean DEFAULT false;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS color character varying(7) DEFAULT '#3B82F6'::character varying;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS first_name character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS last_name character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS "position" character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_joining date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS city character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS country character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary numeric(12,2);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'active'::character varying;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS grade_id uuid;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS manager_id uuid;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS grade_id uuid;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS salary_component character varying;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS amount numeric(12,2);
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS is_deduction boolean DEFAULT false;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS salary numeric(12,2);
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS currency character varying(3) DEFAULT 'AED'::character varying;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS effective_from date DEFAULT CURRENT_DATE;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS effective_to date;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.grade_salary_config ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS grade_id uuid;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS benefit_type character varying;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS benefit_value numeric(12,2);
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS value_type character varying DEFAULT 'fixed'::character varying;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS currency character varying DEFAULT 'AED'::character varying;
ALTER TABLE public.grade_benefits ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS grade_id uuid;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS leave_type_id uuid;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS days_allocated integer;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS days_per_year integer;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS carry_forward_days integer DEFAULT 0;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS carry_forward_expiry_months integer DEFAULT 3;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE public.grade_leave_config ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS date date;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in time without time zone;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out time without time zone;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS status character varying;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS leave_type character varying;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS days integer;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'pending'::character varying;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS requested_by uuid;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS approval_date timestamp without time zone;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS manager_comments text;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS approval_status character varying;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS is_comp_off boolean DEFAULT false;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS comp_off_request_id uuid;
ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS approver_id uuid;
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS leave_type character varying;
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS approval_level integer DEFAULT 1;
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.leave_approvers ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS leave_type_id uuid;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS days_allocated integer;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS days_used integer DEFAULT 0;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS days_remaining integer;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS total_days integer;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS used_days integer;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS pending_days integer DEFAULT 0;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS remaining_days integer;
ALTER TABLE public.employee_leave_balance ADD COLUMN IF NOT EXISTS last_updated timestamp without time zone DEFAULT now();
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS month character varying;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS salary numeric(12,2);
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS bonus numeric(12,2) DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS deductions numeric(12,2) DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS net_pay numeric(12,2);
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'draft'::character varying;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS leave_deduction_days numeric DEFAULT 0;
ALTER TABLE public.payroll ADD COLUMN IF NOT EXISTS leave_deduction_amount numeric DEFAULT 0;
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS payroll_id uuid;
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS leave_type character varying;
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS days_deducted integer;
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS amount_deducted numeric(12,2);
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS total_deducted_days numeric DEFAULT 0;
ALTER TABLE public.employee_leave_deduction_tracking ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS employee_id uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_type character varying;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS document_number character varying;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS issue_date date;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS issuing_authority character varying;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_url character varying;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_type character varying DEFAULT ''::character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS entity_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS changes jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_type character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_id uuid;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS resource_name character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_values jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_values jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS status character varying DEFAULT 'success'::character varying;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS activity_type character varying;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS ip_address character varying;
ALTER TABLE public.audit_log_policies ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();
ALTER TABLE public.audit_log_policies ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.audit_log_policies ADD COLUMN IF NOT EXISTS resource_type character varying;
ALTER TABLE public.audit_log_policies ADD COLUMN IF NOT EXISTS retention_days integer DEFAULT 90;
ALTER TABLE public.audit_log_policies ADD COLUMN IF NOT EXISTS archive_enabled boolean DEFAULT false;
ALTER TABLE public.audit_log_policies ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT now();
ALTER TABLE public.audit_log_policies ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT now();

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

-- ----------------------------------------------------------------------------
-- LATEST MIGRATIONS (newer than the base snapshot)
-- ----------------------------------------------------------------------------

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
