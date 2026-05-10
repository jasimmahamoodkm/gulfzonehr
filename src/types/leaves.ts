/**
 * Leave Management Types
 * Defines types for leave requests, approvals, and balance tracking
 */

export type LeaveApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'withdrawn';

export interface Leave {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  requested_by?: string;
  approved_by?: string;
  approval_date?: string;
  manager_comments?: string;
  approval_status: LeaveApprovalStatus;
  rejection_reason?: string;
  is_comp_off: boolean;
  comp_off_request_id?: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveWithEmployeeDetails extends Leave {
  employee_name: string;
  employee_email: string;
  employee_department: string;
  approver_name?: string;
}

export interface LeaveType {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  days_per_year: number;
  requires_approval: boolean;
  allow_half_day: boolean;
  color: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeLeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  last_updated: string;
}

export interface EmployeeLeaveBalanceWithType extends EmployeeLeaveBalance {
  leave_type_name: string;
  leave_type_color: string;
  usage_percentage: number;
}

export interface LeaveApprover {
  id: string;
  employee_id: string;
  approver_id: string;
  company_id: string;
  approval_level: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveApproverWithDetails extends LeaveApprover {
  approver_name: string;
  approver_email: string;
}

export interface LeaveApprovalRequest {
  leave_id: string;
  approved_by: string;
  comments?: string;
}

export interface LeaveRejectionRequest {
  leave_id: string;
  rejected_by: string;
  reason: string;
}

export interface LeaveApprovalResponse {
  success: boolean;
  message: string;
  leave_id: string;
}

export interface PendingLeaveApproval {
  leave_id: string;
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  requested_on: string;
  days_until_leave: number;
}

export interface LeaveDashboard {
  employee_id: string;
  employee_name: string;
  company_id: string;
  leave_type: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  year: number;
  usage_percentage: number;
}

export interface LeaveApplicationRequest {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
  is_half_day_start?: boolean;
  is_half_day_end?: boolean;
}

export interface LeaveBalanceCheckResult {
  available: boolean;
  requested_days: number;
  available_days: number;
  message: string;
}

export interface CompOffRequest {
  id: string;
  employee_id: string;
  requested_by: string;
  reason?: string;
  number_of_days: number;
  approval_status: LeaveApprovalStatus;
  approved_by?: string;
  approval_date?: string;
  expiry_date?: string;
  created_at: string;
}

export interface CompOffRequestWithDetails extends CompOffRequest {
  employee_name: string;
  approver_name?: string;
}

export interface LeaveStatistics {
  total_employees: number;
  total_pending_approvals: number;
  total_approved_leaves: number;
  total_rejected_leaves: number;
  by_leave_type: Record<string, number>;
  by_department: Record<string, number>;
  approval_pending_count_by_manager: Record<string, number>;
}

export interface LeaveReportFilter {
  company_id: string;
  start_date?: string;
  end_date?: string;
  employee_id?: string;
  department?: string;
  leave_type?: string;
  approval_status?: LeaveApprovalStatus;
  page?: number;
  per_page?: number;
}
