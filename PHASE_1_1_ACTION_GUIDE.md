# Phase 1.1 Action Guide - Next Steps

## 🚀 Quick Start (10 minutes)

### Step 1: Apply Migration (3 min)

1. **Open Supabase Dashboard**
   - Go to your GulfZoneHR project
   - Click **SQL Editor** → **New Query**

2. **Copy Migration SQL**
   - Open: `migrations/011_create_user_companies.sql`
   - Copy entire contents

3. **Paste and Execute**
   - Paste in SQL Editor
   - Click **Run**
   - ✅ Should complete without errors

### Step 2: Verify Migration (2 min)

Run these verification queries in SQL Editor:

**Query 1: Check table created**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'user_companies';
```

**Expected:** One row with `user_companies`

**Query 2: Check data backfilled**
```sql
SELECT user_id, company_id, is_primary FROM user_companies LIMIT 5;
```

**Expected:** Your existing user-company relationships migrated

**Query 3: Check indexes created**
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'user_companies';
```

**Expected:** Three indexes for performance

### Step 3: Restart Server (2 min)

```bash
# Stop current server: Ctrl+C

# Restart
npm run dev
```

### Step 4: Test Single Company User (3 min)

1. **Log out** if logged in
2. **Login as an Employee** (non-admin with 1 company)
3. **Expected:**
   - ✅ No company selection UI
   - ✅ Auto-redirects to `/employee-dashboard`
   - ✅ Console shows: `✅ Auto-selected only company: [UUID]`

### Step 5: Test Multi-Company Admin (Optional)

If you have an admin with multiple companies:

1. **Login as Company Admin** with 2+ companies
2. **Expected:**
   - ✅ Company selection UI appears
   - ✅ All companies shown as buttons
   - ✅ Primary company highlighted
   - ✅ Clicking company → Redirect to `/dashboard`

---

## 📊 Expected Console Output

When logging in, you should see these logs in browser console (F12):

```
📍 Loading user companies for userId: abc-123-def
✅ user_companies fetched: Array(1)
✅ Companies fetched: Array(1)
✅ Merged companies: [
  {company_id: "...", company_name: "Your Company", is_primary: true, ...}
]
✅ Auto-selected only company: xyz-789-ghi
```

---

## 🔍 If Something Goes Wrong

### Issue: Migration Fails
**Error Message:** Syntax error / Table exists

**Solution:**
1. Check SQL Editor has no syntax errors
2. Try running only the table creation:
   ```sql
   CREATE TABLE IF NOT EXISTS user_companies (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(id),
     company_id UUID NOT NULL REFERENCES companies(id),
     is_primary BOOLEAN DEFAULT false,
     assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE(user_id, company_id)
   );
   ```
3. Then create indexes separately
4. Then add RLS policies

### Issue: No Company Selection UI When Expected
**Check:**
1. Does the user have 2+ companies in `user_companies` table?
   ```sql
   SELECT COUNT(*) FROM user_companies WHERE user_id = 'your-user-id';
   ```
2. Are you logged in as an admin (Company Admin or Super Admin)?
3. Check browser console for error messages

**Solution:**
1. Manually assign multiple companies to test user:
   ```sql
   INSERT INTO user_companies (user_id, company_id, is_primary)
   VALUES 
   ('user-id', 'company-id-1', true),
   ('user-id', 'company-id-2', false);
   ```
2. Log out, clear browser cache, log back in
3. Company selection UI should appear

### Issue: Login Goes to Wrong Dashboard
**Check:**
1. Is user's role "Employee"?
2. If Employee: Should go to `/employee-dashboard`
3. If Manager/Admin: Should go to `/dashboard`

**Solution:**
1. Check user's role_name in console logs
2. Verify user_roles table has correct assignment
3. Check that roles table has correct role names

### Issue: No Companies Appear in Selection UI
**Check:**
1. Do the companies exist in `companies` table?
2. Are they linked in `user_companies`?

**Solution:**
1. Check companies table has data:
   ```sql
   SELECT id, name FROM companies LIMIT 5;
   ```
2. Verify user_companies links to real companies:
   ```sql
   SELECT uc.user_id, uc.company_id, c.name
   FROM user_companies uc
   JOIN companies c ON uc.company_id = c.id
   WHERE uc.user_id = 'your-user-id';
   ```

---

## ✅ Success Checklist

After applying migration and testing:

- [ ] Migration applied successfully
- [ ] user_companies table exists in Supabase
- [ ] Single company users auto-select (no UI)
- [ ] Multi-company admins see selection UI
- [ ] Employees redirect to `/employee-dashboard`
- [ ] Managers/Admins redirect to `/dashboard`
- [ ] Company name appears in sidebar
- [ ] Console logs show expected flow
- [ ] No errors in browser console

---

## 📋 What to Test Next

### Basic Flow Test
1. **Login as Employee (1 company)**
   - ✅ Auto-select → dashboard
   
2. **Login as HR Manager (1 company)**
   - ✅ Auto-select → main dashboard

3. **Login as Admin (2+ companies)**
   - ✅ Show selection UI
   - ✅ Pick company → dashboard

### Expected Results

| User Role | Companies | Action |
|-----------|-----------|--------|
| Employee | 1 | Auto-select → `/employee-dashboard` |
| HR Manager | 1 | Auto-select → `/dashboard` |
| Manager | 1 | Auto-select → `/dashboard` |
| Company Admin | 2+ | Show UI → Select → `/dashboard` |
| Super Admin | 2+ | Show UI → Select → `/dashboard` |

---

## 🎯 Summary

**You are at:** Migration ready, code complete
**Next step:** Apply migration
**Then:** Run test scenarios
**Time needed:** 15-30 minutes total

**Commands:**
```bash
# 1. Check if server is running
npm run dev

# 2. After migration, restart if needed
# Ctrl+C to stop
# npm run dev to restart

# 3. Test in browser
# Open http://localhost:3000/login
```

---

## 📞 Quick Reference

| What | Where |
|------|-------|
| Migration file | `migrations/011_create_user_companies.sql` |
| Implementation details | `PHASE_1_1_IMPLEMENTATION_CHECKLIST.md` |
| Design document | `PHASE_1_REVISED_DESIGN.md` |
| Code: AuthContext | `src/context/AuthContext.tsx` |
| Code: Login page | `src/app/login/page.tsx` |
| Types | `src/types/auth.ts` |

---

**Ready? Start with Step 1 above!** 👆
