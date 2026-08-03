-- ============================================================================
--  HR MANAGEMENT SYSTEM — NEW CLIENT DATABASE SETUP
-- ============================================================================
--  ONE script. Run it once on a BRAND-NEW, EMPTY Supabase project:
--     Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
--
--  It creates everything the app needs:
--     1. Extensions
--     2. Tables, keys, foreign keys, indexes      (29 tables)
--     3. RLS helper functions (SECURITY DEFINER)  (9 functions)
--     4. Row Level Security + policies            (112 policies)
--     5. Storage bucket for documents
--     6. Reference data: roles, modules, permissions, leave types
--     7. Grants for the API roles
--
--  It does NOT create companies, employees or users — those are the client's
--  own data, added through the app. See "AFTER RUNNING" at the bottom.
--
--  Safe to re-run (idempotent).
--  Includes all migrations through 029 (payroll adjustments).
-- ============================================================================

-- ── 1. Session settings + extensions ────────────────────────────────────────
-- Function bodies reference tables created later in this script, so defer
-- body validation until execution time.
SET check_function_bodies = false;

-- Supabase installs extensions into the "extensions" schema; create it if this
-- is a plain PostgreSQL database so the generated defaults resolve either way.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto    WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;





-- Name: public; Type: SCHEMA; Schema: -; Owner: -


-- Name: get_my_company_id(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.get_my_company_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.users WHERE id = auth.uid()),
    (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_primary = TRUE LIMIT 1),
    (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() LIMIT 1)
  )
$$;


