# Grade Management Not Showing - Debugging Guide

## 🔍 How to Debug

### Step 1: Open Browser DevTools
```
Press: F12 (Windows/Linux) or Cmd+Option+I (Mac)
```

### Step 2: Go to Console Tab
```
DevTools → Console tab
```

### Step 3: Look for Debug Logs

You should see logs like:

**Company Context Logs:**
```
✅ Super Admin: Auto-selected first company: [Company Name]
🔍 User is Super Admin, auto-selecting first company
```

**Sidebar Debug Info:**
```
🔍 Sidebar Debug Info:
  User roles: ['Super Admin']
  isSuperAdmin: true
  isCompanyAdmin: false
  isHRManager: false
  isAdmin: true
  selectedCompany: [Company Name]
```

**Admin Items Visibility:**
```
✅ Grade Configuration: VISIBLE (role: HR Manager, company: [Company Name])
✅ Leave Approvals: VISIBLE (role: HR Manager, company: [Company Name])
```

---

## 🧪 Diagnostic Checklist

Run through these checks in order:

### Check 1: Is User a Super Admin?
**In Console:**
```javascript
// Should print: ['Super Admin']
console.log("Current user roles:", window.location.pathname);
```

**OR look for log:**
```
User roles: ['Super Admin']
isSuperAdmin: true
```

**If not showing:**
- ❌ User is not Super Admin
- ✅ Check that user has Super Admin role in database
- ✅ Run query in Supabase:
  ```sql
  SELECT * FROM user_roles WHERE user_id = 'user-id' AND role_name = 'Super Admin';
  ```

---

### Check 2: Is Company Auto-Selected?
**Look for log:**
```
✅ Super Admin: Auto-selected first company: [Company Name]
```

**If NOT showing:**
- Check: "🔍 User is Super Admin, auto-selecting first company" appears?
  - If YES: Means company selection code ran
  - If NO: User is not being detected as Super Admin in CompanyContext

**In Sidebar Debug:**
```
selectedCompany: [Company Name]  // Should NOT say "NONE SELECTED"
```

**If selectedCompany is NONE SELECTED:**
- ❌ Company auto-selection failed
- ✅ Check if user has primary company:
  ```sql
  SELECT * FROM user_companies WHERE user_id = 'user-id' AND is_primary = true;
  ```
- ✅ Check if user has company in users table:
  ```sql
  SELECT company_id FROM users WHERE id = 'user-id';
  ```

---

### Check 3: Are Admin Items Visible?
**Look for logs:**
```
✅ Grade Configuration: VISIBLE (role: HR Manager, company: [Company Name])
✅ Leave Approvals: VISIBLE (role: HR Manager, company: [Company Name])
```

**If showing BLOCKED reasons:**
```
🚫 Grade Configuration: Requires company but none selected
🚫 Grade Configuration: User roles [Super Admin] do not match required role: HR Manager
```

**If you see "Requires company but none selected":**
- ❌ Company is not selected (Check 2 issue)
- ✅ Verify selectedCompany is being passed from CompanyContext

**If you see "User roles do not match":**
- This is WRONG because Super Admin should match HR Manager requirement
- ❌ There's a bug in the role matching logic
- ✅ Contact support with these logs

---

### Check 4: Does Sidebar Show Administration Section?
**Look at Sidebar:**
```
Main Navigation Items
├── Dashboard
├── Employees
├── Companies
├── Attendance
├── Leave Management
├── Payroll
├── Documents
├── Reports

ADMINISTRATION               ← Should see this header
├── Grade Configuration     ← Should see these items
├── Leave Approvals
└── (RBAC Management)       ← Only for Company Admin
```

**If Administration section is MISSING:**
- Check if `isAdmin` is true (should be for Super Admin)
- Check if `visibleAdminItems` has items (should not be empty)
- Look for logs in the filter section

**If Administration section is EMPTY:**
- All items filtered out
- Check logs to see which ones are blocked and why

---

## 📊 Complete Debug Log Example

### Expected For Super Admin:

```
Console Output:

✅ Super Admin: Auto-selected first company: Acme Corporation
🔍 User is Super Admin, auto-selecting first company

🔍 Sidebar Debug Info:
  User roles: ['Super Admin']
  isSuperAdmin: true
  isCompanyAdmin: false
  isHRManager: false
  isAdmin: true
  selectedCompany: Acme Corporation

✅ RBAC Management: VISIBLE (role: Company Admin, company: Acme Corporation)
✅ Audit Logs: VISIBLE (role: Company Admin, company: Acme Corporation)
✅ Grade Configuration: VISIBLE (role: HR Manager, company: Acme Corporation)
✅ Leave Approvals: VISIBLE (role: HR Manager, company: Acme Corporation)
```

### If You See This Instead:

```
🔍 User is Super Admin, auto-selecting first company
[But no "✅ Super Admin: Auto-selected first company: [Name]" log]

Means: Company selection code ran but didn't find any companies

Check: Do companies exist in database?
```

---

## 🔧 Step-by-Step Troubleshooting

### Scenario 1: Admin Section Completely Hidden

**Logs show:**
```
selectedCompany: NONE SELECTED
```

