# Employee Auto-Creation - Quick Test Guide

## 🚀 Fast Track Testing (10 minutes)

### Step 1: Prepare Your Environment
```bash
# Ensure .env.local has these variables
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # ⚠️ CRITICAL
```

**Where to get Service Role Key:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Settings → API
4. Copy the "service_role" (SECRET) key - it starts with `eyJ...`

### Step 2: Start Development Server
```bash
npm run dev
```
Wait for "Ready in X ms" message.

### Step 3: Get Your Company ID
```bash
# In Supabase SQL Editor, run:
SELECT id, name FROM companies LIMIT 1;
```
Copy the UUID of any company (e.g., `550e8400-e29b-41d4-a716-446655440000`)

### Step 4: Create a Test Employee

**Option A: Using cURL**
```bash
curl -X POST http://localhost:3000/api/admin/create-employee \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee.test@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "company_id": "YOUR_COMPANY_UUID",
    "phone": "+971501234567",
    "position": "Test Position",
    "department": "Test Dept",
    "date_of_joining": "2026-05-11"
  }'
```

**Option B: Using the bash script**
```bash
# Edit TEST_EMPLOYEE_CREATION.sh and update:
# 1. COMPANY_ID variable
# 2. Run: bash TEST_EMPLOYEE_CREATION.sh
```

### Step 5: Verify Response
You should get a 201 response with:
```json
{
  "success": true,
  "data": {
    "userId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "employeeId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "email": "employee.test@example.com",
    "temporaryPassword": "A9#k2mL8@xQ1",
    "first_name": "John",
    "last_name": "Doe",
    "message": "Employee created successfully. Share the temporary password with the employee."
  }
}
```

✅ **Copy the temporary password** - you'll need it for login

### Step 6: Verify in Supabase
Open Supabase SQL Editor and run:
```sql
-- Verify user was created
SELECT id, email, first_name FROM users 
WHERE email = 'employee.test@example.com';

-- Verify employee record exists
SELECT id, email, first_name FROM employees 
WHERE email = 'employee.test@example.com';

-- CRITICAL: Verify Employee role was assigned
SELECT ur.*, r.name as role_name FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = (
  SELECT id FROM users WHERE email = 'employee.test@example.com'
);
```

**Expected Results:**
- ✅ One user record with email matching
- ✅ One employee record with email matching
- ✅ One user_roles record with role_name = 'Employee'

### Step 7: Test Employee Login
1. Open http://localhost:3000/login
2. Enter credentials:
   - **Email**: employee.test@example.com
   - **Password**: (paste the temporaryPassword from Step 5)
3. Click Login

**Expected Behavior:**
- ✅ Login succeeds
- ✅ Redirected to `/employee-dashboard`
- ✅ Header shows "John Doe" (the employee's name)

### Step 8: Verify Employee Dashboard
Once logged in as the test employee:

**Check Sidebar**
- ✅ Should show: Dashboard, Attendance, Leaves, Settings
- ❌ Should NOT show: Employees, Companies, Reports, Payroll

**Check Navbar (top)**
- ✅ Should show: User profile + Settings + Logout
- ❌ Should NOT show: Dashboard, Employees, Companies, Attendance

**Check Leaves Page**
- Navigate to `/leaves`
- ✅ Should show "Apply for Leave" button
- ✅ Should show "My Leaves" section
- ✅ Should show company auto-selected

### Step 9: Verify Route Protection
Try accessing admin pages:
- Visit http://localhost:3000/dashboard
  - ❌ Should redirect to /employee-dashboard
- Visit http://localhost:3000/employees
  - ❌ Should redirect to /employee-dashboard
- Visit http://localhost:3000/companies
  - ❌ Should redirect to /employee-dashboard

### Step 10: Test Settings Page
- Click Settings in sidebar
- Check Profile section
  - ✅ Should show: Name, Email, Role: "Employee"
- Check Notifications section
  - ✅ Should show ONLY: "Employee Alerts", "Attendance Alerts"
  - ❌ Should NOT show: "Leave Approvals", "Payroll", "Company Updates"

---

## ❌ Troubleshooting

### Issue: "Error: SUPABASE_SERVICE_ROLE_KEY not found"
**Solution:**
1. Check `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`
2. Restart dev server: `npm run dev`
3. Clear Next.js cache: `rm -rf .next`

### Issue: "Error: 401 Unauthorized"
**Solution:**
1. Verify Authorization header: `Bearer test-token`
2. Check it's a POST request (not GET)

### Issue: "Error: Employee role not found in the system"
**Solution:**
1. Check roles table: `SELECT * FROM roles WHERE name = 'Employee';`
2. If missing, run migration: `migrations/003_create_rbac_tables.sql`

### Issue: "Error: Failed to assign Employee role"
**Solution:**
1. Verify user_roles table schema:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'user_roles' 
   ORDER BY ordinal_position;
   ```
2. Should include: `id`, `user_id`, `role_id`, `company_id`

### Issue: Employee created but cannot login
**Solution:**
1. Verify user in Supabase Auth users list
2. Check email is marked as "confirmed"
3. Verify password is correct (copy from API response again)
4. Try browser incognito mode (clear cookies)

### Issue: Employee can access admin pages
**Solution:**
1. Verify Employee role is assigned in `user_roles`
2. Restart dev server
3. Clear browser cache
4. Check RouteGuard is properly protecting routes

---

## 📊 Success Checklist

- [ ] API endpoint returns 201 with temporaryPassword
- [ ] User record created in Supabase
- [ ] Employee record created in Supabase
- [ ] Employee role assigned in user_roles (verified via SQL)
- [ ] Employee can login with email + temporaryPassword
- [ ] Redirected to /employee-dashboard after login
- [ ] Sidebar shows only employee modules
- [ ] Navbar hides admin links
- [ ] Settings shows only Employee Alerts + Attendance Alerts
- [ ] Admin page redirects to /employee-dashboard
- [ ] Leaves page accessible and functional

---

## 📞 Getting Help

**If tests fail**, check:
1. Browser console (F12 → Console tab) for errors
2. Dev server console for error messages
3. Supabase logs: https://app.supabase.com/project/{PROJECT_ID}/logs/inspector
4. This guide's Troubleshooting section

**For detailed info**, see: `EMPLOYEE_CREATION_FIX.md`