-- Name: get_my_employee_id(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.get_my_employee_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT e.id FROM public.employees e
  JOIN public.users u ON u.email = e.email
  WHERE u.id = auth.uid()
  LIMIT 1
$$;


-- Name: get_my_employee_ids_as_manager(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.get_my_employee_ids_as_manager() RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT e.id FROM public.employees e
  WHERE e.user_id = auth.uid()
     OR e.manager_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
$$;


-- Name: is_company_admin_or_above(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.is_company_admin_or_above() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('Super Admin', 'Company Admin'))
$$;


-- Name: is_hr_or_above(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.is_hr_or_above() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('Super Admin', 'Company Admin', 'HR Manager'))
$$;


-- Name: is_manager_or_above(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.is_manager_or_above() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('Super Admin', 'Company Admin', 'HR Manager', 'Department Manager', 'Manager'))
$$;


-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin')
$$;


-- Name: log_audit_event(uuid, uuid, character varying, character varying, uuid, character varying, jsonb, jsonb, character varying, text, character varying, text); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.log_audit_event(p_user_id uuid, p_company_id uuid, p_action character varying, p_resource_type character varying, p_resource_id uuid DEFAULT NULL::uuid, p_resource_name character varying DEFAULT NULL::character varying, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_ip_address character varying DEFAULT NULL::character varying, p_user_agent text DEFAULT NULL::text, p_status character varying DEFAULT 'success'::character varying, p_error_message text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;


-- Name: user_has_company_access(uuid); Type: FUNCTION; Schema: public; Owner: -

CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND company_id = p_company_id)
$$;




-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    company_id uuid,
    activity_type character varying NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ip_address character varying
);


-- Name: annual_benefit_payments; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.annual_benefit_payments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    benefit_type character varying NOT NULL,
    year integer NOT NULL,
    paid_month character varying(7) NOT NULL,
    amount numeric(12,2),
    payroll_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- Name: attendance; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.attendance (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    date date NOT NULL,
    check_in time without time zone,
    check_out time without time zone,
    status character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- Name: audit_log_policies; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.audit_log_policies (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    company_id uuid,
    resource_type character varying,
    retention_days integer DEFAULT 90,
    archive_enabled boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    company_id uuid,
    action character varying NOT NULL,
    entity_type character varying DEFAULT ''::character varying NOT NULL,
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


-- Name: companies; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.companies (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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


-- Name: users; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.users (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    email character varying NOT NULL,
    first_name character varying,
    last_name character varying,
    role character varying DEFAULT 'employee'::character varying,
    company_id uuid,
    is_temporary_password boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- Name: audit_log_search; Type: VIEW; Schema: public; Owner: -

CREATE OR REPLACE VIEW public.audit_log_search WITH (security_invoker='on') AS
 SELECT al.id,
    al.user_id,
    concat(u.first_name, ' ', u.last_name) AS user_name,
    al.company_id,
    c.name AS company_name,
    al.action,
    COALESCE(al.resource_type, al.entity_type) AS resource_type,
    COALESCE(al.resource_id, al.entity_id) AS resource_id,
    al.resource_name,
    COALESCE(al.status, 'success'::character varying) AS status,
    al.created_at,
    al.ip_address,
    ((al.old_values IS NOT NULL) OR (al.new_values IS NOT NULL) OR (al.changes IS NOT NULL)) AS has_changes
   FROM ((public.audit_logs al
     LEFT JOIN public.users u ON ((al.user_id = u.id)))
     LEFT JOIN public.companies c ON ((al.company_id = c.id)));


-- Name: documents; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.documents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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


-- Name: employee_benefit_overrides; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.employee_benefit_overrides (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    benefit_type character varying NOT NULL,
    benefit_value numeric(12,2) DEFAULT 0 NOT NULL,
    value_type character varying DEFAULT 'fixed'::character varying NOT NULL,
    currency character varying(3) DEFAULT 'AED'::character varying,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- Name: employee_change_history; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.employee_change_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    change_type character varying NOT NULL,
    old_grade_id uuid,
    new_grade_id uuid,
    old_salary numeric(12,2),
    new_salary numeric(12,2),
    currency character varying(3) DEFAULT 'AED'::character varying,
    effective_month character varying(7),
    note text,
    changed_by uuid,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_change_history_change_type_check CHECK (((change_type)::text = ANY ((ARRAY['grade'::character varying, 'salary'::character varying, 'benefits'::character varying])::text[])))
);


-- Name: employee_grades; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.employee_grades (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    name character varying NOT NULL,
    description text,
    base_salary numeric(12,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    level integer DEFAULT 1 NOT NULL,
    active boolean DEFAULT true NOT NULL
);


-- Name: employee_leave_balance; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.employee_leave_balance (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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


-- Name: employee_leave_deduction_tracking; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.employee_leave_deduction_tracking (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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


-- Name: employees; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    manager_id uuid,
    salary_override numeric(12,2),
    archived_at timestamp without time zone,
    archived_by uuid
);


-- Name: grade_benefits; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.grade_benefits (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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


-- Name: grade_change_requests; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.grade_change_requests (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    company_id uuid,
    request_type character varying NOT NULL,
    change_grade boolean DEFAULT false NOT NULL,
    current_grade_id uuid,
    requested_grade_id uuid,
    change_salary boolean DEFAULT false NOT NULL,
    current_salary numeric(12,2),
    requested_salary numeric(12,2),
    change_benefits boolean DEFAULT false NOT NULL,
    benefit_changes jsonb,
    currency character varying(3) DEFAULT 'AED'::character varying,
    reason text,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    effective_month character varying(7),
    requested_by uuid,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    review_note text,
    CONSTRAINT grade_change_requests_request_type_check CHECK (((request_type)::text = ANY ((ARRAY['promotion'::character varying, 'demotion'::character varying, 'lateral'::character varying])::text[]))),
    CONSTRAINT grade_change_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);


-- Name: grade_leave_config; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.grade_leave_config (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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


-- Name: grade_salary_config; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.grade_salary_config (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    grade_id uuid NOT NULL,
    salary_component character varying,
    amount numeric(12,2),
    is_deduction boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    salary numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'AED'::character varying NOT NULL,
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    effective_to date,
    notes text,
    company_id uuid
);


-- Name: grade_summary; Type: VIEW; Schema: public; Owner: -

CREATE OR REPLACE VIEW public.grade_summary WITH (security_invoker='on') AS
 SELECT g.id,
    g.company_id,
    g.name,
    g.level,
    g.description,
    g.active,
    g.created_at,
    g.updated_at,
    count(e.id) AS employee_count,
    s.salary,
    s.currency
   FROM ((public.employee_grades g
     LEFT JOIN public.employees e ON (((e.grade_id = g.id) AND ((e.status)::text = 'active'::text))))
     LEFT JOIN LATERAL ( SELECT sc.salary,
            sc.currency
           FROM public.grade_salary_config sc
          WHERE ((sc.grade_id = g.id) AND (sc.effective_from <= CURRENT_DATE) AND ((sc.effective_to IS NULL) OR (sc.effective_to >= CURRENT_DATE)))
          ORDER BY sc.effective_from DESC
         LIMIT 1) s ON (true))
  GROUP BY g.id, g.company_id, g.name, g.level, g.description, g.active, g.created_at, g.updated_at, s.salary, s.currency;


-- Name: leave_approvers; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.leave_approvers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    approver_id uuid NOT NULL,
    leave_type character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approval_level integer DEFAULT 1,
    active boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT now()
);


-- Name: leave_types; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.leave_types (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    company_id uuid,
    name character varying NOT NULL,
    description text,
    days_allocated integer,
    is_paid boolean DEFAULT true,
    requires_approval boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    days_per_year integer DEFAULT 0 NOT NULL,
    allow_half_day boolean DEFAULT false NOT NULL,
    color character varying(7) DEFAULT '#3B82F6'::character varying,
    active boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


-- Name: leave_dashboard; Type: VIEW; Schema: public; Owner: -

CREATE OR REPLACE VIEW public.leave_dashboard WITH (security_invoker='on') AS
 SELECT e.id AS employee_id,
    concat(e.first_name, ' ', e.last_name) AS employee_name,
    e.company_id,
    lt.name AS leave_type,
    COALESCE(elb.total_days, elb.days_allocated) AS total_days,
    COALESCE(elb.used_days, elb.days_used) AS used_days,
    COALESCE(elb.pending_days, 0) AS pending_days,
    COALESCE(elb.remaining_days, elb.days_remaining) AS remaining_days,
    elb.year,
        CASE
            WHEN (COALESCE(elb.total_days, elb.days_allocated, 0) = 0) THEN (0)::numeric
            ELSE round((((COALESCE(elb.used_days, elb.days_used, 0))::numeric / (NULLIF(COALESCE(elb.total_days, elb.days_allocated), 0))::numeric) * (100)::numeric), 1)
        END AS usage_percentage
   FROM ((public.employees e
     JOIN public.employee_leave_balance elb ON ((elb.employee_id = e.id)))
     JOIN public.leave_types lt ON ((lt.id = elb.leave_type_id)));


-- Name: leaves; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.leaves (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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


-- Name: modules; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.modules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description text,
    icon character varying,
    path character varying,
    order_index integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_system boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT now()
);


-- Name: payroll; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.payroll (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    leave_deduction_amount numeric DEFAULT 0,
    adjustment numeric(12,2) DEFAULT 0,
    adjustment_note character varying,
    adjustments jsonb
);


-- Name: pdc_cheques; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.pdc_cheques (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    cheque_type character varying NOT NULL,
    cheque_number character varying NOT NULL,
    bank_name character varying,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    currency character varying(3) DEFAULT 'AED'::character varying,
    cheque_date date NOT NULL,
    party_name character varying,
    reference character varying,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pdc_cheques_cheque_type_check CHECK (((cheque_type)::text = ANY ((ARRAY['payable'::character varying, 'receivable'::character varying])::text[]))),
    CONSTRAINT pdc_cheques_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'cleared'::character varying, 'bounced'::character varying, 'cancelled'::character varying])::text[])))
);


-- Name: role_modules; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.role_modules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    role_id uuid NOT NULL,
    module_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    role_id uuid NOT NULL,
    resource character varying NOT NULL,
    action character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- Name: roles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.roles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description text,
    company_id uuid,
    is_system boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- Name: user_companies; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.user_companies (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_at timestamp without time zone
);


-- Name: user_roles; Type: TABLE; Schema: public; Owner: -

CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    company_id uuid NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_by uuid
);


-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: annual_benefit_payments annual_benefit_payments_employee_id_benefit_type_year_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.annual_benefit_payments ADD CONSTRAINT annual_benefit_payments_employee_id_benefit_type_year_key UNIQUE (employee_id, benefit_type, year); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: annual_benefit_payments annual_benefit_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.annual_benefit_payments ADD CONSTRAINT annual_benefit_payments_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.attendance ADD CONSTRAINT attendance_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: audit_log_policies audit_log_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.audit_log_policies ADD CONSTRAINT audit_log_policies_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: companies companies_email_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.companies ADD CONSTRAINT companies_email_key UNIQUE (email); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_benefit_overrides employee_benefit_overrides_employee_id_benefit_type_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_benefit_overrides ADD CONSTRAINT employee_benefit_overrides_employee_id_benefit_type_key UNIQUE (employee_id, benefit_type); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_benefit_overrides employee_benefit_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_benefit_overrides ADD CONSTRAINT employee_benefit_overrides_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_change_history employee_change_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_change_history ADD CONSTRAINT employee_change_history_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_grades employee_grades_company_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_grades ADD CONSTRAINT employee_grades_company_id_name_key UNIQUE (company_id, name); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_grades employee_grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_grades ADD CONSTRAINT employee_grades_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_leave_balance employee_leave_balance_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_leave_balance ADD CONSTRAINT employee_leave_balance_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_leave_balance employee_leave_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_leave_balance ADD CONSTRAINT employee_leave_balance_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_leave_deduction_tracking employee_leave_deduction_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_leave_deduction_tracking ADD CONSTRAINT employee_leave_deduction_tracking_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_email_key UNIQUE (email); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_benefits grade_benefits_grade_id_benefit_type_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_benefits ADD CONSTRAINT grade_benefits_grade_id_benefit_type_key UNIQUE (grade_id, benefit_type); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_benefits grade_benefits_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_benefits ADD CONSTRAINT grade_benefits_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_change_requests grade_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_change_requests ADD CONSTRAINT grade_change_requests_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_leave_config grade_leave_config_grade_id_leave_type_id_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_grade_id_leave_type_id_key UNIQUE (grade_id, leave_type_id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_leave_config grade_leave_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_salary_config grade_salary_config_grade_id_salary_component_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_salary_config ADD CONSTRAINT grade_salary_config_grade_id_salary_component_key UNIQUE (grade_id, salary_component); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_salary_config grade_salary_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_salary_config ADD CONSTRAINT grade_salary_config_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leave_approvers leave_approvers_company_id_employee_id_approver_id_leave_ty_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_company_id_employee_id_approver_id_leave_ty_key UNIQUE (company_id, employee_id, approver_id, leave_type); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leave_approvers leave_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leave_types leave_types_company_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_company_id_name_key UNIQUE (company_id, name); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leaves leaves_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leaves ADD CONSTRAINT leaves_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: modules modules_name_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.modules ADD CONSTRAINT modules_name_key UNIQUE (name); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.modules ADD CONSTRAINT modules_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.payroll ADD CONSTRAINT payroll_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: pdc_cheques pdc_cheques_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.pdc_cheques ADD CONSTRAINT pdc_cheques_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: role_modules role_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.role_modules ADD CONSTRAINT role_modules_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: role_modules role_modules_role_id_module_id_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.role_modules ADD CONSTRAINT role_modules_role_id_module_id_key UNIQUE (role_id, module_id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: role_permissions role_permissions_role_id_resource_action_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_id_resource_action_key UNIQUE (role_id, resource, action); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.roles ADD CONSTRAINT roles_name_key UNIQUE (name); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.roles ADD CONSTRAINT roles_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_companies user_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_companies ADD CONSTRAINT user_companies_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_companies user_companies_user_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_companies ADD CONSTRAINT user_companies_user_id_company_id_key UNIQUE (user_id, company_id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_roles user_roles_user_id_role_id_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_id_company_id_key UNIQUE (user_id, role_id, company_id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: idx_activity_logs_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON public.activity_logs USING btree (company_id);


-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);


-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


-- Name: idx_annual_benefit_payments_emp_year; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_annual_benefit_payments_emp_year ON public.annual_benefit_payments USING btree (employee_id, year);


-- Name: idx_attendance_date; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance USING btree (date);


-- Name: idx_attendance_emp_date; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance USING btree (employee_id, date);


-- Name: idx_attendance_employee_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON public.attendance USING btree (employee_id);


-- Name: idx_audit_log_policies_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_audit_log_policies_company_id ON public.audit_log_policies USING btree (company_id);


-- Name: idx_audit_logs_company; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs USING btree (company_id);


-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


-- Name: idx_companies_email; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_companies_email ON public.companies USING btree (email);


-- Name: idx_companies_name; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies USING btree (name);


-- Name: idx_documents_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_documents_company_id ON public.documents USING btree (company_id);


-- Name: idx_documents_employee_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON public.documents USING btree (employee_id);


-- Name: idx_documents_expiry_date; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON public.documents USING btree (expiry_date);


-- Name: idx_elb_leave_type_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_elb_leave_type_id ON public.employee_leave_balance USING btree (leave_type_id);


-- Name: idx_emp_change_history_company; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_emp_change_history_company ON public.employee_change_history USING btree (company_id);


-- Name: idx_emp_change_history_employee; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_emp_change_history_employee ON public.employee_change_history USING btree (employee_id, changed_at DESC);


-- Name: idx_employee_benefit_overrides_employee; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employee_benefit_overrides_employee ON public.employee_benefit_overrides USING btree (employee_id);


-- Name: idx_employee_grades_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employee_grades_company_id ON public.employee_grades USING btree (company_id);


-- Name: idx_employee_leave_balance_year; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employee_leave_balance_year ON public.employee_leave_balance USING btree (year);


-- Name: idx_employee_leave_deduction_employee_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employee_leave_deduction_employee_id ON public.employee_leave_deduction_tracking USING btree (employee_id);


-- Name: idx_employee_leave_deduction_payroll_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employee_leave_deduction_payroll_id ON public.employee_leave_deduction_tracking USING btree (payroll_id);


-- Name: idx_employees_archived_at; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employees_archived_at ON public.employees USING btree (archived_at);


-- Name: idx_employees_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employees_company_id ON public.employees USING btree (company_id);


-- Name: idx_employees_department; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees USING btree (department);


-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees USING btree (email);


-- Name: idx_employees_grade_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employees_grade_id ON public.employees USING btree (grade_id);


-- Name: idx_employees_manager_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON public.employees USING btree (manager_id);


-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees USING btree (status);


-- Name: idx_employees_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees USING btree (user_id);


-- Name: idx_grade_benefits_company; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_benefits_company ON public.grade_benefits USING btree (company_id);


-- Name: idx_grade_benefits_grade; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_benefits_grade ON public.grade_benefits USING btree (grade_id);


-- Name: idx_grade_change_requests_company_status; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_change_requests_company_status ON public.grade_change_requests USING btree (company_id, status);


-- Name: idx_grade_change_requests_employee; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_change_requests_employee ON public.grade_change_requests USING btree (employee_id);


-- Name: idx_grade_leave_company; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_leave_company ON public.grade_leave_config USING btree (company_id);


-- Name: idx_grade_leave_config_leave_type_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_leave_config_leave_type_id ON public.grade_leave_config USING btree (leave_type_id);


-- Name: idx_grade_leave_grade; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_leave_grade ON public.grade_leave_config USING btree (grade_id);


-- Name: idx_grade_salary_config_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_salary_config_company_id ON public.grade_salary_config USING btree (company_id);


-- Name: idx_grade_salary_grade; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_grade_salary_grade ON public.grade_salary_config USING btree (grade_id);


-- Name: idx_leave_approvers_approver_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leave_approvers_approver_id ON public.leave_approvers USING btree (approver_id);


-- Name: idx_leave_approvers_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leave_approvers_company_id ON public.leave_approvers USING btree (company_id);


-- Name: idx_leave_approvers_employee_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leave_approvers_employee_id ON public.leave_approvers USING btree (employee_id);


-- Name: idx_leave_balance_emp; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leave_balance_emp ON public.employee_leave_balance USING btree (employee_id);


-- Name: idx_leave_types_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leave_types_company_id ON public.leave_types USING btree (company_id);


-- Name: idx_leaves_approval_status; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leaves_approval_status ON public.leaves USING btree (approval_status);


-- Name: idx_leaves_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leaves_company_id ON public.leaves USING btree (company_id);


-- Name: idx_leaves_employee_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leaves_employee_id ON public.leaves USING btree (employee_id);


-- Name: idx_leaves_start_date; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leaves_start_date ON public.leaves USING btree (start_date);


-- Name: idx_leaves_status; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_leaves_status ON public.leaves USING btree (status);


-- Name: idx_payroll_employee_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_payroll_employee_id ON public.payroll USING btree (employee_id);


-- Name: idx_payroll_month; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_payroll_month ON public.payroll USING btree (month);


-- Name: idx_payroll_status; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_payroll_status ON public.payroll USING btree (status);


-- Name: idx_pdc_cheques_company_status; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_pdc_cheques_company_status ON public.pdc_cheques USING btree (company_id, status);


-- Name: idx_pdc_cheques_company_type; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_pdc_cheques_company_type ON public.pdc_cheques USING btree (company_id, cheque_type);


-- Name: idx_pdc_cheques_due; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_pdc_cheques_due ON public.pdc_cheques USING btree (cheque_date);


-- Name: idx_role_modules_module_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_role_modules_module_id ON public.role_modules USING btree (module_id);


-- Name: idx_role_modules_role_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_role_modules_role_id ON public.role_modules USING btree (role_id);


-- Name: idx_role_permissions_resource; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_role_permissions_resource ON public.role_permissions USING btree (resource);


-- Name: idx_role_permissions_role_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions USING btree (role_id);


-- Name: idx_roles_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_roles_company_id ON public.roles USING btree (company_id);


-- Name: idx_roles_name; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles USING btree (name);


-- Name: idx_user_companies_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_user_companies_company_id ON public.user_companies USING btree (company_id);


-- Name: idx_user_companies_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_user_companies_user_id ON public.user_companies USING btree (user_id);


-- Name: idx_user_roles_assigned_by; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON public.user_roles USING btree (assigned_by);


-- Name: idx_user_roles_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON public.user_roles USING btree (company_id);


-- Name: idx_user_roles_role_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles USING btree (role_id);


-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles USING btree (user_id);


-- Name: idx_users_company_id; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_users_company_id ON public.users USING btree (company_id);


-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);


-- Name: uq_leave_types_name; Type: INDEX; Schema: public; Owner: -

CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_types_name ON public.leave_types USING btree (lower((name)::text));


-- Name: activity_logs activity_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: annual_benefit_payments annual_benefit_payments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.annual_benefit_payments ADD CONSTRAINT annual_benefit_payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: annual_benefit_payments annual_benefit_payments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.annual_benefit_payments ADD CONSTRAINT annual_benefit_payments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: annual_benefit_payments annual_benefit_payments_payroll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.annual_benefit_payments ADD CONSTRAINT annual_benefit_payments_payroll_id_fkey FOREIGN KEY (payroll_id) REFERENCES public.payroll(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.attendance ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: audit_log_policies audit_log_policies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.audit_log_policies ADD CONSTRAINT audit_log_policies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: audit_logs audit_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: documents documents_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.documents ADD CONSTRAINT documents_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: documents documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.documents ADD CONSTRAINT documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_benefit_overrides employee_benefit_overrides_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_benefit_overrides ADD CONSTRAINT employee_benefit_overrides_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_benefit_overrides employee_benefit_overrides_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_benefit_overrides ADD CONSTRAINT employee_benefit_overrides_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_change_history employee_change_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_change_history ADD CONSTRAINT employee_change_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_change_history employee_change_history_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_change_history ADD CONSTRAINT employee_change_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_change_history employee_change_history_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_change_history ADD CONSTRAINT employee_change_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_change_history employee_change_history_new_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_change_history ADD CONSTRAINT employee_change_history_new_grade_id_fkey FOREIGN KEY (new_grade_id) REFERENCES public.employee_grades(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_change_history employee_change_history_old_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_change_history ADD CONSTRAINT employee_change_history_old_grade_id_fkey FOREIGN KEY (old_grade_id) REFERENCES public.employee_grades(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_grades employee_grades_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_grades ADD CONSTRAINT employee_grades_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_leave_balance employee_leave_balance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_leave_balance ADD CONSTRAINT employee_leave_balance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_leave_balance employee_leave_balance_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_leave_balance ADD CONSTRAINT employee_leave_balance_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_leave_deduction_tracking employee_leave_deduction_tracking_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_leave_deduction_tracking ADD CONSTRAINT employee_leave_deduction_tracking_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employee_leave_deduction_tracking employee_leave_deduction_tracking_payroll_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employee_leave_deduction_tracking ADD CONSTRAINT employee_leave_deduction_tracking_payroll_id_fkey FOREIGN KEY (payroll_id) REFERENCES public.payroll(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employees employees_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employees employees_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employees employees_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.employee_grades(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.employees ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_benefits grade_benefits_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_benefits ADD CONSTRAINT grade_benefits_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_benefits grade_benefits_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_benefits ADD CONSTRAINT grade_benefits_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.employee_grades(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_change_requests grade_change_requests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_change_requests ADD CONSTRAINT grade_change_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_change_requests grade_change_requests_current_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_change_requests ADD CONSTRAINT grade_change_requests_current_grade_id_fkey FOREIGN KEY (current_grade_id) REFERENCES public.employee_grades(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_change_requests grade_change_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_change_requests ADD CONSTRAINT grade_change_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_change_requests grade_change_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_change_requests ADD CONSTRAINT grade_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_change_requests grade_change_requests_requested_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_change_requests ADD CONSTRAINT grade_change_requests_requested_grade_id_fkey FOREIGN KEY (requested_grade_id) REFERENCES public.employee_grades(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_change_requests grade_change_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_change_requests ADD CONSTRAINT grade_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_leave_config grade_leave_config_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_leave_config grade_leave_config_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.employee_grades(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_leave_config grade_leave_config_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_leave_config ADD CONSTRAINT grade_leave_config_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_salary_config grade_salary_config_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_salary_config ADD CONSTRAINT grade_salary_config_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: grade_salary_config grade_salary_config_grade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.grade_salary_config ADD CONSTRAINT grade_salary_config_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.employee_grades(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leave_approvers leave_approvers_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leave_approvers leave_approvers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leave_approvers leave_approvers_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leave_approvers ADD CONSTRAINT leave_approvers_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leave_types leave_types_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leaves leaves_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leaves ADD CONSTRAINT leaves_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: leaves leaves_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.leaves ADD CONSTRAINT leaves_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: payroll payroll_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.payroll ADD CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: pdc_cheques pdc_cheques_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.pdc_cheques ADD CONSTRAINT pdc_cheques_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: pdc_cheques pdc_cheques_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.pdc_cheques ADD CONSTRAINT pdc_cheques_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: role_modules role_modules_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.role_modules ADD CONSTRAINT role_modules_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: role_modules role_modules_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.role_modules ADD CONSTRAINT role_modules_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: roles roles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.roles ADD CONSTRAINT roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_companies user_companies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_companies ADD CONSTRAINT user_companies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_companies user_companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_companies ADD CONSTRAINT user_companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id); EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_roles user_roles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: users users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -

DO $do$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE; EXCEPTION WHEN others THEN NULL; END $do$;


-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Name: activity_logs activity_logs_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS activity_logs_insert ON public.activity_logs;
CREATE POLICY activity_logs_insert ON public.activity_logs FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


-- Name: activity_logs activity_logs_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS activity_logs_read ON public.activity_logs;
CREATE POLICY activity_logs_read ON public.activity_logs FOR SELECT USING (public.is_hr_or_above());


-- Name: annual_benefit_payments; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.annual_benefit_payments ENABLE ROW LEVEL SECURITY;

-- Name: annual_benefit_payments annual_benefit_payments_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS annual_benefit_payments_delete ON public.annual_benefit_payments;
CREATE POLICY annual_benefit_payments_delete ON public.annual_benefit_payments FOR DELETE USING (public.is_hr_or_above());


-- Name: annual_benefit_payments annual_benefit_payments_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS annual_benefit_payments_insert ON public.annual_benefit_payments;
CREATE POLICY annual_benefit_payments_insert ON public.annual_benefit_payments FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: annual_benefit_payments annual_benefit_payments_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS annual_benefit_payments_read ON public.annual_benefit_payments;
CREATE POLICY annual_benefit_payments_read ON public.annual_benefit_payments FOR SELECT USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: annual_benefit_payments annual_benefit_payments_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS annual_benefit_payments_update ON public.annual_benefit_payments;
CREATE POLICY annual_benefit_payments_update ON public.annual_benefit_payments FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Name: attendance attendance_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS attendance_delete ON public.attendance;
CREATE POLICY attendance_delete ON public.attendance FOR DELETE USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: attendance attendance_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS attendance_insert ON public.attendance;
CREATE POLICY attendance_insert ON public.attendance FOR INSERT WITH CHECK ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: attendance attendance_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS attendance_read ON public.attendance;
CREATE POLICY attendance_read ON public.attendance FOR SELECT USING ((public.is_manager_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: attendance attendance_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS attendance_update ON public.attendance;
CREATE POLICY attendance_update ON public.attendance FOR UPDATE USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id()))) WITH CHECK ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: audit_log_policies; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.audit_log_policies ENABLE ROW LEVEL SECURITY;

-- Name: audit_log_policies audit_log_policies_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS audit_log_policies_delete ON public.audit_log_policies;
CREATE POLICY audit_log_policies_delete ON public.audit_log_policies FOR DELETE USING (public.is_company_admin_or_above());


-- Name: audit_log_policies audit_log_policies_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS audit_log_policies_insert ON public.audit_log_policies;
CREATE POLICY audit_log_policies_insert ON public.audit_log_policies FOR INSERT WITH CHECK (public.is_company_admin_or_above());


-- Name: audit_log_policies audit_log_policies_select; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS audit_log_policies_select ON public.audit_log_policies;
CREATE POLICY audit_log_policies_select ON public.audit_log_policies FOR SELECT USING (public.is_company_admin_or_above());


-- Name: audit_log_policies audit_log_policies_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS audit_log_policies_update ON public.audit_log_policies;
CREATE POLICY audit_log_policies_update ON public.audit_log_policies FOR UPDATE USING (public.is_company_admin_or_above()) WITH CHECK (public.is_company_admin_or_above());


-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Name: audit_logs audit_logs_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) IS NOT NULL));


-- Name: audit_logs audit_logs_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS audit_logs_read ON public.audit_logs;
CREATE POLICY audit_logs_read ON public.audit_logs FOR SELECT USING (public.is_hr_or_above());


-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Name: companies companies_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS companies_delete ON public.companies;
CREATE POLICY companies_delete ON public.companies FOR DELETE USING (public.is_super_admin());


-- Name: companies companies_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS companies_insert ON public.companies;
CREATE POLICY companies_insert ON public.companies FOR INSERT WITH CHECK (public.is_super_admin());


-- Name: companies companies_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS companies_read ON public.companies;
CREATE POLICY companies_read ON public.companies FOR SELECT USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR public.user_has_company_access(id))));


-- Name: companies companies_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies FOR UPDATE USING ((public.is_super_admin() OR (public.is_company_admin_or_above() AND public.user_has_company_access(id)))) WITH CHECK ((public.is_super_admin() OR (public.is_company_admin_or_above() AND public.user_has_company_access(id))));


-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Name: documents documents_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_delete ON public.documents FOR DELETE USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id)))));


-- Name: documents documents_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS documents_read ON public.documents;
CREATE POLICY documents_read ON public.documents FOR SELECT USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR public.user_has_company_access(company_id))));


