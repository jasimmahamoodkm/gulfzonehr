-- Migration: Enable Row Level Security (RLS) Policies
-- Date: May 2026
-- Description: Implement fine-grained access control for multi-tenant data security

-- Enable RLS on leaves table
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

-- Employees can view and manage their own leaves
CREATE POLICY leaves_employee_policy ON leaves
  FOR ALL
  USING (employee_id IN (
    SELECT id FROM employees
    WHERE company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
  ) OR auth.uid() IN (
    SELECT user_id FROM user_roles
    WHERE role_id IN (
      SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin', 'HR Manager')
    )
  ))
  WITH CHECK (employee_id IN (
    SELECT id FROM employees
    WHERE company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
  ) OR auth.uid() IN (
    SELECT user_id FROM user_roles
    WHERE role_id IN (
      SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin', 'HR Manager')
    )
  ));

-- Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY audit_logs_admin_policy ON audit_logs
  FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM user_roles
    WHERE role_id IN (
      SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin')
    )
  ) AND company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid()));

-- Only system can insert audit logs
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Enable RLS on employee_leave_balance table
ALTER TABLE employee_leave_balance ENABLE ROW LEVEL SECURITY;

-- Employees can view their own balance, managers can view team balances
CREATE POLICY leave_balance_policy ON employee_leave_balance
  FOR SELECT
  USING (employee_id IN (
    SELECT id FROM employees
    WHERE company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
  ) AND (
    -- Employee viewing own balance
    employee_id IN (
      SELECT employee_id FROM employees
      WHERE company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
    )
    -- Manager viewing team
    OR auth.uid() IN (
      SELECT approver_id FROM leave_approvers
      WHERE employee_id = employee_id
      AND active = true
    )
    -- Admin viewing all
    OR auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id IN (
        SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin', 'HR Manager')
      )
    )
  ));

-- Enable RLS on leave_approvers table
ALTER TABLE leave_approvers ENABLE ROW LEVEL SECURITY;

-- Managers and admins can view approver mappings
CREATE POLICY leave_approvers_policy ON leave_approvers
  FOR SELECT
  USING (company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
  AND (
    approver_id = auth.uid()
    OR auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id IN (
        SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin', 'HR Manager')
      )
    )
  ));

-- Enable RLS on roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage roles
CREATE POLICY roles_admin_policy ON roles
  FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM user_roles
    WHERE role_id IN (
      SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin')
    )
  ) AND company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
  OR is_system = true);

-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can manage user roles
CREATE POLICY user_roles_admin_policy ON user_roles
  FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM user_roles ur
    WHERE ur.role_id IN (
      SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin')
    )
    AND ur.company_id = user_roles.company_id
  ));

-- Enable RLS on role_permissions table
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone can view permissions for their company's roles
CREATE POLICY role_permissions_view_policy ON role_permissions
  FOR SELECT
  USING (role_id IN (
    SELECT id FROM roles
    WHERE company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
    OR is_system = true
  ));

-- Only admins can modify permissions
CREATE POLICY role_permissions_admin_policy ON role_permissions
  FOR INSERT, UPDATE, DELETE
  USING (role_id IN (
    SELECT id FROM roles
    WHERE company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
    AND auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id IN (
        SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin')
      )
    )
  ));

-- Enable RLS on leave_types table
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

-- Anyone in company can view leave types
CREATE POLICY leave_types_policy ON leave_types
  FOR SELECT
  USING (company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid()));

-- Only admins can modify leave types
CREATE POLICY leave_types_admin_policy ON leave_types
  FOR INSERT, UPDATE, DELETE
  USING (auth.uid() IN (
    SELECT user_id FROM user_roles
    WHERE role_id IN (
      SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin', 'HR Manager')
    )
  ) AND company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid()));

-- Enable RLS on activity_logs table
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can view their own activities, admins can view all
CREATE POLICY activity_logs_policy ON activity_logs
  FOR SELECT
  USING (user_id = auth.uid()
  OR auth.uid() IN (
    SELECT user_id FROM user_roles
    WHERE role_id IN (
      SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin')
    )
  ));

-- System can insert activity logs
CREATE POLICY activity_logs_insert_policy ON activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_pending_leave_approvals(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_leave(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_leave(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_employee_leave_balance(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event(uuid, uuid, text, text, uuid, text, jsonb, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_activity_event(uuid, uuid, text, text, jsonb, text) TO authenticated;

-- Create helpful indexes for RLS queries
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON user_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvers_active ON leave_approvers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
