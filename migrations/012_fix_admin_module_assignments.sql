-- Migration: Fix Admin Module Assignments
-- Date: May 2026
-- Description: Remove admin modules from non-admin roles and ensure proper role-module assignments

-- Step 1: Remove admin modules from Employee role
DELETE FROM role_modules
WHERE role_id = (SELECT id FROM roles WHERE name = 'Employee')
AND module_id IN (
  SELECT id FROM modules WHERE path IN ('/admin/rbac', '/admin/audit-logs', '/admin/leave-approvals')
);

-- Step 2: Remove admin modules from Department Manager role (they should not have admin access)
DELETE FROM role_modules
WHERE role_id = (SELECT id FROM roles WHERE name = 'Department Manager')
AND module_id IN (
  SELECT id FROM modules WHERE path IN ('/admin/rbac', '/admin/audit-logs')
);

-- Step 3: Ensure proper module assignments for each role

-- Employee: Basic modules only
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Employee'
AND m.name IN (
  'Dashboard',
  'Attendance',
  'Leave Management',
  'Documents',
  'Settings',
  'Employee Dashboard'
)
ON CONFLICT DO NOTHING;

-- Department Manager: Add team management modules
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Department Manager'
AND m.name IN (
  'Dashboard',
  'Employees',
  'Attendance',
  'Leave Management',
  'Documents',
  'Reports',
  'Settings',
  'Manager Dashboard',
  'Leave Approvals'
)
ON CONFLICT DO NOTHING;

-- HR Manager: Add HR and admin modules
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'HR Manager'
AND m.name IN (
  'Dashboard',
  'Employees',
  'Attendance',
  'Leave Management',
  'Payroll',
  'Documents',
  'Reports',
  'Settings',
  'Manager Dashboard',
  'Leave Approvals'
)
ON CONFLICT DO NOTHING;

-- Company Admin: All modules except leaving which one
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Company Admin'
AND m.name IN (
  'Dashboard',
  'Employees',
  'Companies',
  'Attendance',
  'Leave Management',
  'Payroll',
  'Documents',
  'Reports',
  'Settings',
  'RBAC Management',
  'Audit Logs',
  'Leave Approvals'
)
ON CONFLICT DO NOTHING;

-- Super Admin: All modules
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Super Admin'
AND m.is_system = true
ON CONFLICT DO NOTHING;

-- Verification: Show final assignments
SELECT
  r.name as role,
  COUNT(rm.module_id) as module_count,
  STRING_AGG(m.name, ', ' ORDER BY m.name) as modules
FROM roles r
LEFT JOIN role_modules rm ON r.id = rm.role_id
LEFT JOIN modules m ON rm.module_id = m.id
GROUP BY r.id, r.name
ORDER BY r.name;