-- Name: documents documents_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents FOR UPDATE USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR (public.user_has_company_access(company_id) AND (public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())))))) WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR (public.user_has_company_access(company_id) AND (public.is_hr_or_above() OR (employee_id = public.get_my_employee_id()))))));


-- Name: documents documents_write; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS documents_write ON public.documents;
CREATE POLICY documents_write ON public.documents FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR (public.user_has_company_access(company_id) AND (public.is_hr_or_above() OR (employee_id = public.get_my_employee_id()))))));


-- Name: employee_benefit_overrides; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.employee_benefit_overrides ENABLE ROW LEVEL SECURITY;

-- Name: employee_benefit_overrides employee_benefit_overrides_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_benefit_overrides_delete ON public.employee_benefit_overrides;
CREATE POLICY employee_benefit_overrides_delete ON public.employee_benefit_overrides FOR DELETE USING (public.is_hr_or_above());


-- Name: employee_benefit_overrides employee_benefit_overrides_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_benefit_overrides_insert ON public.employee_benefit_overrides;
CREATE POLICY employee_benefit_overrides_insert ON public.employee_benefit_overrides FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: employee_benefit_overrides employee_benefit_overrides_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_benefit_overrides_read ON public.employee_benefit_overrides;
CREATE POLICY employee_benefit_overrides_read ON public.employee_benefit_overrides FOR SELECT USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: employee_benefit_overrides employee_benefit_overrides_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_benefit_overrides_update ON public.employee_benefit_overrides;
CREATE POLICY employee_benefit_overrides_update ON public.employee_benefit_overrides FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: employee_change_history; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.employee_change_history ENABLE ROW LEVEL SECURITY;

