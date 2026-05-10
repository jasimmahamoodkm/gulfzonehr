/**
 * Audit Logging Types
 * Defines types for audit trails and activity tracking
 */

export interface AuditLog {
  id: string;
  user_id?: string;
  company_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  resource_name?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failure';
  error_message?: string;
  created_at: string;
}

export interface AuditLogWithUser extends AuditLog {
  user_name?: string;
  company_name?: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  company_id?: string;
  activity_type: string;
  description: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface AuditLogFilter {
  user_id?: string;
  company_id?: string;
  resource_type?: string;
  action?: string;
  status?: 'success' | 'failure';
  start_date?: string;
  end_date?: string;
  search_term?: string;
  page?: number;
  per_page?: number;
}

export interface AuditLogSearchResult {
  total: number;
  page: number;
  per_page: number;
  logs: AuditLogWithUser[];
}

export interface AuditLogPolicy {
  id: string;
  company_id: string;
  resource_type: string;
  retention_days: number;
  archive_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export enum ActivityType {
  Login = 'login',
  Logout = 'logout',
  CreateUser = 'create_user',
  UpdateUser = 'update_user',
  DeleteUser = 'delete_user',
  CreateEmployee = 'create_employee',
  UpdateEmployee = 'update_employee',
  DeleteEmployee = 'delete_employee',
  CreateLeave = 'create_leave',
  ApproveLeave = 'approve_leave',
  RejectLeave = 'reject_leave',
  ProcessPayroll = 'process_payroll',
  CreateAttendance = 'create_attendance',
  UpdateAttendance = 'update_attendance',
}

export interface CreateAuditLogRequest {
  user_id?: string;
  company_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  resource_name?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  status?: 'success' | 'failure';
  error_message?: string;
}

export interface AuditLogStatistics {
  total_logs: number;
  logs_by_action: Record<string, number>;
  logs_by_resource: Record<string, number>;
  logs_by_user: Record<string, number>;
  success_rate: number;
  recent_failures: AuditLog[];
}

export interface ComplianceReport {
  generated_at: string;
  company_id: string;
  period_start: string;
  period_end: string;
  total_operations: number;
  total_failures: number;
  sensitive_operations: AuditLog[];
}
