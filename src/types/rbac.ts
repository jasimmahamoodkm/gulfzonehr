/**
 * Role-Based Access Control (RBAC) Types
 * Defines types for roles, permissions, and access control
 */

export type SystemRole =
  | 'Super Admin'
  | 'Company Admin'
  | 'HR Manager'
  | 'Department Manager'
  | 'Employee';

export type Resource =
  | 'companies'
  | 'users'
  | 'employees'
  | 'roles'
  | 'permissions'
  | 'leaves'
  | 'payroll'
  | 'attendance'
  | 'reports'
  | 'audit_logs'
  | 'activity_logs'
  | 'settings'
  | 'profile'
  | 'documents';

export type Action =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'view'
  | 'apply'
  | 'process'
  | 'manage'
  | 'override';

export interface Role {
  id: string;
  name: string;
  description?: string;
  company_id?: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  role_id: string;
  resource: Resource;
  action: Action;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  company_id: string;
  assigned_at: string;
  assigned_by?: string;
}

export interface UserWithRoles {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_id?: string;
  roles: UserRole[];
  permissions: Permission[];
  created_at: string;
  updated_at: string;
}

export interface PermissionContext {
  user_id: string;
  company_id: string;
  resource: Resource;
  action: Action;
  resource_id?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}