**Fix:**
1. Check database - does user have assigned company?
   ```sql
   SELECT * FROM user_companies WHERE user_id = '[super-admin-id]';
   SELECT company_id FROM users WHERE id = '[super-admin-id]';
   ```
2. If user has no company assignment, manually assign:
   ```sql
   UPDATE users SET company_id = '[first-company-id]' WHERE id = '[super-admin-id]';
   ```
3. OR add to user_companies:
   ```sql
   INSERT INTO user_companies (user_id, company_id, is_primary)
   VALUES ('[super-admin-id]', '[first-company-id]', true);
   ```
4. Refresh browser (Ctrl+Shift+R or Cmd+Shift+R)

---

### Scenario 2: Admin Section Shows But No Grade Items

**Logs show:**
```
selectedCompany: Acme Corporation
isSuperAdmin: true
```

**BUT:**
```
🚫 Grade Configuration: User roles [Super Admin] do not match required role: HR Manager
```

**This is a bug!** The role matching is wrong. The code should match Super Admin to HR Manager requirement.

**Workaround:** Add HR Manager role to user:
```sql
INSERT INTO user_roles (user_id, role_id, role_name, company_id)
VALUES ('[user-id]', '[role-id]', 'HR Manager', '[company-id]');
```

---

### Scenario 3: Role Detection Shows False

**Logs show:**
```
isSuperAdmin: false
User roles: []
```

**Means:** User is logged in but roles are not loaded

**Fix:**
1. Check if roles are in user_roles table:
   ```sql
   SELECT * FROM user_roles WHERE user_id = '[user-id]';
   ```
2. If empty, assign Super Admin role:
   ```sql
   INSERT INTO user_roles (user_id, role_id, role_name, company_id)
   VALUES ('[user-id]', 'super-admin', 'Super Admin', NULL);
   ```
3. Clear auth session and login again (logout → login)

---

### Scenario 4: Company Auto-Selection Not Working

**Logs show:**
```
🔍 User is Super Admin, auto-selecting first company
selectedCompany: NONE SELECTED
```

**But no "✅ Super Admin: Auto-selected first company" log**

**Means:** Companies list is empty or fetch failed

**Check:**
1. Do companies exist in database?
   ```sql
   SELECT COUNT(*) FROM companies;
   ```
2. Check browser console for fetch errors
3. Check Supabase logs for database errors

**Fix:**
1. Create at least one company:
   ```sql
   INSERT INTO companies (name, email) VALUES ('Test Company', 'test@company.com');
   ```
2. Refresh page

---

## 🔍 Quick Console Commands

Run these in browser Console (F12 → Console):

### Check Current User
```javascript
const { data: { user } } = await supabase.auth.getUser();
console.log("Current user:", user?.email);
```

### Check User Roles
```javascript
const { data: roles } = await supabase
  .from('user_roles')
  .select('role_name')
  .eq('user_id', (await supabase.auth.getUser()).data.user.id);
console.log("User roles:", roles);
```

### Check Companies
```javascript
const { data: companies } = await supabase.from('companies').select('*');
console.log("Companies count:", companies?.length);
console.log("Companies:", companies);
```

### Check Company Assignment
```javascript
const user = (await supabase.auth.getUser()).data.user;
const { data: userComp } = await supabase
  .from('user_companies')
  .select('company_id')
  .eq('user_id', user.id);
console.log("User company assignments:", userComp);
```

---

## 📋 Information to Include When Reporting Issues

If Grade Configuration is not showing, please provide:

1. **Console logs** (copy from F12 → Console):
   ```
   - "Sidebar Debug Info" section
   - "Grade Configuration" visibility line
   - "selectedCompany" value
   - Any error messages
   ```

2. **Database checks:**
   ```sql
   -- Your Super Admin user ID:
   SELECT id FROM users WHERE email = '[your-email]';
   
   -- Your user roles:
   SELECT role_name FROM user_roles WHERE user_id = '[above-id]';
   
   -- Your company assignments:
   SELECT company_id FROM user_companies WHERE user_id = '[above-id]';
   
   -- Total companies in system:
   SELECT COUNT(*) FROM companies;
   ```

3. **Which of these logs you see:**
   - ✅ "Super Admin: Auto-selected first company"
   - ✅ "selectedCompany: [Name]" or "NONE SELECTED"
   - ✅ "Grade Configuration: VISIBLE" or "🚫 Grade Configuration"

---

## ✅ When It's Working Correctly

You should see:

1. **On page load:**
   ```
   ✅ Super Admin: Auto-selected first company: [Company Name]
   ```

2. **In Sidebar Debug:**
   ```
   selectedCompany: [Company Name]  // NOT "NONE SELECTED"
   isSuperAdmin: true
   ```

3. **In Admin Items Visibility:**
   ```
   ✅ Grade Configuration: VISIBLE
   ✅ Leave Approvals: VISIBLE
   ```

4. **In Sidebar UI:**
   - Sidebar shows "ADMINISTRATION" header
   - Grade Configuration appears under Administration
   - Can click Grade Configuration to navigate

---

## 🆘 If None of This Works

Please provide:
1. Screenshot of console logs
2. Your user email
3. Screenshot of sidebar
4. Output of database queries above

And I can diagnose the specific issue with your setup.
