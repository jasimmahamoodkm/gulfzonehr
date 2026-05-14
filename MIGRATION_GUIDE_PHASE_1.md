# Phase 1 RBAC Migration Guide

## Quick Start: Run the Dashboard Modules Migration

### Step 1: Open Supabase SQL Editor
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your GulfZoneHR project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"**

### Step 2: Copy and Execute the Migration

**Copy the entire SQL from:** `migrations/010_add_dashboard_modules.sql`

Paste it into the SQL Editor and click **"Run"**

### What This Does

The migration performs these operations:

```sql
-- 1. Creates 'modules' table (if not exists)
-- 2. Creates 'role_modules' junction table (if not exists)
-- 3. Inserts Employee Dashboard module
-- 4. Inserts Manager Dashboard module
-- 5. Assigns Employee Dashboard to all roles
-- 6. Assigns Manager Dashboard to manager/admin roles
-- 7. Enables RLS policies
```

**Expected Result:**
- ✅ No errors
- ✅ "Rows affected: 0" (likely, due to ON CONFLICT DO NOTHING)
- ✅ Tables created successfully

### Step 3: Verify the Migration

Run these verification queries in SQL Editor to confirm:

**Query 1: Check modules were created**
```sql
SELECT id, name, path FROM modules 
WHERE name IN ('Employee Dashboard', 'Manager Dashboard');
```

**Expected Result:**
```
id | name                 | path
---|----------------------|----------------------
1  | Employee Dashboard   | /employee-dashboard
2  | Manager Dashboard    | /manager-dashboard
```

**Query 2: Check role_modules assignments**
```sql
SELECT r.name as role_name, m.name as module_name
FROM role_modules rm
JOIN roles r ON rm.role_id = r.id
JOIN modules m ON rm.module_id = m.id
WHERE m.name IN ('Employee Dashboard', 'Manager Dashboard')
ORDER BY r.name;
```

**Expected Result:**
```
role_name           | module_name
--------------------|----------------------
Employee            | Employee Dashboard
Department Manager  | Employee Dashboard
Department Manager  | Manager Dashboard
HR Manager          | Employee Dashboard
HR Manager          | Manager Dashboard
Company Admin       | Employee Dashboard
Company Admin       | Manager Dashboard
Super Admin         | Employee Dashboard
Super Admin         | Manager Dashboard
```

### Step 4: Restart Development Server

After running the migration, restart your dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

---

## Troubleshooting Migration Issues

### Issue: "Table already exists"
**Solution:** This is normal with `ON CONFLICT DO NOTHING`. The migration is idempotent.

### Issue: "Column doesn't exist"
**Solution:** Check that the modules and role_modules tables were created by the initial setup migrations.

### Issue: "Foreign key constraint"
**Solution:** Ensure roles table exists and has valid role IDs. Check that modules table exists.

### Issue: "Permission denied"
**Solution:** 
1. Make sure you're using a role with admin privileges (Service Role or Supabase admin user)
2. Or use the Supabase SQL Editor (which automatically has permissions)

---

## Manual Alternative: If Migration Script Fails

If the migration doesn't work, you can manually create the modules:

### Create Employee Dashboard Module

```sql
INSERT INTO modules (name, description, icon, path, order_index, is_system)
VALUES (
  'Employee Dashboard',
  'Personal dashboard with attendance, leave balance, and payroll information',
  'LayoutDashboard',
  '/employee-dashboard',
  0,
  true
)
ON CONFLICT DO NOTHING;
```

### Create Manager Dashboard Module

```sql
INSERT INTO modules (name, description, icon, path, order_index, is_system)
VALUES (
  'Manager Dashboard',
  'Team management dashboard with attendance, leave approvals, and performance metrics',
  'BarChart3',
  '/manager-dashboard',
  0.5,
  true
)
ON CONFLICT DO NOTHING;
```

### Assign to Employee Role

```sql
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id 
FROM roles r, modules m
WHERE m.name = 'Employee Dashboard'
AND r.name = 'Employee'
ON CONFLICT DO NOTHING;
```

### Assign Manager Dashboard to Manager Roles

```sql
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id 
FROM roles r, modules m
WHERE m.name = 'Manager Dashboard'
AND r.name IN ('Department Manager', 'HR Manager', 'Company Admin', 'Super Admin')
ON CONFLICT DO NOTHING;
```

---

## After Migration: Next Steps

1. ✅ Migration applied
2. ✅ Development server restarted
3. ⏭️ **Run the testing checklist** (see TESTING_CHECKLIST_PHASE_1.md)
4. ⏭️ **Verify all scenarios pass**
5. ⏭️ **Report any issues**

---

## Important Notes

- **This migration is safe to run multiple times** (idempotent with ON CONFLICT)
- **No data is deleted** (only additions)
- **All changes are reversible** (by deleting from role_modules table)
- **RLS policies are enabled** (rows are readable by authenticated users)

---

## Verification Checklist

After running migration:
- [ ] SQL executed without errors
- [ ] Verification queries show expected results
- [ ] Development server restarted
- [ ] Browser console shows module loading logs
- [ ] Sidebar shows correct modules for your role
- [ ] Employee dashboard is accessible
- [ ] Manager dashboard appears only for managers

---

## Support

If you encounter any issues:
1. Check the browser console (F12) for error messages
2. Run verification queries above
3. Check Supabase logs for database errors
4. Review the troubleshooting section above
