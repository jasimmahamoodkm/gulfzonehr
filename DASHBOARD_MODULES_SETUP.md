# Employee & Manager Dashboard Implementation

## Overview
Complete implementation of Employee Dashboard and Manager Dashboard with role-based module access control.

## ✅ Files Created

### 1. **Employee Dashboard** (`src/app/employee-dashboard/page.tsx`)
Personal dashboard for all employees showing:
- Leave balance
- Attendance records (last 7 days)
- Latest payslip
- Employee details (contact, DOB, joining date)
- Upcoming approved leaves
- Quick action links

### 2. **Manager Dashboard** (`src/app/manager-dashboard/page.tsx`)
Team management dashboard for managers showing:
- Team statistics (present, late, absent, on leave)
- Pending leave requests with approval/rejection actions
- Team attendance for today
- Team performance metrics (30-day attendance rate)

### 3. **Database Migration** (`migrations/010_add_dashboard_modules.sql`)
Adds the new dashboards as modules and assigns them to appropriate roles:
- Employee Dashboard → All roles
- Manager Dashboard → Department Manager, HR Manager, Company Admin, Super Admin

### 4. **Sidebar Updates** (`src/components/layout/Sidebar.tsx`)
- Added "My Dashboard" menu item (visible to all employees)
- Added "Team Dashboard" menu item (visible to managers and above)
- Implemented role-based filtering for menu visibility

## 🚀 Setup Instructions

### Step 1: Update Modules Table

Go to **Supabase SQL Editor** and run:

```sql
-- Insert employee dashboard module
INSERT INTO modules (name, description, icon, path, order_index, is_system)
VALUES ('Employee Dashboard', 'Personal dashboard with attendance, leave balance, and payroll information', 'LayoutDashboard', '/employee-dashboard', 0, true)
ON CONFLICT DO NOTHING;

-- Insert manager dashboard module
INSERT INTO modules (name, description, icon, path, order_index, is_system)
VALUES ('Manager Dashboard', 'Team management dashboard with attendance, leave approvals, and performance metrics', 'BarChart3', '/manager-dashboard', 0.5, true)
ON CONFLICT DO NOTHING;

-- Assign Employee Dashboard to all system roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE m.name = 'Employee Dashboard'
AND r.name IN ('Employee', 'Department Manager', 'HR Manager', 'Company Admin', 'Super Admin')
ON CONFLICT DO NOTHING;

-- Assign Manager Dashboard to manager and admin roles
INSERT INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE m.name = 'Manager Dashboard'
AND r.name IN ('Department Manager', 'HR Manager', 'Company Admin', 'Super Admin')
ON CONFLICT DO NOTHING;
```

### Step 2: Restart Development Server

```bash
npm run dev
```

## 📋 Testing Checklist

### Employee Dashboard Tests

1. **Login as Employee**
   - Navigate to sidebar
   - Click "My Dashboard" (should appear for all users)
   - ✅ Should display personal dashboard
   - ✅ Leave balance should show
   - ✅ Recent attendance records visible
   - ✅ Latest payslip displayed

2. **Test Data Display**
   - ✅ Employee details card shows correct info
   - ✅ Upcoming leaves section shows approved leaves only
   - ✅ Recent attendance shows last 7 days
   - ✅ Quick action links work (Request Leave, View Attendance, View Payslips)

3. **Test Empty States**
   - Create new employee with no leaves → "No upcoming approved leaves" message
   - Create employee with no attendance → "No attendance records" message

### Manager Dashboard Tests

1. **Login as Manager/HR Manager**
   - Navigate to sidebar
   - Click "Team Dashboard" (should NOT appear for regular employees)
   - ✅ Should display team management dashboard
   - ✅ Team statistics cards visible
   - ✅ Pending leave requests shown

2. **Test Leave Approval**
   - Employee submits leave request
   - Manager goes to Team Dashboard
   - ✅ Pending leave appears in "Pending Leave Requests"
   - ✅ Click "Approve" button
   - ✅ Leave status changes to "approved"
   - ✅ Pending request disappears from dashboard