-- Name: employee_change_history employee_change_history_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_change_history_delete ON public.employee_change_history;
CREATE POLICY employee_change_history_delete ON public.employee_change_history FOR DELETE USING (public.is_hr_or_above());


-- Name: employee_change_history employee_change_history_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_change_history_insert ON public.employee_change_history;
CREATE POLICY employee_change_history_insert ON public.employee_change_history FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: employee_change_history employee_change_history_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_change_history_read ON public.employee_change_history;
CREATE POLICY employee_change_history_read ON public.employee_change_history FOR SELECT USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: employee_change_history employee_change_history_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_change_history_update ON public.employee_change_history;
CREATE POLICY employee_change_history_update ON public.employee_change_history FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: employee_grades; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.employee_grades ENABLE ROW LEVEL SECURITY;

-- Name: employee_grades employee_grades_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_grades_delete ON public.employee_grades;
CREATE POLICY employee_grades_delete ON public.employee_grades FOR DELETE USING (public.is_hr_or_above());


-- Name: employee_grades employee_grades_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_grades_insert ON public.employee_grades;
CREATE POLICY employee_grades_insert ON public.employee_grades FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: employee_grades employee_grades_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_grades_read ON public.employee_grades;
CREATE POLICY employee_grades_read ON public.employee_grades FOR SELECT USING ((public.is_hr_or_above() OR (company_id = public.get_my_company_id()) OR ((( SELECT auth.uid() AS uid) IS NOT NULL) AND (id IN ( SELECT employees.grade_id
   FROM public.employees
  WHERE ((employees.user_id = ( SELECT auth.uid() AS uid)) AND (employees.grade_id IS NOT NULL)))))));


-- Name: employee_grades employee_grades_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_grades_update ON public.employee_grades;
CREATE POLICY employee_grades_update ON public.employee_grades FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: employee_leave_balance; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.employee_leave_balance ENABLE ROW LEVEL SECURITY;

-- Name: employee_leave_balance employee_leave_balance_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_leave_balance_delete ON public.employee_leave_balance;
CREATE POLICY employee_leave_balance_delete ON public.employee_leave_balance FOR DELETE USING (public.is_hr_or_above());


-- Name: employee_leave_balance employee_leave_balance_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_leave_balance_insert ON public.employee_leave_balance;
CREATE POLICY employee_leave_balance_insert ON public.employee_leave_balance FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: employee_leave_balance employee_leave_balance_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_leave_balance_update ON public.employee_leave_balance;
CREATE POLICY employee_leave_balance_update ON public.employee_leave_balance FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: employee_leave_deduction_tracking; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.employee_leave_deduction_tracking ENABLE ROW LEVEL SECURITY;

-- Name: employee_leave_deduction_tracking employee_leave_deduction_tracking_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_leave_deduction_tracking_delete ON public.employee_leave_deduction_tracking;
CREATE POLICY employee_leave_deduction_tracking_delete ON public.employee_leave_deduction_tracking FOR DELETE USING (public.is_hr_or_above());


-- Name: employee_leave_deduction_tracking employee_leave_deduction_tracking_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_leave_deduction_tracking_insert ON public.employee_leave_deduction_tracking;
CREATE POLICY employee_leave_deduction_tracking_insert ON public.employee_leave_deduction_tracking FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: employee_leave_deduction_tracking employee_leave_deduction_tracking_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employee_leave_deduction_tracking_update ON public.employee_leave_deduction_tracking;
CREATE POLICY employee_leave_deduction_tracking_update ON public.employee_leave_deduction_tracking FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Name: employees employees_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employees_delete ON public.employees;
CREATE POLICY employees_delete ON public.employees FOR DELETE USING (public.is_hr_or_above());


-- Name: employees employees_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employees_insert ON public.employees;
CREATE POLICY employees_insert ON public.employees FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: employees employees_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employees_read ON public.employees;
CREATE POLICY employees_read ON public.employees FOR SELECT USING ((public.is_hr_or_above() OR (company_id = public.get_my_company_id()) OR (id = public.get_my_employee_id())));


-- Name: employees employees_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS employees_update ON public.employees;
CREATE POLICY employees_update ON public.employees FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: grade_benefits; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.grade_benefits ENABLE ROW LEVEL SECURITY;

-- Name: grade_benefits grade_benefits_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_benefits_delete ON public.grade_benefits;
CREATE POLICY grade_benefits_delete ON public.grade_benefits FOR DELETE USING (public.is_hr_or_above());


-- Name: grade_benefits grade_benefits_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_benefits_insert ON public.grade_benefits;
CREATE POLICY grade_benefits_insert ON public.grade_benefits FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: grade_benefits grade_benefits_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_benefits_read ON public.grade_benefits;
CREATE POLICY grade_benefits_read ON public.grade_benefits FOR SELECT USING ((public.is_hr_or_above() OR ((( SELECT auth.uid() AS uid) IS NOT NULL) AND (grade_id IN ( SELECT employees.grade_id
   FROM public.employees
  WHERE ((employees.user_id = ( SELECT auth.uid() AS uid)) AND (employees.grade_id IS NOT NULL)))))));


-- Name: grade_benefits grade_benefits_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_benefits_update ON public.grade_benefits;
CREATE POLICY grade_benefits_update ON public.grade_benefits FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: grade_change_requests; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.grade_change_requests ENABLE ROW LEVEL SECURITY;

-- Name: grade_change_requests grade_change_requests_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_change_requests_delete ON public.grade_change_requests;
CREATE POLICY grade_change_requests_delete ON public.grade_change_requests FOR DELETE USING (public.is_company_admin_or_above());


-- Name: grade_change_requests grade_change_requests_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_change_requests_insert ON public.grade_change_requests;
CREATE POLICY grade_change_requests_insert ON public.grade_change_requests FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: grade_change_requests grade_change_requests_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_change_requests_read ON public.grade_change_requests;
CREATE POLICY grade_change_requests_read ON public.grade_change_requests FOR SELECT USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: grade_change_requests grade_change_requests_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_change_requests_update ON public.grade_change_requests;
CREATE POLICY grade_change_requests_update ON public.grade_change_requests FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: grade_leave_config; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.grade_leave_config ENABLE ROW LEVEL SECURITY;

-- Name: grade_leave_config grade_leave_config_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_leave_config_delete ON public.grade_leave_config;
CREATE POLICY grade_leave_config_delete ON public.grade_leave_config FOR DELETE USING (public.is_hr_or_above());


-- Name: grade_leave_config grade_leave_config_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_leave_config_insert ON public.grade_leave_config;
CREATE POLICY grade_leave_config_insert ON public.grade_leave_config FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: grade_leave_config grade_leave_config_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_leave_config_update ON public.grade_leave_config;
CREATE POLICY grade_leave_config_update ON public.grade_leave_config FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: grade_leave_config grade_leave_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_leave_read ON public.grade_leave_config;
CREATE POLICY grade_leave_read ON public.grade_leave_config FOR SELECT USING (public.is_hr_or_above());


-- Name: grade_salary_config; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.grade_salary_config ENABLE ROW LEVEL SECURITY;

-- Name: grade_salary_config grade_salary_config_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_salary_config_delete ON public.grade_salary_config;
CREATE POLICY grade_salary_config_delete ON public.grade_salary_config FOR DELETE USING (public.is_hr_or_above());


-- Name: grade_salary_config grade_salary_config_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_salary_config_insert ON public.grade_salary_config;
CREATE POLICY grade_salary_config_insert ON public.grade_salary_config FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: grade_salary_config grade_salary_config_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_salary_config_update ON public.grade_salary_config;
CREATE POLICY grade_salary_config_update ON public.grade_salary_config FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: grade_salary_config grade_salary_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS grade_salary_read ON public.grade_salary_config;
CREATE POLICY grade_salary_read ON public.grade_salary_config FOR SELECT USING ((public.is_hr_or_above() OR ((( SELECT auth.uid() AS uid) IS NOT NULL) AND (grade_id IN ( SELECT employees.grade_id
   FROM public.employees
  WHERE ((employees.user_id = ( SELECT auth.uid() AS uid)) AND (employees.grade_id IS NOT NULL)))))));


-- Name: leave_approvers; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.leave_approvers ENABLE ROW LEVEL SECURITY;

-- Name: leave_approvers leave_approvers_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_approvers_delete ON public.leave_approvers;
CREATE POLICY leave_approvers_delete ON public.leave_approvers FOR DELETE USING (public.is_hr_or_above());


-- Name: leave_approvers leave_approvers_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_approvers_insert ON public.leave_approvers;
CREATE POLICY leave_approvers_insert ON public.leave_approvers FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: leave_approvers leave_approvers_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_approvers_read ON public.leave_approvers;
CREATE POLICY leave_approvers_read ON public.leave_approvers FOR SELECT USING (public.is_manager_or_above());


-- Name: leave_approvers leave_approvers_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_approvers_update ON public.leave_approvers;
CREATE POLICY leave_approvers_update ON public.leave_approvers FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: employee_leave_balance leave_balance_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_balance_read ON public.employee_leave_balance;
CREATE POLICY leave_balance_read ON public.employee_leave_balance FOR SELECT USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: employee_leave_deduction_tracking leave_deduction_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_deduction_read ON public.employee_leave_deduction_tracking;
CREATE POLICY leave_deduction_read ON public.employee_leave_deduction_tracking FOR SELECT USING (public.is_hr_or_above());


