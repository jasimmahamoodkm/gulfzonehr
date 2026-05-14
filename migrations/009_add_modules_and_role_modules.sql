-- Migration: Add Modules and Role Modules
-- Date: May 2026
-- Description: Add modules table and role_modules junction table for fine-grained access control

-- Create modules table
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  description TEXT,
  icon VARCHAR,
  path VARCHAR,
  order_index INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role_modules junction table
CREATE TABLE IF NOT EXISTS role_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, module_id)
);

-- Insert default modules
INSERT INTO modules (name, description, icon, path, order_index, is_system) VALUES
  ('Dashboard', 'View dashboard analytics and metrics', 'LayoutDashboard', '/dashboard', 1, true),
  ('Employees', 'Manage employee records and information', 'Users', '/employees', 2, true),
  ('Companies', 'Manage company information', 'Building2', '/companies', 3, true),
  ('Attendance', 'Track employee attendance', 'Calendar', '/attendance', 4, true),
  ('Leave Management', 'Manage leave requests and approvals', 'Users', '/leave', 5, true),
  ('Payroll', 'Process salary and payroll', 'DollarSign', '/payroll', 6, true),
  ('Documents', 'Manage employee documents', 'FileText', '/documents', 7, true),
  ('Reports', 'Generate and view reports', 'BarChart3', '/reports', 8, true),
  ('Settings', 'User and application settings', 'Settings', '/settings', 9, true),
  ('RBAC Management', 'Manage roles and permissions', 'Lock', '/admin/rbac', 10, true),
  ('Audit Logs', 'View system audit logs', 'Shield', '/admin/audit-logs', 11, true),
  ('Leave Approvals', 'Approve or reject leave requests', 'CheckCircle', '/admin/leave-approvals', 12, true)
ON CONFLICT DO NOTHING;

-- Enable RLS on modules table
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all modules
CREATE POLICY modules_read_policy ON modules
  FOR SELECT
  USING (true);

-- Enable RLS on role_modules table
ALTER TABLE role_modules ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read role_modules
CREATE POLICY role_modules_read_policy ON role_modules
  FOR SELECT
  USING (true);

-- Allow admins to manage role_modules
CREATE POLICY role_modules_admin_policy ON role_modules
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id IN (
        SELECT id FROM roles
        WHERE name IN ('Super Admin', 'Company Admin')
      )
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id IN (
        SELECT id FROM roles
        WHERE name IN ('Super Admin', 'Company Admin')
      )
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_modules_role_id ON role_modules(role_id);
CREATE INDEX IF NOT EXISTS idx_role_modules_module_id ON role_modules(module_id);
