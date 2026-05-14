# Phase 1 RBAC & Dashboard Testing Checklist

## Pre-Testing Setup

### Step 1: Apply the Dashboard Modules Migration
Before testing, you need to apply the migration to add the dashboard modules and assign them to roles.

**In Supabase SQL Editor, run:**
```sql
-- Copy the entire contents of migrations/010_add_dashboard_modules.sql
-- And execute it in Supabase SQL Editor
```

**What this does:**
- Adds "Employee Dashboard" module → assigned to all roles
- Adds "Manager Dashboard" module → assigned to Department Manager, HR Manager, Company Admin, Super Admin
- Enables proper role-based dashboard filtering

### Step 2: Restart the Development Server
```bash
npm run dev
```

---

## Test Scenarios

### Scenario 1: Employee Login with Company Selection

**Prerequisites:**
- You have an employee account in the database
- Employee has no company_id set (or company_id is NULL)
- At least one company exists in the companies table

**Test Steps:**
1. Navigate to `http://localhost:3000/login`
2. Enter employee email and password
3. ✅ **Expected**: Login succeeds, you see "Select Your Company" screen with list of companies
4. ✅ **Expected**: Company list shows company names with hover effects
5. Click on a company
6. ✅ **Expected**: Screen shows "Company selected: [company_id]" message
7. ✅ **Expected**: Redirected to `/employee-dashboard`
8. ✅ **Expected**: Employee dashboard loads with personal data (leaves, attendance, payroll)

**Verify:**
- [ ] Company selection screen appears for employee without company_id
- [ ] Companies are fetched from database correctly
- [ ] Clicking a company updates user.company_id in database
- [ ] CompanyContext shows selected company name in sidebar
- [ ] Employee dashboard displays

---

### Scenario 2: Employee Login with Existing Company

**Prerequisites:**
- You have an employee account with company_id already set
- You're logged out of the application

**Test Steps:**
1. Log out if logged in
2. Navigate to `http://localhost:3000/login`
3. Enter employee email and password
4. ✅ **Expected**: No company selection screen appears
5. ✅ **Expected**: Automatically redirected to `/employee-dashboard`
6. ✅ **Expected**: Dashboard loads correctly

**Verify:**
- [ ] No company selection screen for employee with company_id
- [ ] Direct redirect to employee-dashboard works
- [ ] Dashboard shows correct employee data

---

### Scenario 3: Manager Login Redirect

**Prerequisites:**
- You have a Department Manager, HR Manager, or Company Admin account
- You're logged out

**Test Steps:**
1. Navigate to `http://localhost:3000/login`
2. Enter manager email and password
3. ✅ **Expected**: No company selection screen (managers might have company_id or can skip it)
4. ✅ **Expected**: Redirected to `/dashboard` (not employee-dashboard)
5. ✅ **Expected**: Main dashboard loads with analytics

**Verify:**
- [ ] Manager users redirect to /dashboard not /employee-dashboard
- [ ] Main dashboard loads for managers
- [ ] Manager sees "Team Dashboard" option in sidebar (if permission assigned)

---

### Scenario 4: Module Filtering in Sidebar - Employee Role

**Prerequisites:**
- Logged in as employee
- Migration applied (modules assigned to roles)

**Test Steps:**
1. Open sidebar (click menu on mobile or view on desktop)
2. Check "My Dashboard" menu item
3. ✅ **Expected**: "My Dashboard" appears for employee
4. Check "Team Dashboard" menu item
5. ✅ **Expected**: "Team Dashboard" is hidden for employee role
6. Scroll through sidebar
7. ✅ **Expected**: Only modules in role_modules table for Employee role appear
8. ✅ **Expected**: Admin modules (RBAC, Audit Logs, Leave Approvals) are hidden

**Verify:**
- [ ] Employee sees "My Dashboard" option
- [ ] Employee does NOT see "Team Dashboard" option
- [ ] Employee does NOT see admin modules
- [ ] Sidebar correctly reflects assigned modules

---

### Scenario 5: Module Filtering in Sidebar - Manager Role

