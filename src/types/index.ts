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
  created_at: string;
  updated_at: string;
}

export interface Leave {
  id: string;
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

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'Admin' | 'Manager' | 'Employee' | 'HR';
  company_id?: string;
  created_at: string;
  updated_at: string;
}
