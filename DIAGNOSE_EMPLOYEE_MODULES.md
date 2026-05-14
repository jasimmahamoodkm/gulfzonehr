# Diagnose & Fix Employee Module Visibility Issue

## Step 1: Check Current Employee Module Assignments

Run this query in Supabase SQL Editor to see what modules the Employee role currently has:

```sql
-- Check Employee role modules
SELECT
  r.name as role,
  m.name as module,
  m.path,
  CASE 
    WHEN m.path LIKE '/admin/%' THEN '⚠️ ADMIN (should be removed)'
    ELSE '✅ Regular module'
  END as status
FROM roles r
LEFT JOIN role_modules rm ON r.id = rm.role_id
LEFT JOIN modules m ON rm.module_id = m.id
WHERE r.name = 'Employee'
ORDER BY m.path;
```

**Expected Result:** 
- Should show ONLY these paths for Employee role:
  - /dashboard
  - /attendance
  - /leave
  - /documents
  - /settings
  - /employee-dashboard

- Should NOT show:
  - /employees
  - /companies
  - /payroll
  - /reports
  - /admin/rbac
  - /admin/audit-logs
  - /admin/leave-approvals

---

## Step 2: Check All Roles and Their Modules

Run this to see the complete picture:

```sql
-- Check all roles and module counts
SELECT
  r.name as role,
  COUNT(rm.module_id) as total_modules,
  STRING_AGG(DISTINCT m.path, ', ' ORDER BY m.path) as module_paths
FROM roles r
LEFT JOIN role_modules rm ON r.id = rm.role_id
LEFT JOIN modules m ON rm.module_id = m.id
GROUP BY r.id, r.name
ORDER BY r.name;
```

**Expected Result:**
```
Employee              | 6  | /attendance, /dashboard, /documents, /employee-dashboard, /leave, /settings
Department Manager    | 9  | /attendance, /dashboard, /documents, /employees, /leave, /manager-dashboard, /payroll, /reports, /settings
HR Manager           | 10 | /attendance, /dashboard, /documents, /employees, /leave, /leave-approvals, /manager-dashboard, /payroll, /reports, /settings
Company Admin        | 12 | /admin/audit-logs, /admin/leave-approvals, /admin/rbac, /attendance, /companies, /dashboard, /documents, /employees, /leave, /payroll, /reports, /settings
Super Admin          | 13 | /admin/audit-logs, /admin/leave-approvals, /admin/rbac, /attendance, /companies, /dashboard, /documents, /employee-dashboard, /employees, /leave, /manager-dashboard, /payroll, /reports, /settings
```

---

## Step 3: If Employee Role Has Wrong Modules - Clean It Up

If Employee role has extra modules, run this cleanup:

```sql
-- Step 1: Remove ALL current Employee role modules
DELETE FROM role_modules
WHERE role_id = (SELECT id FROM roles WHERE name = 'Employee');

-- Step 2: Assign ONLY the correct modules to Employee
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
);

-- Step 3: Verify the fix
SELECT
  r.name as role,
  COUNT(rm.module_id) as module_count,
  STRING_AGG(m.name, ', ' ORDER BY m.name) as modules
FROM roles r
LEFT JOIN role_modules rm ON r.id = rm.role_id
LEFT JOIN modules m ON rm.module_id = m.id
WHERE r.name = 'Employee'
GROUP BY r.id, r.name;
```

---

## Step 4: Clean Up Other Roles (Optional but Recommended)

To ensure all roles have correct module assignments:

```sql
-- Remove all role_modules and reassign correctly
DELETE FROM role_modules;

-- Employee: Basic modules only
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Employee'
AND m.name IN ('Dashboard', 'Attendance', 'Leave Management', 'Documents', 'Settings', 'Employee Dashboard');

-- Department Manager
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Department Manager'
AND m.name IN (
  'Dashboard', 'Employees', 'Attendance', 'Leave Management',
  'Documents', 'Reports', 'Settings', 'Manager Dashboard', 'Leave Approvals'
);

-- HR Manager
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'HR Manager'
AND m.name IN (
  'Dashboard', 'Employees', 'Attendance', 'Leave Management', 'Payroll',
  'Documents', 'Reports', 'Settings', 'Manager Dashboard', 'Leave Approvals'
);

-- Company Admin
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Company Admin'
AND m.name IN (
  'Dashboard', 'Employees', 'Companies', 'Attendance', 'Leave Management', 'Payroll',
  'Documents', 'Reports', 'Settings', 'RBAC Management', 'Audit Logs', 'Leave Approvals'
);

-- Super Admin (all modules)
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'Super Admin'
AND m.is_system = true;

-- Verify all assignments
SELECT
  r.name as role,
  COUNT(rm.module_id) as module_count,
  STRING_AGG(m.name, ', ' ORDER BY m.name) as modules
FROM roles r
LEFT JOIN role_modules rm ON r.id = rm.role_id
LEFT JOIN modules m ON rm.module_id = m.id
GROUP BY r.id, r.name
ORDER BY r.name;
```

---

## Step 5: After Database Fix - Restart and Test

```bash
# 1. Stop the dev server
Ctrl+C

# 2. Clear browser cache
# Windows/Linux: Ctrl+Shift+Delete
# Mac: Cmd+Shift+Delete

# 3. Restart the dev server
npm run dev

# 4. Test with Employee user
# - Log out completely
# - Log back in as an Employee user
# - Check sidebar - should only see:
#   ✅ My Dashboard
#   ✅ Attendance
#   ✅ Leave Management
#   ✅ Documents
#   ✅ Profile Settings
#   ✅ Logout
# - Should NOT see:
#   ❌ Dashboard (admin dashboard)
#   ❌ Employees
#   ❌ Companies
#   ❌ Payroll
#   ❌ Reports
#   ❌ Administration section (RBAC, Audit Logs, Leave Approvals)
```

---

## Common Issues

### Issue: Employee still sees admin modules after fix
- [ ] Check if you ran the cleanup SQL in Step 3 or Step 4
- [ ] Verify the SQL ran without errors
- [ ] Clear browser cache completely (Ctrl+Shift+Delete)
- [ ] Check browser console (F12) for any errors
- [ ] Restart dev server and try again

### Issue: Other roles lost their modules
- [ ] Run Step 4 completely to reassign all modules
- [ ] Verify the module names match exactly in the database (case-sensitive)

### Issue: Dashboard still shows but shouldn't
- [ ] Employee role might still have /dashboard module
- [ ] The /dashboard module should only be for admins
- [ ] Run the diagnostic query to check what's assigned

---

## Success Criteria ✅

After applying the fixes:
- [ ] Employee role has ONLY 6 modules assigned
- [ ] Employee sees only 5 sidebar links (My Dashboard, Attendance, Leave Management, Documents, Settings)
- [ ] Employee does NOT see admin sidebar section
- [ ] Employee does NOT see navbar links in Header component
- [ ] Department Manager sees manager modules but NOT admin modules
- [ ] Company Admin and Super Admin see all modules including admin modules
