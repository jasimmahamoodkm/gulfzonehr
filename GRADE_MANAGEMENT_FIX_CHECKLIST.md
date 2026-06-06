# Grade Management Fix Checklist
## Quick Steps to Get It Working

---

## 🚀 Quick Fix (Try These First)

### Step 1: Refresh Browser
```
Press: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

### Step 2: Clear Cache
```
DevTools (F12) → Application → Storage
  → Clear All (localStorage, sessionStorage, caches)
```

### Step 3: Logout and Login Again
```
1. Click Logout in sidebar
2. Wait for complete logout
3. Login again as Super Admin
4. Check console logs (F12 → Console)
```

---

## 🔍 Check These 3 Things

### Check 1: Is Super Admin Role Assigned?

**In Browser Console (F12 → Console), run:**
```javascript
const { data: { user } } = await supabase.auth.getUser();
const { data: roles } = await supabase
  .from('user_roles')
  .select('role_name')
  .eq('user_id', user.id);
console.log("User roles:", roles?.map(r => r.role_name));
```

**Expected output:**
```
User roles: ['Super Admin']
```

**If you see empty array [] or no 'Super Admin':**
- ❌ Super Admin role not assigned
- ✅ Fix: Check database - is user assigned Super Admin role?

---

### Check 2: Does Company Get Auto-Selected?

**Look at Console (F12 → Console) after login, you should see:**
```
✅ Super Admin: Auto-selected first company: [Company Name]
```

**If you DON'T see this:**
- ❌ Company not being selected
- Check if companies exist:
  ```javascript
  const { data: companies } = await supabase.from('companies').select('*');
  console.log("Companies:", companies);
  ```
- If empty, create a test company in Supabase

---

### Check 3: Does Sidebar Show Grade Configuration?

**Look at Sidebar:**
```
Scroll down in sidebar to see:

ADMINISTRATION
├── Grade Configuration  ← Should see this
└── Leave Approvals
```

**If you don't see "ADMINISTRATION" section:**
- ❌ Admin items filtered out
- Check console logs (F12 → Console) for why

---

## 🔧 Database Fixes

If checks above failed, run these in Supabase SQL Editor:

### Fix 1: Ensure Super Admin Role Exists
```sql
-- Check if Super Admin role exists
SELECT * FROM roles WHERE name = 'Super Admin';

-- If not, create it
INSERT INTO roles (name, description) 
VALUES ('Super Admin', 'System Administrator')
ON CONFLICT DO NOTHING;
```

### Fix 2: Assign Super Admin Role to User
```sql
-- Replace 'user-email@example.com' with your email
-- First get your user ID
SELECT id FROM users WHERE email = 'user-email@example.com';

-- Then assign Super Admin role (use the ID from above)
INSERT INTO user_roles (user_id, role_name, company_id)
VALUES ('your-user-id-here', 'Super Admin', NULL)
ON CONFLICT DO NOTHING;
```

### Fix 3: Create a Test Company (if none exist)
```sql
INSERT INTO companies (name, email)
VALUES ('Test Company', 'test@company.com')
ON CONFLICT DO NOTHING;

-- Verify it was created
SELECT * FROM companies;
```

### Fix 4: Assign Company to Super Admin User
```sql
-- Get the first company ID
SELECT id FROM companies LIMIT 1;

-- Assign to user (replace user-id)
INSERT INTO user_companies (user_id, company_id, is_primary)
VALUES ('your-user-id-here', 'first-company-id-here', true)
ON CONFLICT DO NOTHING;
```

---

## ✅ Verification After Fixes

After running database fixes:

1. **Refresh browser:**
   ```
   Ctrl+Shift+R (full refresh)
   ```

2. **Check console logs (F12 → Console):**
   ```
   Should see:
   ✅ Super Admin: Auto-selected first company: [Company Name]
   ✅ Grade Configuration: VISIBLE
   ```

3. **Check sidebar:**
   ```
   Should show:
   ADMINISTRATION
   ├── Grade Configuration
   └── Leave Approvals
   ```

4. **Click Grade Configuration:**
   ```
   Should navigate to /admin/grades
   ```

---

## 📋 Diagnostic Information

If still not working, gather this info and share:

### 1. Console Logs (F12 → Console)
Copy everything that contains:
- "Super Admin"
- "Grade Configuration"
- "selectedCompany"
- Any error messages

### 2. Your Email
```
Email: _______________________
```

### 3. Database Status
Run in Supabase SQL Editor and share results:

```sql
-- Your user roles
SELECT role_name FROM user_roles 
WHERE user_id = (SELECT id FROM users WHERE email = '[YOUR-EMAIL]');

-- Your company assignments
SELECT company_id FROM user_companies 
WHERE user_id = (SELECT id FROM users WHERE email = '[YOUR-EMAIL]');

-- Total companies
SELECT COUNT(*) as company_count FROM companies;

-- First company (what should be auto-selected)
SELECT id, name FROM companies LIMIT 1;
```

---

## 🎯 Expected Timeline

After fixes:

```
0 sec   → Refresh browser
1 sec   → Check console logs
2 sec   → Verify "Super Admin: Auto-selected first company"
3 sec   → Check sidebar for ADMINISTRATION section
5 sec   → Click Grade Configuration
10 sec  → /admin/grades page loads
```

**Total: ~10 seconds to verify fix**

---

## ⚠️ Common Issues & Quick Fixes

### Issue 1: "User roles: []" (empty)
**Fix:**
```sql
-- Assign Super Admin role
INSERT INTO user_roles (user_id, role_name, company_id)
VALUES ('[user-id]', 'Super Admin', NULL);

-- Then: F12 → Application → Clear All → Refresh browser
```

### Issue 2: "selectedCompany: NONE SELECTED"
**Fix:**
```sql
-- Assign a company to user
INSERT INTO user_companies (user_id, company_id, is_primary)
VALUES ('[user-id]', '[any-company-id]', true);

-- Then: Refresh browser
```

### Issue 3: "Grade Configuration: 🚫 does not match required role"
**This is a bug.** Workaround:
```sql
-- Add HR Manager role in addition to Super Admin
INSERT INTO user_roles (user_id, role_name, company_id)
VALUES ('[user-id]', 'HR Manager', '[company-id]');
```

### Issue 4: Console shows errors
**Fix:**
1. Logout (click Logout button)
2. Wait for redirect to /login
3. Login again
4. Check console logs again

---

## 📞 If Still Not Working

Please provide:

1. **Your Super Admin email:** ________________
2. **Console logs (copy from F12 → Console):** 
   ```
   [Paste logs here]
   ```
3. **Which step failed:**
   - [ ] Check 1: Super Admin role assigned
   - [ ] Check 2: Company auto-selected
   - [ ] Check 3: Grade Configuration visible
4. **What you see instead:**
   ```
   [Describe what sidebar shows]
   ```

With this info, I can diagnose the exact issue in your system.

---

## ✨ Expected Success

When working correctly:

```
1. Login as Super Admin
2. See "✅ Super Admin: Auto-selected first company: [Name]" in console
3. Sidebar shows "ADMINISTRATION" section
4. Can see "Grade Configuration" in sidebar
5. Can click to navigate to /admin/grades
```

That's it! Grade Management should now be accessible.

---

**Current Build Status:** ✅ Ready
**Debug Logging:** ✅ Enabled
**Next Step:** Follow checklist above