-- Name: leave_types; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

-- Name: leave_types leave_types_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_types_delete ON public.leave_types;
CREATE POLICY leave_types_delete ON public.leave_types FOR DELETE USING (public.is_hr_or_above());


-- Name: leave_types leave_types_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_types_insert ON public.leave_types;
CREATE POLICY leave_types_insert ON public.leave_types FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: leave_types leave_types_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_types_read ON public.leave_types;
CREATE POLICY leave_types_read ON public.leave_types FOR SELECT USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


-- Name: leave_types leave_types_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leave_types_update ON public.leave_types;
CREATE POLICY leave_types_update ON public.leave_types FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: leaves; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Name: leaves leaves_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leaves_delete ON public.leaves;
CREATE POLICY leaves_delete ON public.leaves FOR DELETE USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: leaves leaves_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leaves_insert ON public.leaves;
CREATE POLICY leaves_insert ON public.leaves FOR INSERT WITH CHECK ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: leaves leaves_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leaves_read ON public.leaves;
CREATE POLICY leaves_read ON public.leaves FOR SELECT USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id()) OR (company_id = public.get_my_company_id())));


-- Name: leaves leaves_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS leaves_update ON public.leaves;
CREATE POLICY leaves_update ON public.leaves FOR UPDATE USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id()))) WITH CHECK ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: modules; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Name: modules modules_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS modules_delete ON public.modules;
CREATE POLICY modules_delete ON public.modules FOR DELETE USING (public.is_super_admin());


-- Name: modules modules_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS modules_insert ON public.modules;
CREATE POLICY modules_insert ON public.modules FOR INSERT WITH CHECK (public.is_super_admin());


-- Name: modules modules_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS modules_read ON public.modules;
CREATE POLICY modules_read ON public.modules FOR SELECT USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


-- Name: modules modules_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS modules_update ON public.modules;
CREATE POLICY modules_update ON public.modules FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());


-- Name: payroll; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

-- Name: payroll payroll_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS payroll_delete ON public.payroll;
CREATE POLICY payroll_delete ON public.payroll FOR DELETE USING (public.is_hr_or_above());


-- Name: payroll payroll_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS payroll_insert ON public.payroll;
CREATE POLICY payroll_insert ON public.payroll FOR INSERT WITH CHECK (public.is_hr_or_above());


-- Name: payroll payroll_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS payroll_read ON public.payroll;
CREATE POLICY payroll_read ON public.payroll FOR SELECT USING ((public.is_hr_or_above() OR (employee_id = public.get_my_employee_id())));


-- Name: payroll payroll_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS payroll_update ON public.payroll;
CREATE POLICY payroll_update ON public.payroll FOR UPDATE USING (public.is_hr_or_above()) WITH CHECK (public.is_hr_or_above());


-- Name: pdc_cheques; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.pdc_cheques ENABLE ROW LEVEL SECURITY;

-- Name: pdc_cheques pdc_cheques_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS pdc_cheques_delete ON public.pdc_cheques;
CREATE POLICY pdc_cheques_delete ON public.pdc_cheques FOR DELETE USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR (public.is_company_admin_or_above() AND public.user_has_company_access(company_id)))));


-- Name: pdc_cheques pdc_cheques_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS pdc_cheques_insert ON public.pdc_cheques;
CREATE POLICY pdc_cheques_insert ON public.pdc_cheques FOR INSERT WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id)))));


-- Name: pdc_cheques pdc_cheques_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS pdc_cheques_read ON public.pdc_cheques;
CREATE POLICY pdc_cheques_read ON public.pdc_cheques FOR SELECT USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR public.user_has_company_access(company_id))));


-- Name: pdc_cheques pdc_cheques_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS pdc_cheques_update ON public.pdc_cheques;
CREATE POLICY pdc_cheques_update ON public.pdc_cheques FOR UPDATE USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id))))) WITH CHECK (((( SELECT auth.uid() AS uid) IS NOT NULL) AND (public.is_super_admin() OR (public.is_hr_or_above() AND public.user_has_company_access(company_id)))));


-- Name: role_modules; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.role_modules ENABLE ROW LEVEL SECURITY;

-- Name: role_modules role_modules_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS role_modules_delete ON public.role_modules;
CREATE POLICY role_modules_delete ON public.role_modules FOR DELETE USING (public.is_company_admin_or_above());


-- Name: role_modules role_modules_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS role_modules_insert ON public.role_modules;
CREATE POLICY role_modules_insert ON public.role_modules FOR INSERT WITH CHECK (public.is_company_admin_or_above());


-- Name: role_modules role_modules_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS role_modules_read ON public.role_modules;
CREATE POLICY role_modules_read ON public.role_modules FOR SELECT USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


-- Name: role_modules role_modules_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS role_modules_update ON public.role_modules;
CREATE POLICY role_modules_update ON public.role_modules FOR UPDATE USING (public.is_company_admin_or_above()) WITH CHECK (public.is_company_admin_or_above());


-- Name: role_permissions; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Name: role_permissions role_permissions_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS role_permissions_delete ON public.role_permissions;
CREATE POLICY role_permissions_delete ON public.role_permissions FOR DELETE USING (public.is_company_admin_or_above());


-- Name: role_permissions role_permissions_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS role_permissions_insert ON public.role_permissions;
CREATE POLICY role_permissions_insert ON public.role_permissions FOR INSERT WITH CHECK (public.is_company_admin_or_above());


-- Name: role_permissions role_permissions_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


-- Name: role_permissions role_permissions_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS role_permissions_update ON public.role_permissions;
CREATE POLICY role_permissions_update ON public.role_permissions FOR UPDATE USING (public.is_company_admin_or_above()) WITH CHECK (public.is_company_admin_or_above());


-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Name: roles roles_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS roles_delete ON public.roles;
CREATE POLICY roles_delete ON public.roles FOR DELETE USING ((public.is_company_admin_or_above() AND (is_system = false)));


-- Name: roles roles_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS roles_insert ON public.roles;
CREATE POLICY roles_insert ON public.roles FOR INSERT WITH CHECK (public.is_company_admin_or_above());


-- Name: roles roles_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles FOR SELECT USING ((( SELECT auth.uid() AS uid) IS NOT NULL));


-- Name: roles roles_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS roles_update ON public.roles;
CREATE POLICY roles_update ON public.roles FOR UPDATE USING ((public.is_company_admin_or_above() AND (is_system = false))) WITH CHECK (public.is_company_admin_or_above());


-- Name: user_companies; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Name: user_companies user_companies_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS user_companies_delete ON public.user_companies;
CREATE POLICY user_companies_delete ON public.user_companies FOR DELETE USING (public.is_company_admin_or_above());


-- Name: user_companies user_companies_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS user_companies_insert ON public.user_companies;
CREATE POLICY user_companies_insert ON public.user_companies FOR INSERT WITH CHECK (public.is_company_admin_or_above());


-- Name: user_companies user_companies_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS user_companies_read ON public.user_companies;
CREATE POLICY user_companies_read ON public.user_companies FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_company_admin_or_above()));


-- Name: user_companies user_companies_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS user_companies_update ON public.user_companies;
CREATE POLICY user_companies_update ON public.user_companies FOR UPDATE USING (public.is_company_admin_or_above()) WITH CHECK (public.is_company_admin_or_above());


-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Name: user_roles user_roles_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;
CREATE POLICY user_roles_delete ON public.user_roles FOR DELETE USING (public.is_company_admin_or_above());


-- Name: user_roles user_roles_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
CREATE POLICY user_roles_insert ON public.user_roles FOR INSERT WITH CHECK (public.is_company_admin_or_above());


-- Name: user_roles user_roles_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS user_roles_read ON public.user_roles;
CREATE POLICY user_roles_read ON public.user_roles FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_hr_or_above()));


-- Name: user_roles user_roles_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
CREATE POLICY user_roles_update ON public.user_roles FOR UPDATE USING (public.is_company_admin_or_above()) WITH CHECK (public.is_company_admin_or_above());


-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Name: users users_delete; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS users_delete ON public.users;
CREATE POLICY users_delete ON public.users FOR DELETE USING (public.is_company_admin_or_above());


-- Name: users users_insert; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users FOR INSERT WITH CHECK (public.is_company_admin_or_above());


-- Name: users users_read; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS users_read ON public.users;
CREATE POLICY users_read ON public.users FOR SELECT USING (((id = ( SELECT auth.uid() AS uid)) OR public.is_hr_or_above()));


-- Name: users users_update; Type: POLICY; Schema: public; Owner: -

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE USING (public.is_company_admin_or_above()) WITH CHECK (public.is_company_admin_or_above());





-- ============================================================================
-- 5. STORAGE — private "documents" bucket (5 MB limit) + access policies
-- ============================================================================
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

-- ============================================================================
-- 6. REFERENCE DATA — roles, modules, permissions, leave types
--    (client-agnostic master data; companies/employees are added in the app)
-- ============================================================================