3. **Test Leave Rejection**
   - Submit another leave request
   - Manager clicks "Reject" button
   - ✅ Leave status changes to "rejected"
   - ✅ Request disappears from pending list

4. **Test Team Statistics**
   - Multiple team members check in
   - Manager refreshes dashboard
   - ✅ "Present Today" count updates
   - ✅ "Late Today" count shows lateness
   - ✅ "Absent Today" reflects absent members
   - ✅ "On Leave" count shows approved leaves for today

5. **Test Team Performance**
   - Ensure attendance records exist for team members (last 30 days)
   - ✅ "Team Performance" section shows:
     - Employee names
     - Attendance rate percentage
     - Progress bars (green for 90+%, yellow for 70-89%, red for below 70%)
     - Days present / total days
   - ✅ Team sorted by attendance rate (highest first)

### Role-Based Access Tests

1. **Employee User**
   - ✅ "My Dashboard" visible
   - ✅ "Team Dashboard" NOT visible

2. **Manager/Department Manager**
   - ✅ "My Dashboard" visible
   - ✅ "Team Dashboard" visible

3. **HR Manager**
   - ✅ "My Dashboard" visible
   - ✅ "Team Dashboard" visible
   - ✅ Can approve/reject all team leaves

4. **Company Admin**
   - ✅ "My Dashboard" visible
   - ✅ "Team Dashboard" visible

5. **Super Admin**
   - ✅ "My Dashboard" visible
   - ✅ "Team Dashboard" visible

## 📊 Module Management via RBAC

The new dashboards are now integrated with the role management system:

### In RBAC Management → Roles Tab:

1. Select a role (e.g., "Employee")
2. You'll see the available modules including:
   - "Employee Dashboard" ✅ (checked for all roles)
   - "Manager Dashboard" ✅ (checked for manager roles)
3. Toggle these checkboxes to control module access
4. Notifications appear when modules are added/removed

### Example Scenarios:

- **Restrict Employee Dashboard**: Uncheck "Employee Dashboard" for "Employee" role
- **Give Employees Manager Dashboard**: Check "Manager Dashboard" for "Employee" role
- **Full Custom Access**: Select any combination of modules for any role

## 🔒 Security Features

1. **Row Level Security (RLS)**
   - Employees can only view their own records
   - Managers can only view their team's records
   - Admins can view all records

2. **Role-Based Sidebar**
   - Menu items dynamically filtered based on user roles
   - No menu items appear for roles without required access

3. **Database-Driven Access Control**
   - Module access controlled via role_modules table
   - Easy to modify without code changes

## 📝 Data Dependencies

**Employee Dashboard requires:**
- employees table (for employee details)
- employee_leave_balance table (for leave balance)
- leaves table (for upcoming leaves)
- attendance table (for recent attendance)
- payroll table (for latest payslip)

**Manager Dashboard requires:**
- leave_approvers table (to identify team members)
- employees table (for team member details)
- leaves table (for pending leave requests)
- attendance table (for today's attendance and performance)

## 🎯 Future Enhancements

1. **Employee Dashboard:**
   - Performance review section
   - Training/certification status
   - Goals and objectives
   - Documents/certificates upload

2. **Manager Dashboard:**
   - Team schedule overview
   - Performance review queue
   - Expense reports to approve
   - Team announcements
   - Weekly/monthly reports

3. **Both:**
   - Export to PDF functionality
   - Email notifications for pending actions
   - Mobile app compatibility
   - Real-time notifications

## 🔧 Troubleshooting

### Dashboard not appearing in sidebar
- Check: User has correct role assigned
- Check: User_roles table has the role
- Check: RBAC page shows role assigned to user

### Team Dashboard shows no team members
- Check: Leave_approvers table has entries for this manager
- Check: Active field is set to true for approver
- Check: Multiple employees should be assigned to test

### Leave approval not working
- Check: User has HR Manager or admin role
- Check: Leave status is "pending"
- Check: Browser console for error messages

### Empty dashboard sections
- Create test data if none exists
- Attendance records must exist for the last 30 days
- Leave balance must be set for employees

## 📞 Support
For issues, check the browser console (F12) for error messages and review the Supabase logs for database errors.
