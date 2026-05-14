-- Migration: Add Employee and Manager Dashboard Modules
-- Date: May 2026
-- Description: Add employee and manager dashboards to the modules system

-- Insert employee dashboard module
INSERT INTO modules (name, description, icon, path, order_index, is_system)
VALUES ('Employee Dashboard', 'Personal dashboard with attendance, leave balance, and payroll information', 'LayoutDashboard', '/employee-dashboard', 0, true)
ON CONFLICT DO NOTHING;

-- Insert manager dashboard module
INSERT INTO modules (name, description, icon, path, order_index, is_system)
VALUES ('Manager Dashboard', 'Team management dashboard with attendance, leave approvals, and performance metrics', 'BarChart3', '/manager-dashboard', 0.5, true)
ON CONFLICT DO NOTHING;

-- Assign Employee Dashboard to all system roles
-- Get the Employee Dashboard module ID and assign to all roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE m.name = 'Employee Dashboard'
AND r.name IN ('Employee', 'Department Manager', 'HR Manager', 'Company Admin', 'Super Admin')
ON CONFLICT DO NOTHING;

-- Assign Manager Dashboard to manager and admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE m.name = 'Manager Dashboard'
AND r.name IN ('Department Manager', 'HR Manager', 'Company Admin', 'Super Admin')
ON CONFLICT DO NOTHING;