-- Data for Name: leave_types; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.leave_types (id, company_id, name, description, days_allocated, is_paid, requires_approval, created_at, days_per_year, allow_half_day, color, active, updated_at) VALUES ('b0243189-55c7-4be8-9e21-5d7b88b0a1d0', NULL, 'Vacation', NULL, NULL, true, true, '2026-05-10 17:50:30.413238', 20, true, '#3B82F6', true, '2026-05-10 17:50:30.413238') ON CONFLICT DO NOTHING;
INSERT INTO public.leave_types (id, company_id, name, description, days_allocated, is_paid, requires_approval, created_at, days_per_year, allow_half_day, color, active, updated_at) VALUES ('94a86b70-3fa4-481b-9201-a4f8104937e9', NULL, 'Sick Leave', NULL, NULL, true, true, '2026-05-10 17:50:30.413238', 10, false, '#EF4444', true, '2026-05-10 17:50:30.413238') ON CONFLICT DO NOTHING;
INSERT INTO public.leave_types (id, company_id, name, description, days_allocated, is_paid, requires_approval, created_at, days_per_year, allow_half_day, color, active, updated_at) VALUES ('a2e31972-ba05-47c8-844e-a25070f05cdd', NULL, 'Personal Leave', NULL, NULL, true, true, '2026-05-10 17:50:30.413238', 5, true, '#8B5CF6', true, '2026-05-10 17:50:30.413238') ON CONFLICT DO NOTHING;
INSERT INTO public.leave_types (id, company_id, name, description, days_allocated, is_paid, requires_approval, created_at, days_per_year, allow_half_day, color, active, updated_at) VALUES ('18ac7032-a43e-4eea-8752-2fe3fedd48ee', NULL, 'Maternity Leave', NULL, NULL, true, true, '2026-05-10 17:50:30.413238', 60, true, '#EC4899', true, '2026-05-10 17:50:30.413238') ON CONFLICT DO NOTHING;
INSERT INTO public.leave_types (id, company_id, name, description, days_allocated, is_paid, requires_approval, created_at, days_per_year, allow_half_day, color, active, updated_at) VALUES ('e507595c-507c-4b09-a29c-fb7b36f3007f', NULL, 'Paternity Leave', NULL, NULL, true, true, '2026-05-10 17:50:30.413238', 5, true, '#EC4899', true, '2026-05-10 17:50:30.413238') ON CONFLICT DO NOTHING;
INSERT INTO public.leave_types (id, company_id, name, description, days_allocated, is_paid, requires_approval, created_at, days_per_year, allow_half_day, color, active, updated_at) VALUES ('a370b2a4-4bf0-4ebc-98a4-830be796752e', NULL, 'Bereavement Leave', NULL, NULL, true, true, '2026-05-10 17:50:30.413238', 3, false, '#6B7280', true, '2026-05-10 17:50:30.413238') ON CONFLICT DO NOTHING;
INSERT INTO public.leave_types (id, company_id, name, description, days_allocated, is_paid, requires_approval, created_at, days_per_year, allow_half_day, color, active, updated_at) VALUES ('53303e94-aaed-40a9-b84e-0c137c7ace63', NULL, 'Unpaid Leave', NULL, NULL, true, true, '2026-05-10 17:50:30.413238', 0, true, '#9CA3AF', true, '2026-05-10 17:50:30.413238') ON CONFLICT DO NOTHING;
-- Data for Name: modules; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('318d76db-66a2-4b86-aa79-be354678a867', 'Dashboard', 'View dashboard analytics and metrics', 'LayoutDashboard', '/dashboard', 1, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('7c8dc4f3-3e26-44a8-8940-6ae54656bf33', 'Employees', 'Manage employee records and information', 'Users', '/employees', 2, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('0a2033e9-ef3a-4694-a527-6eb8b895386d', 'Companies', 'Manage company information', 'Building2', '/companies', 3, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('502a0521-529e-4208-b22c-b3c2959aaf81', 'Attendance', 'Track employee attendance', 'Calendar', '/attendance', 4, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('d8820c9d-59d1-491e-955a-8f4c8b8b1dba', 'Leave Management', 'Manage leave requests and approvals', 'Users', '/leave', 5, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('ab4cf322-f879-4fe0-82c3-c46d25e485c5', 'Payroll', 'Process salary and payroll', 'DollarSign', '/payroll', 6, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('007035e7-c697-421c-ba4c-815deb41520f', 'Documents', 'Manage employee documents', 'FileText', '/documents', 7, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('1c605ab2-1765-47b1-a1e6-3068b2acdde9', 'Reports', 'Generate and view reports', 'BarChart3', '/reports', 8, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('fb670f14-2e1e-44ca-9f55-0028140af0df', 'Settings', 'User and application settings', 'Settings', '/settings', 9, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('a267a736-84dc-4f44-9bcf-b806e58eba77', 'RBAC Management', 'Manage roles and permissions', 'Lock', '/admin/rbac', 10, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('7d0adf8b-e7b8-4af8-b056-b831c4f24191', 'Audit Logs', 'View system audit logs', 'Shield', '/admin/audit-logs', 11, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('3e7a3e52-f161-487b-98b7-8522e829ecaa', 'Leave Approvals', 'Approve or reject leave requests', 'CheckCircle', '/admin/leave-approvals', 12, '2026-05-10 20:29:34.788624', true, '2026-05-10 20:29:34.788624') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('4abf6142-467d-4d94-a1e5-951237da2b07', 'Employee Dashboard', 'Personal dashboard with attendance, leave balance, and payroll information', 'LayoutDashboard', '/employee-dashboard', 0, '2026-05-10 20:33:33.932021', true, '2026-05-10 20:33:33.932021') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('e36c74aa-28df-48d0-bf5f-18411c78b0a3', 'Manager Dashboard', 'Team management dashboard with attendance, leave approvals, and performance metrics', 'BarChart3', '/manager-dashboard', 1, '2026-05-10 20:33:33.932021', true, '2026-05-10 20:33:33.932021') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('2534ad84-9709-4dd3-9d16-8ee71f405ca8', 'Leaves', 'View leave history and apply for leave', 'Users', '/leaves', 5, '2026-05-10 21:35:40.797068', true, '2026-05-10 21:35:40.797068') ON CONFLICT DO NOTHING;
INSERT INTO public.modules (id, name, description, icon, path, order_index, created_at, is_system, updated_at) VALUES ('742ad503-59af-442b-9e7b-0cad7116461e', 'Grade Configuration', 'Manage employee grades, salary bands and benefits', NULL, '/admin/grades', 0, '2026-05-14 20:32:00.051154', true, '2026-05-14 20:32:00.051154') ON CONFLICT DO NOTHING;
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.roles (id, name, description, company_id, is_system, created_at, updated_at) VALUES ('1415c903-4824-4887-972b-39fb146b12d3', 'Super Admin', 'System administrator with full access', NULL, true, '2026-05-10 17:48:54.073336', '2026-05-10 17:48:54.073336') ON CONFLICT DO NOTHING;
INSERT INTO public.roles (id, name, description, company_id, is_system, created_at, updated_at) VALUES ('34400b74-1438-4d0b-ade0-c919f872158e', 'Company Admin', 'Administrator for a specific company', NULL, true, '2026-05-10 17:48:54.073336', '2026-05-10 17:48:54.073336') ON CONFLICT DO NOTHING;
INSERT INTO public.roles (id, name, description, company_id, is_system, created_at, updated_at) VALUES ('8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'HR Manager', 'HR department manager with leave and payroll approvals', NULL, true, '2026-05-10 17:48:54.073336', '2026-05-10 17:48:54.073336') ON CONFLICT DO NOTHING;
INSERT INTO public.roles (id, name, description, company_id, is_system, created_at, updated_at) VALUES ('cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'Department Manager', 'Department manager who approves team leaves', NULL, true, '2026-05-10 17:48:54.073336', '2026-05-10 17:48:54.073336') ON CONFLICT DO NOTHING;
INSERT INTO public.roles (id, name, description, company_id, is_system, created_at, updated_at) VALUES ('38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'Employee', 'Regular employee with self-service access', NULL, true, '2026-05-10 17:48:54.073336', '2026-05-10 17:48:54.073336') ON CONFLICT DO NOTHING;
-- Data for Name: role_modules; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('514edf2f-e98b-42cd-b291-45e4102ec22d', '34400b74-1438-4d0b-ade0-c919f872158e', '4abf6142-467d-4d94-a1e5-951237da2b07', '2026-05-10 20:33:33.932021') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('43aba076-880e-4463-8e59-cb4372cd727f', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', '4abf6142-467d-4d94-a1e5-951237da2b07', '2026-05-10 20:33:33.932021') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('af42a905-52b3-42ab-99f3-1c16b8683493', '34400b74-1438-4d0b-ade0-c919f872158e', 'e36c74aa-28df-48d0-bf5f-18411c78b0a3', '2026-05-10 20:33:33.932021') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('ca272f67-f0d2-480d-85eb-04e1b9e6f39d', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'e36c74aa-28df-48d0-bf5f-18411c78b0a3', '2026-05-10 20:33:33.932021') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('bfde973b-212c-4df8-8940-51cc937480cd', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'e36c74aa-28df-48d0-bf5f-18411c78b0a3', '2026-05-10 20:33:33.932021') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('4e57c329-19a8-4eb5-8547-ef508ad701ad', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', '502a0521-529e-4208-b22c-b3c2959aaf81', '2026-05-10 20:36:23.608527') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('036ede88-2f49-4a8a-bb17-56cc24c4999e', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'd8820c9d-59d1-491e-955a-8f4c8b8b1dba', '2026-05-10 20:36:29.492398') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('40af2205-0849-4e71-bf9b-8b23c39ec81a', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', '007035e7-c697-421c-ba4c-815deb41520f', '2026-05-10 20:36:42.422693') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('7455ac8f-416e-4370-a218-435007776163', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', '1c605ab2-1765-47b1-a1e6-3068b2acdde9', '2026-05-10 20:36:46.239753') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('7a2984e9-4d17-417b-9ca1-a66e0270cb08', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', '7c8dc4f3-3e26-44a8-8940-6ae54656bf33', '2026-05-10 20:36:59.613454') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('5ee2e84f-2a3d-4cf9-96f7-4bb461957bfa', '1415c903-4824-4887-972b-39fb146b12d3', '318d76db-66a2-4b86-aa79-be354678a867', '2026-05-10 20:37:51.102963') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('58a1d5f0-ca90-4cbd-8b55-aa74bc59d2b3', '1415c903-4824-4887-972b-39fb146b12d3', '7d0adf8b-e7b8-4af8-b056-b831c4f24191', '2026-05-10 20:37:59.510823') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('d538ae08-ba59-4402-84fa-c12688ca02d6', '1415c903-4824-4887-972b-39fb146b12d3', 'a267a736-84dc-4f44-9bcf-b806e58eba77', '2026-05-10 20:38:02.958749') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('7854dad2-4f62-46fb-9221-8a3858e06604', '1415c903-4824-4887-972b-39fb146b12d3', 'fb670f14-2e1e-44ca-9f55-0028140af0df', '2026-05-10 20:38:07.570204') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('887c819b-4f01-40bd-93b5-4e3f108c2eca', '1415c903-4824-4887-972b-39fb146b12d3', '1c605ab2-1765-47b1-a1e6-3068b2acdde9', '2026-05-10 20:38:12.69753') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('bb452d09-a742-4823-a76b-0fe3caa047ab', '1415c903-4824-4887-972b-39fb146b12d3', '3e7a3e52-f161-487b-98b7-8522e829ecaa', '2026-05-10 20:38:14.513613') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('5357be49-2f7c-4413-8e9b-076dc352ea7a', '1415c903-4824-4887-972b-39fb146b12d3', '007035e7-c697-421c-ba4c-815deb41520f', '2026-05-10 20:38:18.759688') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('739a167a-85b2-4a8c-9721-116695f3ebd1', '1415c903-4824-4887-972b-39fb146b12d3', 'ab4cf322-f879-4fe0-82c3-c46d25e485c5', '2026-05-10 20:38:19.792661') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('d4174151-753b-45c3-854e-39458dcb63ee', '1415c903-4824-4887-972b-39fb146b12d3', 'd8820c9d-59d1-491e-955a-8f4c8b8b1dba', '2026-05-10 20:38:22.391459') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('d7c6a232-3455-417f-805e-f5940823fc65', '1415c903-4824-4887-972b-39fb146b12d3', '502a0521-529e-4208-b22c-b3c2959aaf81', '2026-05-10 20:38:23.795496') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('87cd000f-4b82-4252-81f7-9916ea23baab', '1415c903-4824-4887-972b-39fb146b12d3', '0a2033e9-ef3a-4694-a527-6eb8b895386d', '2026-05-10 20:38:25.71873') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('dc2c9c48-b24b-4a42-8e14-b32ba22ec77a', '1415c903-4824-4887-972b-39fb146b12d3', '7c8dc4f3-3e26-44a8-8940-6ae54656bf33', '2026-05-10 20:38:39.712442') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('d876bf69-d611-4769-a425-ab2185c6a3c3', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'fb670f14-2e1e-44ca-9f55-0028140af0df', '2026-05-10 21:36:29.785443') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('9842908d-bc4c-4580-b046-b1515ba51d0e', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', '4abf6142-467d-4d94-a1e5-951237da2b07', '2026-05-10 21:36:29.785443') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('9f0d006f-c3e9-4722-8184-12a9280c6712', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', '2534ad84-9709-4dd3-9d16-8ee71f405ca8', '2026-05-10 21:36:29.785443') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('63c41b5e-2ac9-4ce5-ad0b-5a657b2e8ff8', '34400b74-1438-4d0b-ade0-c919f872158e', '1c605ab2-1765-47b1-a1e6-3068b2acdde9', '2026-05-14 19:38:29.659421') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('8dfbf46f-97d9-4409-ac9f-1578634b4c03', '34400b74-1438-4d0b-ade0-c919f872158e', '007035e7-c697-421c-ba4c-815deb41520f', '2026-05-14 19:38:35.365592') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('93089bad-cd05-4762-96aa-995faa8d496c', '34400b74-1438-4d0b-ade0-c919f872158e', 'ab4cf322-f879-4fe0-82c3-c46d25e485c5', '2026-05-14 19:38:40.310214') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('8e4c8e0d-6cce-497f-9c2b-4c28d86c02ae', '34400b74-1438-4d0b-ade0-c919f872158e', 'd8820c9d-59d1-491e-955a-8f4c8b8b1dba', '2026-05-14 19:38:42.525115') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('f331e2df-21ca-4054-b234-5c856a134256', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', '3e7a3e52-f161-487b-98b7-8522e829ecaa', '2026-05-14 19:39:38.08457') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('039de246-c6e7-4321-b91a-01c3bab09001', '1415c903-4824-4887-972b-39fb146b12d3', '742ad503-59af-442b-9e7b-0cad7116461e', '2026-05-14 20:32:00.051154') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('a5964ea6-5f71-4199-8de4-58b10d044158', '34400b74-1438-4d0b-ade0-c919f872158e', '742ad503-59af-442b-9e7b-0cad7116461e', '2026-05-14 20:32:00.051154') ON CONFLICT DO NOTHING;
INSERT INTO public.role_modules (id, role_id, module_id, created_at) VALUES ('5ee76667-7f37-4695-895c-99f60b510498', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', '742ad503-59af-442b-9e7b-0cad7116461e', '2026-05-14 20:32:00.051154') ON CONFLICT DO NOTHING;
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -

INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('aa4a32e3-fc3e-4998-822d-12511cfa2da9', '1415c903-4824-4887-972b-39fb146b12d3', 'employees', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('7e9c02bf-c3b9-4f10-9739-6741a03cdecf', '1415c903-4824-4887-972b-39fb146b12d3', 'employees', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('5f33b019-cd26-4920-a94c-8bbdeb443d51', '1415c903-4824-4887-972b-39fb146b12d3', 'employees', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('1c5c1e92-b165-4bd7-8e16-7f8fb9ac524b', '1415c903-4824-4887-972b-39fb146b12d3', 'employees', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('25e06899-7906-4556-9dcf-a1db35efdb0a', '1415c903-4824-4887-972b-39fb146b12d3', 'companies', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('fab53865-0432-40b5-99fb-792fe9179917', '1415c903-4824-4887-972b-39fb146b12d3', 'companies', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('c78094e3-26c3-4ee5-b92c-a91cc94f1638', '1415c903-4824-4887-972b-39fb146b12d3', 'companies', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('24a5698c-2efa-47d3-8426-69c4d7271b1e', '1415c903-4824-4887-972b-39fb146b12d3', 'companies', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('0936c180-1e7f-4128-93a6-0f8e66c28061', '1415c903-4824-4887-972b-39fb146b12d3', 'attendance', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('55af3196-9cd2-4f20-ad75-51e1006a35fb', '1415c903-4824-4887-972b-39fb146b12d3', 'attendance', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('11769a31-7149-4c42-ad8e-77e44ebf39c9', '1415c903-4824-4887-972b-39fb146b12d3', 'attendance', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('eeed03b2-9944-4935-a827-d3fbb36beb34', '1415c903-4824-4887-972b-39fb146b12d3', 'attendance', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('6b2d20d8-366b-4231-9a27-b855f46a51bb', '1415c903-4824-4887-972b-39fb146b12d3', 'leaves', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('7183512c-68d2-4684-8311-853babe43556', '1415c903-4824-4887-972b-39fb146b12d3', 'leaves', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('64addf2c-1774-4bce-baa3-32c10a8d7e92', '1415c903-4824-4887-972b-39fb146b12d3', 'leaves', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('d960708c-cf65-4e1a-9ad6-f39be1b1a455', '1415c903-4824-4887-972b-39fb146b12d3', 'leaves', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('2fb7d72d-8f17-4dc4-bb99-4069c13d449e', '1415c903-4824-4887-972b-39fb146b12d3', 'payroll', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('2ee1aa3e-e69e-467a-adb7-48c31e5f1e31', '1415c903-4824-4887-972b-39fb146b12d3', 'payroll', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('a51549d6-c7c9-407d-b7a0-c4f58092d37e', '1415c903-4824-4887-972b-39fb146b12d3', 'payroll', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('f6abb06b-b6f0-4fe9-991e-6a381892fa07', '1415c903-4824-4887-972b-39fb146b12d3', 'payroll', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('0a7b059e-d846-40fc-a18b-49b9d0102063', '1415c903-4824-4887-972b-39fb146b12d3', 'documents', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('6710f406-dd0d-4058-acd1-4f9e25337ebe', '1415c903-4824-4887-972b-39fb146b12d3', 'documents', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('548150d6-d6bc-42ff-af9f-2ed343346eb2', '1415c903-4824-4887-972b-39fb146b12d3', 'documents', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('760952c7-38ed-4a31-8791-09c878012c1e', '1415c903-4824-4887-972b-39fb146b12d3', 'documents', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('2ccf4a99-f340-49f8-a60f-7b4c102b6a5e', '1415c903-4824-4887-972b-39fb146b12d3', 'reports', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('1b179b4a-89f6-4e2b-b826-5582c082f754', '1415c903-4824-4887-972b-39fb146b12d3', 'reports', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('f26612d8-decd-43a2-8b3e-cb43c0e4e617', '1415c903-4824-4887-972b-39fb146b12d3', 'reports', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('e7c76d23-e734-45f3-98ed-d3d0326ac606', '1415c903-4824-4887-972b-39fb146b12d3', 'reports', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('dc59dd38-898b-4390-be87-d44794e515d1', '1415c903-4824-4887-972b-39fb146b12d3', 'settings', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('18fa8f11-b9ac-4129-9498-f726fb7038e4', '1415c903-4824-4887-972b-39fb146b12d3', 'settings', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('0aedc4ab-bd9b-471b-ba47-c963fbe57e00', '1415c903-4824-4887-972b-39fb146b12d3', 'settings', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('4a31e714-d443-4531-b952-1ab8a6a25a85', '1415c903-4824-4887-972b-39fb146b12d3', 'settings', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('5b051ba7-0230-4abe-9f35-ae5af2b71164', '1415c903-4824-4887-972b-39fb146b12d3', 'rbac', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('908bf9f7-2288-470c-8e0c-b7e0e52f32bc', '1415c903-4824-4887-972b-39fb146b12d3', 'rbac', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('6c7cd54a-16d6-4cf0-9bb6-3601a40760df', '1415c903-4824-4887-972b-39fb146b12d3', 'rbac', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('d70e5fc2-ac97-4207-8c2a-970d5c753bbc', '1415c903-4824-4887-972b-39fb146b12d3', 'rbac', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('68ac43bf-1024-4842-ad29-76e15345843c', '1415c903-4824-4887-972b-39fb146b12d3', 'audit_logs', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('e9b116cb-722f-40bd-914d-348af779aef6', '1415c903-4824-4887-972b-39fb146b12d3', 'audit_logs', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('c6ba1087-9daa-48d5-bb97-fa5f7fcf8a5f', '1415c903-4824-4887-972b-39fb146b12d3', 'audit_logs', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('88020192-d7c4-4898-b920-d1a1d50310ae', '1415c903-4824-4887-972b-39fb146b12d3', 'audit_logs', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('e095bbdd-23e3-4802-8031-0a2606585bc9', '1415c903-4824-4887-972b-39fb146b12d3', 'dashboard', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('b8a567ea-5f61-4a98-935a-8d62fb99b13d', '1415c903-4824-4887-972b-39fb146b12d3', 'dashboard', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('4d030644-d21c-4176-b2cf-4c64a9e80370', '1415c903-4824-4887-972b-39fb146b12d3', 'dashboard', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('fe5e0e23-e60a-40a6-82b2-deb619cdcbee', '1415c903-4824-4887-972b-39fb146b12d3', 'dashboard', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('16cdd7c6-6794-4024-b80e-0826b6fa46d6', '1415c903-4824-4887-972b-39fb146b12d3', 'modules', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('666c06dc-fb2c-4ba8-84b6-3aa97ceb3da9', '1415c903-4824-4887-972b-39fb146b12d3', 'modules', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('15265e5d-0049-4af9-9dfa-4b0a876a0cc6', '1415c903-4824-4887-972b-39fb146b12d3', 'modules', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('04e4adbb-7c72-45f3-b0cd-f0652f4849c5', '1415c903-4824-4887-972b-39fb146b12d3', 'modules', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('6099088d-8736-429e-ac85-1339b26f7483', '1415c903-4824-4887-972b-39fb146b12d3', 'leaves', 'approve', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('ab903e75-d41a-4a41-86a8-a380b0ebeafc', '1415c903-4824-4887-972b-39fb146b12d3', 'leaves', 'reject', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('c4428e38-2f51-4f12-b216-5ddf608f9322', '34400b74-1438-4d0b-ade0-c919f872158e', 'employees', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('2027fd56-ed4e-4a87-b164-ef9b015e3ca2', '34400b74-1438-4d0b-ade0-c919f872158e', 'employees', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('25bfa1c5-bf3b-48aa-9de7-32a989d896f5', '34400b74-1438-4d0b-ade0-c919f872158e', 'employees', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('8d68dad5-8eb1-4dfe-9955-b7af52bb0181', '34400b74-1438-4d0b-ade0-c919f872158e', 'employees', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('aca8f31e-27d6-4edd-879a-a06b219e771c', '34400b74-1438-4d0b-ade0-c919f872158e', 'companies', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('574a1894-b3c5-402d-bd5c-b822acdecc24', '34400b74-1438-4d0b-ade0-c919f872158e', 'companies', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('a3dcec5e-2f6e-4e56-a17e-71c8ec716995', '34400b74-1438-4d0b-ade0-c919f872158e', 'attendance', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('415eb6f3-ccf5-4520-ae99-fbf627e6e49b', '34400b74-1438-4d0b-ade0-c919f872158e', 'attendance', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('6c1622fb-4e08-4694-b8a8-2a796a011c8e', '34400b74-1438-4d0b-ade0-c919f872158e', 'attendance', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('aa7d0ca3-890b-4ded-9e80-5aa15a5bd9d0', '34400b74-1438-4d0b-ade0-c919f872158e', 'attendance', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('b6e8b745-cbb8-4941-b286-c5b6fa46e983', '34400b74-1438-4d0b-ade0-c919f872158e', 'leaves', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('cd688569-e691-49ac-afec-16e7216c2be9', '34400b74-1438-4d0b-ade0-c919f872158e', 'leaves', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('ff2c215c-f78c-4ada-a15e-f08ce36f27f8', '34400b74-1438-4d0b-ade0-c919f872158e', 'leaves', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('274d0ecd-9255-4d01-a6be-9d02362c12e0', '34400b74-1438-4d0b-ade0-c919f872158e', 'leaves', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('91dbb34e-d9fd-498b-b4a9-bca7ca595953', '34400b74-1438-4d0b-ade0-c919f872158e', 'leaves', 'approve', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('84eb49a3-056f-4167-9125-fc350edaef69', '34400b74-1438-4d0b-ade0-c919f872158e', 'leaves', 'reject', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('e1b1c005-d805-4db4-9cbb-b52770e6a1c8', '34400b74-1438-4d0b-ade0-c919f872158e', 'payroll', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('038712f1-2176-418b-ab92-a1b56b6794e2', '34400b74-1438-4d0b-ade0-c919f872158e', 'payroll', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('effa10e2-56ae-4285-b0a9-c97231a0f3f3', '34400b74-1438-4d0b-ade0-c919f872158e', 'payroll', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('3b90db64-b36d-4c32-a267-7a1133d63b92', '34400b74-1438-4d0b-ade0-c919f872158e', 'payroll', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('0be43b47-dea3-4a14-ba14-abe9ce21a6f6', '34400b74-1438-4d0b-ade0-c919f872158e', 'documents', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('1c0d82fb-451e-4ebc-a8c5-d1d471f8fdaf', '34400b74-1438-4d0b-ade0-c919f872158e', 'documents', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('21d4e49d-e1cf-4b24-a12a-fb936d396fe1', '34400b74-1438-4d0b-ade0-c919f872158e', 'documents', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('9ff4bc1d-299e-4179-8e1c-210141b83879', '34400b74-1438-4d0b-ade0-c919f872158e', 'documents', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('9555b098-016a-4608-9602-d4cc4516f649', '34400b74-1438-4d0b-ade0-c919f872158e', 'reports', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('5c6aa636-8188-4bc4-a548-1f2cb8ccf766', '34400b74-1438-4d0b-ade0-c919f872158e', 'settings', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('fa34b98d-e321-4305-84d8-2b21b1e1c3a7', '34400b74-1438-4d0b-ade0-c919f872158e', 'settings', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('e80b3614-4c0f-43d3-b0f7-60fd0d31a420', '34400b74-1438-4d0b-ade0-c919f872158e', 'rbac', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('d33f4757-8b2c-4972-9e99-155ff73dc1fb', '34400b74-1438-4d0b-ade0-c919f872158e', 'rbac', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('9a88bd39-aeeb-4a67-b112-16bc394136ae', '34400b74-1438-4d0b-ade0-c919f872158e', 'rbac', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('8ad1826c-1395-4a01-b522-d295ab34d89c', '34400b74-1438-4d0b-ade0-c919f872158e', 'rbac', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('c574a934-1a00-4e7f-9a18-7662dbbbd22f', '34400b74-1438-4d0b-ade0-c919f872158e', 'audit_logs', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('949c1735-d00b-4356-b6ac-a4e18c9efda2', '34400b74-1438-4d0b-ade0-c919f872158e', 'dashboard', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('b2bf477b-34dc-45a6-a43b-cafdf982d9b1', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'employees', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('f3d9849f-ac3e-43f6-847f-61f2fb7e74aa', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'employees', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('40b030f6-6da5-46d3-aef7-2d8f5766355e', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'employees', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('6097fcb8-3fe4-4312-97a4-135ea463d69f', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'attendance', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('a08e030b-ab6d-46f7-98b2-7f3eb8474ae5', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'attendance', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('9c31a06c-689c-43b9-a634-e9a514934d06', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'attendance', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('84d5f48b-dc35-4110-ad0d-055fffff48ca', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'attendance', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('8543afab-ccb5-41dd-b52b-d8ca81a07a14', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'leaves', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('4a397eab-29b0-432f-8248-7d9b87d5883f', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'leaves', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('6a2c1879-d290-40b8-a468-0071113a500c', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'leaves', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('96e3d398-74f9-4b5e-98d9-b45b26291b2e', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'leaves', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('5afd0c25-4b86-48b9-8ed9-e0ed39e76784', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'leaves', 'approve', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('1fc3e161-e4af-42c5-bc27-38f27bd45913', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'leaves', 'reject', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('c89bb3b6-367c-441e-ba81-1dccda627633', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'payroll', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('9138c092-fa79-4fb7-866d-a8579e0b5092', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'payroll', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('c53bbac4-bc27-4c9a-9a65-d92c010445a7', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'payroll', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('4a5ba54c-fe58-459e-b753-49c42547bf3e', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'documents', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('49cbdc1e-d208-4168-8cce-df7c1cf36942', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'documents', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('5ac4f661-2d08-410b-b4e0-17b0cb550fa7', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'documents', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('e05366b4-de87-4b46-89b4-e570d914b616', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'documents', 'delete', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('fbdd89df-8a9a-4a73-9875-8deea795d45c', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'reports', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('e9695a76-14de-48d7-b649-13d619f83118', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'settings', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('873491fb-8104-4025-b67c-f1fb80537511', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'settings', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('bd7af22c-ecf4-423c-88db-f53f307e58c4', '8ce38a5d-e7f9-4fe0-828e-e8f28f4f865d', 'dashboard', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('1252563c-d089-4b3e-b1d0-bf25a74b46fc', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'employees', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('3890c514-33fa-49a4-9304-c13c1e62d478', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'attendance', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('d14890ce-6e66-4017-927a-11b1f7d9344b', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'attendance', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('347a5714-1a50-4263-8f34-0ade5249399a', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'leaves', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('15fb9245-852c-4dc7-83ee-dfdf6e46102f', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'leaves', 'approve', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('4baa2ddb-eb26-45a6-804d-a5d3d12d159c', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'leaves', 'reject', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('8b00c279-7484-4b9a-9290-e160c757e247', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'reports', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('771b3bc0-f5a9-4636-91f2-4d9e1be0a94b', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'settings', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('1d5761ff-7e02-4c4a-a90f-83a53e772294', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'settings', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('ace445e7-9993-41be-9ffe-87600a1f2008', 'cb3ec51c-e36d-4753-8191-b1f0b4cf7ab6', 'dashboard', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('41d9cfa8-ef85-43bd-b141-b51967e68018', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'attendance', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('2ba1a98e-57cc-41e2-9fba-6d250f531a54', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'attendance', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('fff1c05a-a873-4160-ab3b-4cfe32db6fd0', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'leaves', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('0aad60c9-d47e-45c0-8d7d-578e41a41dc6', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'leaves', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('43a257f7-8e95-4b79-b44b-e32a07298980', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'payroll', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('91c12e44-e6b4-4568-9c68-c44b2a31aaef', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'documents', 'create', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('f5b5bd2b-9f21-4996-8240-1699e7b9dc3b', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'documents', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('3f223aee-1b55-4626-864c-fb6913c2de23', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'documents', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('1809c362-9755-4a8e-9b38-f39bf2aa9346', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'settings', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('fe0b7fa4-6e64-42e0-8a12-d0641f148d7f', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'settings', 'update', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions (id, role_id, resource, action, created_at) VALUES ('3fca1d00-bb4a-4f16-a462-e3d637027e39', '38e0afc1-24cf-409a-a884-b8d4ce8c5d55', 'dashboard', 'read', '2026-05-14 19:13:41.726186') ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. GRANTS for the API roles
--    Supabase cloud normally does this automatically; required when
--    self-hosting, harmless on cloud. RLS still governs row access.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;

-- Refresh the API schema cache so the new tables are visible immediately
NOTIFY pgrst, 'reload schema';

-- ============================================================================
--  AFTER RUNNING THIS SCRIPT
-- ============================================================================
--  1. Storage: confirm the "documents" bucket exists (Storage -> Buckets).
--
--  2. Create the first Super Admin (there are no users yet):
--     a) Authentication -> Users -> "Add user" -> enter email + password,
--        tick "Auto Confirm User". Copy the new user's UUID.
--     b) Create the company and link the admin, replacing the placeholders:
--
--        insert into public.companies (name, email, city, country)
--        values ('<CLIENT COMPANY NAME>', '<company@email>', '<City>', '<Country>')
--        returning id;   -- copy this company id
--
--        insert into public.users (id, email, first_name, last_name, role, company_id)
--        values ('<AUTH USER UUID>', '<admin@email>', '<First>', '<Last>',
--                'Super Admin', '<COMPANY ID>');
--
--        insert into public.user_roles (user_id, role_id, company_id)
--        select '<AUTH USER UUID>', id, '<COMPANY ID>'
--        from public.roles where name = 'Super Admin';
--
--        insert into public.user_companies (user_id, company_id, is_primary)
--        values ('<AUTH USER UUID>', '<COMPANY ID>', true);
--
--  3. Point the app at this project (.env.local), then rebuild:
--        NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
--        NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
--        SUPABASE_SERVICE_ROLE_KEY=<service role key>
--
--  4. Log in as the admin and add grades, employees and documents in the app.
-- ============================================================================