**Prerequisites:**
- Logged in as Department Manager (or HR Manager)
- Migration applied

**Test Steps:**
1. Open sidebar
2. Check "My Dashboard"
3. ✅ **Expected**: "My Dashboard" appears
4. Check "Team Dashboard"
5. ✅ **Expected**: "Team Dashboard" appears for manager
6. Check Admin section
7. ✅ **Expected**: Admin modules might appear (if role has module assignments)

**Verify:**
- [ ] Manager sees both "My Dashboard" and "Team Dashboard"
- [ ] Admin section visible if manager has admin modules
- [ ] Sidebar correctly reflects manager modules

---

### Scenario 6: Unauthorized Module Access - Redirect Protection

**Prerequisites:**
- Logged in as employee
- You know employee doesn't have access to /manager-dashboard

**Test Steps:**
1. Directly navigate to `http://localhost:3000/manager-dashboard`
2. ✅ **Expected**: Redirected to employee-dashboard (fallback route)
   - OR show loading state and then redirect
3. Check browser console for logs like "🔐 Unauthenticated access, redirecting to login"

**Verify:**
- [ ] Accessing unauthorized module redirects
- [ ] Redirect goes to appropriate fallback route
- [ ] No errors in console

---

### Scenario 7: Unauthenticated Access - Protected Routes

**Prerequisites:**
- You're logged out
- Clear localStorage if needed

**Test Steps:**
1. Directly navigate to `http://localhost:3000/dashboard`
2. ✅ **Expected**: Redirected to `/login?redirect=%2Fdashboard`
3. Directly navigate to `http://localhost:3000/employees`
4. ✅ **Expected**: Redirected to `/login?redirect=%2Femployees`
5. Directly navigate to `http://localhost:3000/employee-dashboard`
6. ✅ **Expected**: Redirected to `/login?redirect=%2Femployee-dashboard`

**Verify:**
- [ ] All protected routes redirect to login
- [ ] Redirect parameter is set correctly
- [ ] RouteGuard works as expected

---

### Scenario 8: Admin RBAC Module Assignment

**Prerequisites:**
- Logged in as Super Admin or Company Admin
- Migration has been applied

**Test Steps:**
1. Navigate to `/admin/rbac`
2. Go to "Roles" tab
3. Click on "Employee" role
4. ✅ **Expected**: Right side shows "Module count: X"
5. ✅ **Expected**: "Employee Dashboard" checkbox is checked
6. ✅ **Expected**: "Manager Dashboard" checkbox is unchecked
7. Try to check "Manager Dashboard"
8. ✅ **Expected**: Notification appears "Module added successfully"
9. ✅ **Expected**: Module count updates
10. Uncheck "Manager Dashboard"
11. ✅ **Expected**: Notification appears "Module removed successfully"

**Verify:**
- [ ] Admin can view role modules
- [ ] Checkboxes toggle correctly
- [ ] Notifications appear for changes
- [ ] Module assignments persist after page refresh

---

### Scenario 9: Employee Dashboard Content

**Prerequisites:**
- Logged in as employee who has completed company selection
- Employee has some attendance, leave, and payroll data

**Test Steps:**
1. Ensure you're on `/employee-dashboard`
2. Check "My Statistics" section
3. ✅ **Expected**: Shows Leave Balance, Attendance Rate, Last Check-in, Current Month Salary
4. Check "Upcoming Approved Leaves"
5. ✅ **Expected**: Shows leaves for next 30 days (if any exist)
6. Check "Recent Attendance"
7. ✅ **Expected**: Shows last 7 days of attendance with status
8. Check "My Details"
9. ✅ **Expected**: Shows employee info (position, contact, DOB, joining date)
10. Check "Quick Actions"
11. ✅ **Expected**: Shows links for Request Leave, View Attendance, View Payslips

**Verify:**
- [ ] Dashboard loads without errors
- [ ] All data sections display
- [ ] Data is pulled from correct database tables
- [ ] No console errors

---

### Scenario 10: Manager Dashboard Content

