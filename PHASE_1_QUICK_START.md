# Phase 1 Quick Start - What To Do Now

## 🚀 5-Minute Setup

### Step 1: Apply the Migration (2 min)

1. Go to your Supabase dashboard
2. Click **SQL Editor** → **New Query**
3. Copy entire contents of: `migrations/010_add_dashboard_modules.sql`
4. Paste in SQL Editor
5. Click **Run**
6. ✅ Should complete without errors

### Step 2: Restart Dev Server (1 min)

```bash
# Stop server: Ctrl+C
# Restart:
npm run dev
```

### Step 3: Start Testing (2 min)

Open `TESTING_CHECKLIST_PHASE_1.md` and follow Scenario 1 first:
- Log in as employee
- Should see company selection
- Select company
- Should see employee dashboard

---

## 📋 Testing Quick Reference

### Quick Tests (5 minutes)
1. **Employee login** → See company selection? ✅/❌
2. **Select company** → Redirected to employee-dashboard? ✅/❌
3. **Check sidebar** → See "My Dashboard"? ✅/❌
4. **Check sidebar** → Don't see "Team Dashboard"? ✅/❌

### Detailed Tests (30 minutes)
- Follow all 10 scenarios in `TESTING_CHECKLIST_PHASE_1.md`
- Check console logs match expected patterns
- Verify all data displays correctly

### Full Integration Test (1 hour)
- Complete Test A, B, C in testing checklist
- Test permission changes
- Test all role types
- Verify admin module assignment works

---

## 📊 Expected Results

### ✅ When Working Correctly

**Employee (1st Login):**
```
Login → Company Selection → Select → Employee Dashboard
```

**Employee (2nd Login):**
```
Login → Employee Dashboard (no company selection)
```

**Manager:**
```
Login → Main Dashboard
Sidebar: "My Dashboard" + "Team Dashboard" visible
```

**Admin:**
```
Login → Main Dashboard
Admin section visible in sidebar
Can assign modules to roles in /admin/rbac
```

---

## 🔍 What to Look For

### Browser Console (F12)
Look for these messages:

**Good Signs:**
```
✅ Company selected: [UUID]
✅ Companies loaded: Array(n)
📋 Loading allowed modules for roleIds: [...]
✅ Allowed module paths: Array(n)
```

**Bad Signs:**
```
❌ Error loading companies: [error message]
Uncaught TypeError: ...
Failed to query: ...
```

### Database
- Should have `modules` table with 12 rows
- Should have `role_modules` with module assignments
- Employees should have sample data for dashboards

---

## 🎯 Success Criteria

All of these should be TRUE:

- [ ] Migration applied without errors
- [ ] Module tables exist in Supabase
- [ ] Employee sees company selection on 1st login
- [ ] Employee dashboard loads after company selection
- [ ] Sidebar filters modules correctly for employees
- [ ] Sidebar shows manager dashboard only for managers
- [ ] Unauthenticated access redirects to login
- [ ] Admin can toggle modules in RBAC page
- [ ] Manager dashboard shows team data
- [ ] No errors in browser console

---

## 🆘 If Something Goes Wrong

### Issue: Company selection doesn't appear
**Check:**
1. Are you testing with an employee account?
2. Does that employee have `company_id = NULL` in database?
3. Do any companies exist in `companies` table?

**Fix:**
```sql
-- Check if employee exists and has no company
SELECT id, email, company_id FROM users 
WHERE email = 'employee@example.com';

-- If company_id is set, update it:
UPDATE users SET company_id = NULL 
WHERE email = 'employee@example.com';
```

### Issue: Sidebar shows modules that shouldn't be there
**Check:**
1. Did you restart the dev server after migration?
2. Check browser console for module loading logs
3. Are your roles properly assigned?

**Fix:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Restart dev server
3. Log out and log back in

### Issue: Employee dashboard doesn't load
**Check:**
1. Do you have the `employee-dashboard` page file?
2. Are there attendance records in the database?
3. Check browser console for errors

**Fix:**
1. Check file exists: `src/app/employee-dashboard/page.tsx`
2. Create test data in Supabase

### Issue: Migration fails
**Check:**
1. Copy entire migration file exactly
2. Make sure you're in SQL Editor
3. Check for typos in SQL

**Fix:**
1. Try running manually (see MIGRATION_GUIDE_PHASE_1.md)
2. Check Supabase logs for detailed error
3. Verify tables exist first

---

## 📞 Quick Help

**File Locations:**
- Migration: `migrations/010_add_dashboard_modules.sql`
- Testing Guide: `TESTING_CHECKLIST_PHASE_1.md`
- Migration Help: `MIGRATION_GUIDE_PHASE_1.md`
- Full Details: `PHASE_1_RBAC_IMPLEMENTATION_SUMMARY.md`

**Key Changes:**
- Login page: `src/app/login/page.tsx`
- Sidebar: `src/components/layout/Sidebar.tsx`
- Route guard: `src/components/RouteGuard.tsx`
- Employee dashboard: `src/app/employee-dashboard/page.tsx`
- Manager dashboard: `src/app/manager-dashboard/page.tsx`
- Admin RBAC: `src/app/admin/rbac/page.tsx`

---

## ✨ Summary

**What You're Testing:**
1. Employee company selection on login
2. Module-based sidebar filtering
3. Personal and manager dashboards
4. RBAC module assignment

**How Long:**
- Quick verification: 5-10 minutes
- Detailed testing: 30-45 minutes
- Full testing: 1-2 hours

**Next:**
- Report any issues you find
- If all tests pass, Phase 1 is complete! 🎉
- Then we move to Phase 2 features

---

**Ready? Start with the migration, then test Scenario 1 in TESTING_CHECKLIST_PHASE_1.md**
