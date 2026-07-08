export interface Document {
  id: string;
  document_type: 'License' | 'Passport' | 'Emirates ID' | 'Company License';
  document_number: string;
  issue_date: string;
  expiry_date: string;
  issuing_authority: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  industry: string;
  founded_year: number;
  employee_count: number;
  /** Per-company branding (migration 028) */
  logo_url?: string | null;
  brand_color?: string | null;
  company_license?: Document;
  documents?: Document[];
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  date_of_joining: string;
  date_of_birth: string;
  address: string;
  city: string;
  country: string;
  salary: number;
  employment_type: 'Full-Time' | 'Part-Time' | 'Contract' | 'Intern';
  status: 'Active' | 'Inactive' | 'On Leave' | 'Terminated';
  grade_id?: string;
  grade?: EmployeeGrade;
  driving_license?: Document;
  passport?: Document;
  emirates_id?: Document;
  documents?: Document[];
  created_at: string;
  updated_at: string;
}

// ============================================================
// Grade / Benefits Configuration Types
// ============================================================

export interface EmployeeGrade {
  id: string;
  company_id: string;
  name: string;
  level: number;
  description?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  /** Joined via grade_summary view */
  employee_count?: number;
  salary?: number;
  currency?: string;
}

export type BenefitType =
  | 'Health Insurance'
  | 'Housing Allowance'
  | 'Transport Allowance'
  | 'Education Allowance'
  | 'Annual Bonus'
  | 'Performance Bonus'
  | 'Meal Allowance'
  | 'Phone Allowance'
  | 'Annual Flight Ticket'
  | 'Gratuity'
  | 'Pension'
  | 'Other';

export type BenefitValueType = 'fixed' | 'percentage';

export interface GradeLeaveConfig {
  id: string;
  grade_id: string;
  company_id: string;
  leave_type_id: string;
  days_per_year: number;
  carry_forward_days: number;
  carry_forward_expiry_months: number;
  year?: number | null;
  created_at: string;
  updated_at: string;
  /** Joined from leave_types */
  leave_type_name?: string;
  leave_type_color?: string;
}

export interface GradeSalaryConfig {
  id: string;
  grade_id: string;
  company_id: string;
  salary: number;
  currency: string;
  effective_from: string;
  effective_to?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface GradeBenefit {
  id: string;
  grade_id: string;
  company_id: string;
  benefit_type: BenefitType;
  benefit_value?: number | null;
  value_type: BenefitValueType;
  currency: string;
  description?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Leave {
  id: string;
  company_id: string;
  employee_id: string;
  leave_type: 'Vacation' | 'Sick' | 'Personal' | 'Maternity' | 'Other';
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  company_id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string;
  status: 'Present' | 'Absent' | 'Late' | 'Half-Day';
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Payroll {
  id: string;
  company_id: string;
  employee_id: string;
  month: string;
  salary: number;
  bonus: number;
  deductions: number;
  net_pay: number;
  status: 'Draft' | 'Processed' | 'Paid';
  created_at: string;
  updated_at: string;
}

export interface DocumentExpiry {
  id: string;
  company_id: string;
  employee_id?: string;
  document_id: string;
  document_type: string;
  expiry_date: string;
  days_until_expiry: number;
  status: 'Active' | 'Expiring Soon' | 'Expired';
  notification_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  company_id: string;
  employee_id?: string;
  activity_type: string;
  description: string;
  entity_type: 'Employee' | 'Leave' | 'Attendance' | 'Payroll' | 'Document';
  entity_id: string;
  performed_by: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  role_name?: string;
  company_id: string;
  assigned_at: string;
  assigned_by?: string;
}

export interface UserPermission {
  id: string;
  role_id: string;
  resource: string;
  action: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'Admin' | 'Manager' | 'Employee' | 'HR';
  company_id?: string;
  roles?: UserRole[];
  permissions?: UserPermission[];
  is_temporary_password?: boolean;
  created_at: string;
  updated_at: string;
}