**Prerequisites:**
- Logged in as Department Manager or HR Manager
- You have team members assigned via leave_approvers table
- Team members have attendance and leave data

**Test Steps:**
1. Ensure you're on `/manager-dashboard`
2. Check "Team Statistics" cards
3. ✅ **Expected**: Shows Team Members, Present Today, Late Today, Absent, On Leave counts
4. Check "Pending Leave Requests"
5. ✅ **Expected**: Shows pending leaves from team with Approve/Reject buttons
6. Click "Approve" on a pending leave
7. ✅ **Expected**: Success notification appears
8. ✅ **Expected**: Leave status updates to "approved"
9. ✅ **Expected**: Request disappears from pending list
10. Check "Team Attendance Today"
11. ✅ **Expected**: Shows team member check-in status for today
12. Check "Team Performance"
13. ✅ **Expected**: Shows attendance rate % for each team member (last 30 days)

**Verify:**
- [ ] Dashboard loads without errors
- [ ] All cards show correct data
- [ ] Approve/Reject buttons work
- [ ] Leave status updates properly
- [ ] Team data is filtered to manager's team only

---

## Integration Tests

### Test A: Complete Employee Flow

1. Create/Use an employee account with no company_id
2. Navigate to login
3. Enter credentials → Company selection appears ✅
4. Select a company → Redirected to employee-dashboard ✅
5. Verify sidebar shows only "My Dashboard" not "Team Dashboard" ✅
6. Try to navigate directly to /manager-dashboard → Redirected ✅
7. Log out and log back in → No company selection (company_id exists) ✅

**Result:** ✅ Pass / ❌ Fail

---

### Test B: Complete Manager Flow

1. Use a manager account
2. Navigate to login
3. Enter credentials → Redirected directly to /dashboard (no company selection) ✅
4. Verify sidebar shows both "My Dashboard" and "Team Dashboard" ✅
5. Open Team Dashboard → Loads team data ✅
6. Approve a leave request → Updates database ✅
7. Log out ✅

**Result:** ✅ Pass / ❌ Fail

---

### Test C: Permission Changes Take Effect

1. Logged in as Super Admin
2. Go to /admin/rbac → Roles tab
3. Select "Employee" role
4. Uncheck "Employee Dashboard" ✅
5. Notification shows success ✅
6. Refresh page → Still unchecked ✅
7. Go to /admin/rbac → Users tab
8. Assign a test employee to "Employee" role
9. Log out
10. Log in as that employee
11. Verify /employee-dashboard is not accessible ✅

**Result:** ✅ Pass / ❌ Fail

---

## Console Logs to Verify

As you test, check the browser console (F12) for these logs:

**Login Page:**
- ✅ "✅ Company selected: [company_id]"
- ✅ "✅ Companies loaded: [array of companies]"
- ✅ "👥 Employee without company, showing company selection"

**Sidebar:**
- ✅ "📋 Loading allowed modules for roleIds: [array]"
- ✅ "✅ Allowed module paths: [array of paths]"
- ✅ "🚫 Module not allowed: [path]" (for modules user doesn't have access to)

**RouteGuard:**
- ✅ "🔐 Unauthenticated access, redirecting to login" (when not logged in)

**Manager Dashboard:**
- ✅ Leave approvals are logged when you approve/reject

---

## Known Issues to Watch For

1. **Module filtering not working**: Check browser console for errors in Sidebar.tsx
2. **Company selection not appearing**: Verify employee.company_id is NULL in database
3. **Redirect loops**: Check that user roles are properly set in database
4. **Data not loading**: Verify employee/manager has team members (for manager dashboard)
5. **Sidebar modules still showing**: Refresh page or clear browser cache

---

## Summary

**✅ All Tests Pass**: System is ready for production
**⚠️ Some Tests Fail**: Check console logs and fix issues
**❌ Critical Tests Fail**: Review implementation and database setup

---

## Next Steps After Testing

1. Fix any failing tests
2. Verify all database data is consistent
3. Test performance with larger datasets
4. Create demo accounts for stakeholders
5. Document any custom configurations
