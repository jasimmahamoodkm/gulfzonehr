-- Fix Employee Module Assignments
-- Assign ONLY the required modules for Employee role

-- Step 1: Remove all current Employee role modules
DELETE FROM role_modules
WHERE role_id = (SELECT id FROM roles WHERE name = 'Employee');

-- Step 2: Assign ONLY the correct modules to Employee
-- Employee needs: Employee Dashboard, Leave Management, Settings
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Employee'
AND m.name IN (
  'Employee Dashboard',
  'Leave Management',
  'Settings'
);

-- Step 3: Verify the final assignment
SELECT
  r.name as role,
  COUNT(rm.module_id) as module_count,
  STRING_AGG(m.name, ', ' ORDER BY m.name) as modules,
  STRING_AGG(m.path, ', ' ORDER BY m.path) as paths
FROM roles r
LEFT JOIN role_modules rm ON r.id = rm.role_id
LEFT JOIN modules m ON rm.module_id = m.id
WHERE r.name = 'Employee'
GROUP BY r.id, r.name;
