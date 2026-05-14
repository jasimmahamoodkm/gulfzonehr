# Fix: Employee Multiple Companies Issue

## Step 1: Find Which Employee Has Multiple Companies

Run this query in Supabase SQL Editor:

```sql
SELECT 
  u.email, 
  u.first_name,
  u.last_name,
  c.name as company_name,
  uc.is_primary,
  uc.assigned_at
FROM user_companies uc
JOIN users u ON uc.user_id = u.id
JOIN companies c ON uc.company_id = c.id
WHERE u.email = 'employee@example.com'  -- REPLACE with actual employee email
ORDER BY u.email, uc.assigned_at;
```

**Expected Result (for single company):**
- 1 row with the company name

**If seeing multiple rows:**
- Employee has multiple companies assigned
- Need to remove the extra ones

---

## Step 2: Count Companies Per User (Find All with Multiple)

Find all employees with 2+ companies:

```sql
SELECT 
  u.email,
  u.first_name,
  COUNT(uc.company_id) as company_count
FROM user_companies uc
JOIN users u ON uc.user_id = u.id
GROUP BY u.id, u.email, u.first_name
HAVING COUNT(uc.company_id) > 1
ORDER BY u.email;
```

This shows all users with multiple company assignments.

---

## Step 3: Remove Extra Companies

**Option A: For one specific employee**

```sql
-- Replace 'employee@example.com' with actual email
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM users WHERE email = 'employee@example.com')
AND is_primary = false;
```

**Option B: Keep only the primary company for all employees**

```sql
DELETE FROM user_companies
WHERE is_primary = false 
AND user_id IN (
  SELECT ur.user_id 
  FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE r.name = 'Employee'
);
```

**Option C: Manual - Delete specific company from employee**

```sql
DELETE FROM user_companies
WHERE user_id = (SELECT id FROM users WHERE email = 'employee@example.com')
AND company_id = (SELECT id FROM companies WHERE name = 'Company B');
```

---

## Step 4: Verify Fix

Run this to confirm employee now has only 1 company:

```sql
SELECT 
  u.email,
  u.first_name,
  COUNT(uc.company_id) as company_count,
  STRING_AGG(c.name, ', ') as companies
FROM user_companies uc
JOIN users u ON uc.user_id = u.id
JOIN companies c ON uc.company_id = c.id
GROUP BY u.id, u.email, u.first_name
HAVING COUNT(uc.company_id) > 1;
```

**Expected Result:** No rows (all employees now have 1 company)

---

## Step 5: Test Again

1. Log out from app
2. Clear browser cache (Ctrl+Shift+Delete)
3. Log back in as employee
4. ✅ Should auto-select company (no selection UI)
5. ✅ Redirect to `/employee-dashboard`

---

## Why This Happened

During user creation/management, the system allowed employees to be assigned multiple companies. We need to add validation to prevent this.

**Next:** Add business logic to enforce:
- ✅ Employees: Only 1 company
- ✅ HR Managers: Only 1 company  
- ✅ Department Managers: Only 1 company
- ✅ Admins Only: Multiple companies allowed

This should be done in the user creation/assignment UI.
