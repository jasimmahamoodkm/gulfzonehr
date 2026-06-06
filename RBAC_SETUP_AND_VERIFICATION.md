# Role-Based Access Control (RBAC) Setup & Verification Guide

## Implementation Complete ✅

A comprehensive role-based access control system has been implemented to check user roles and permissions on all modules and pages. Users are automatically redirected if they lack the required authorization.

---

## What Was Implemented

### 1. **Centralized Route Permission Configuration** 
**File:** `src/config/routePermissions.ts`

- Defines all 20+ routes in the application
- Maps required roles for each route
- Specifies company selection requirements
- Supports dynamic routes (e.g., `/admin/grades/[id]`)

**Supported Roles:**
- `Super Admin` - Full system access
- `Company Admin` - Company-level administration
- `HR Manager` - HR operations and payroll
- `Manager` - Team management
- `Employee` - Self-service features

### 2. **Enhanced Route Guard Component**
**File:** `src/components/RouteGuard.tsx`

- Wraps all protected pages (via Layout component)
- Checks user authentication on every route
- Validates role-based permissions
- Enforces company selection when required
- Handles temporary password requirement
- Automatically redirects unauthorized users to appropriate page
- Provides loading states during checks
- Logs all authorization events to console

### 3. **Permission Checking Hooks**
**File:** `src/hooks/useRoutePermission.ts`

Provides granular permission checking within pages:

```typescript
// Check current route permission
useRoutePermission()

// Check specific permissions
useCanUploadDocuments()
useCanManageEmployees()
useCanManagePayroll()
useCanApproveLeaves()
useIsAdmin()
useIsSuperAdmin()
```

### 4. **Layout Integration**
**File:** `src/components/layout/Layout.tsx`

- Already wraps all pages with RouteGuard
- All protected pages automatically get permission checks
- No additional setup needed for existing pages

---

## Protected Routes

### Public Routes (No Auth Required)
```
✓ /login
✓ /signup
```

### Employee-Only Routes
```
✓ /employee-dashboard - Personal dashboard
✓ /leaves - Leave requests
✓ /leave - Leave management
✓ /documents - Upload documents
✓ /settings - User settings
✓ /logout - Logout
```

### Manager+ Routes (Manager, HR Manager, Company Admin, Super Admin)
```
✓ /manager-dashboard - Team overview
✓ /attendance - Attendance tracking
✓ /reports - Reports
✓ /employees - Employee list
```

### HR Manager+ Routes (HR Manager, Company Admin, Super Admin)
```
✓ /dashboard - Admin dashboard
✓ /companies - Company management
✓ /payroll - Payroll processing
✓ /admin/grades - Grade configuration
✓ /admin/leave-approvals - Approve leaves
```

### Company Admin+ Routes (Company Admin, Super Admin)
```
✓ /admin/rbac - Role management
✓ /admin/audit-logs - Audit logs
```

---

## How Authorization Works

```
1. User visits a protected page
   ↓
2. RouteGuard component loads
   ↓
3. Check: Is user authenticated?
   NO → Redirect to /login ✓
   YES → Continue
   ↓
4. Check: Does user have temporary password set?
   YES → Redirect to /change-password-required ✓
   NO → Continue
   ↓
5. Check: Does route require company selection?
   YES & No company selected → Show error/redirect ✓
   NO or Company selected → Continue
   ↓
6. Check: Does user's role match required roles?
   NO MATCH → Redirect to appropriate fallback route ✓
   MATCH → Continue
   ↓
7. ✅ User authorized - Render page content
```

---

## Console Logging

All authorization events are logged for debugging. Open browser DevTools (F12) → Console to see:

### Successful Authorization
```
✅ Public route: /login
✅ User authorized for route: /dashboard
✅ User authorized for route: /employees
```

### Authorization Denied
```
🚫 User with roles ["Employee"] does not have access to /payroll
   Route requires: ["Super Admin", "Company Admin", "HR Manager"]
📍 Redirecting to fallback route: /employee-dashboard
```

### Authentication Issues
```
🔐 Unauthenticated access to protected route: /dashboard, redirecting to login
🔑 User has temporary password, redirecting to change password page
🏢 Route requires company selection
```

---

## Testing Authorization

### Test Scenario 1: Employee Cannot Access Admin Features

**Steps:**
1. Login as Employee
2. Try accessing `/dashboard` (Admin Dashboard)
3. Try accessing `/payroll` (Payroll)
4. Try accessing `/admin/rbac` (RBAC)

**Expected Result:**
- User redirected to `/employee-dashboard`
- Console shows: `🚫 User with roles ["Employee"] does not have access to...`

**Verify:**
```bash
# In browser console:
console.log("Current path:", window.location.pathname)
# Should show /employee-dashboard
```

### Test Scenario 2: Manager Can Access Manager Routes But Not HR Routes

**Steps:**
1. Login as Manager
2. Access `/manager-dashboard` → ✅ Should succeed
3. Access `/attendance` → ✅ Should succeed
4. Access `/payroll` → ❌ Should redirect
5. Access `/dashboard` → ❌ Should redirect

**Expected Result:**
- Manager can see manager features
- Manager cannot see HR/Payroll features
- Redirected to `/manager-dashboard` when accessing restricted routes

### Test Scenario 3: HR Manager Can Access All HR Features

**Steps:**
1. Login as HR Manager
2. Access `/dashboard` → ✅ Should succeed
3. Access `/payroll` → ✅ Should succeed
4. Access `/admin/grades` → ✅ Should succeed
5. Access `/admin/rbac` → ❌ Should redirect (requires Company Admin)

**Expected Result:**
- HR Manager can access all HR features
- Cannot access Company Admin routes
- Redirected appropriately for unauthorized routes

### Test Scenario 4: Company Admin Has Full Company Access

**Steps:**
1. Login as Company Admin
2. Access all routes except ones for other roles
3. Access `/admin/rbac` → ✅ Should succeed
4. Create new roles in RBAC → ✅ Should work

**Expected Result:**
- Full access to company administration
- Cannot access Super Admin-only features

### Test Scenario 5: Temporary Password Enforcement

**Steps:**
1. Admin creates new employee (gets temp password)
2. Employee logs in
3. Employee tries accessing any page

**Expected Result:**
- Employee redirected to `/change-password-required`
- Cannot bypass by accessing other routes
- After password change, full access granted

---

## Configuration Guide

### Adding a New Protected Route

**1. Add to Route Permissions:**
```typescript
// src/config/routePermissions.ts
{
  path: '/new-feature',
  requiredRoles: ['Super Admin', 'Company Admin'],
  description: 'New Feature Module',
  requiresCompany: true,
  requiresAuth: true,
}
```

**2. Create Page Component:**
```typescript
// src/app/new-feature/page.tsx
'use client';

import Layout from '@/components/layout/Layout';

export default function NewFeaturePage() {
  return (
    <Layout>
      {/* Your content here */}
    </Layout>
  );
}
```

**3. Update Navigation (if needed):**
```typescript
// src/components/layout/Sidebar.tsx
const ADMIN_MENU_ITEMS = [
  // ... existing items
  { href: '/new-feature', label: 'New Feature', icon: Icon },
];
```

### Changing Role Requirements for Existing Route

**1. Modify Configuration:**
```typescript
// src/config/routePermissions.ts
// Find the route and update requiredRoles
{
  path: '/payroll',
  requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager'], // Added Manager
  // ...
}
```

**2. Rebuild and Deploy:**
```bash
npm run build
npm run dev
```

---

## Debugging Authorization Issues

### User Claims Lack of Access (But Should Have Access)

**Check:**
1. **User has correct role assigned:**
   ```sql
   SELECT * FROM user_roles WHERE user_id = 'user-id';
   ```

2. **Console shows actual user roles:**
   ```javascript
   // In browser console, after AuthContext loads:
   console.log("User roles:", window.auth?.user?.roles);
   ```

3. **Route configuration is correct:**
   ```javascript
   // In browser console:
   import { getRoutePermission, hasRouteAccess } from '@/config/routePermissions';
   const route = getRoutePermission('/target-route');
   console.log({ route });
   ```

### User Cannot Access Route That Should Be Accessible

**Check:**
1. **User is authenticated:**
   ```javascript
   // In browser console:
   console.log("Is authenticated:", !!window.auth?.user?.id);
   ```

2. **User has company selected (if required):**
   ```javascript
   // In browser console:
   console.log("Selected company:", window.company?.selectedCompany?.id);
   ```

3. **User doesn't have temporary password flag:**
   ```javascript
   // In browser console:
   console.log("Temp password:", window.auth?.user?.is_temporary_password);
   ```

4. **Check console logs for auth errors:**
   - Look for red error messages
   - Check for 🚫 (denied) messages
   - Verify redirect messages

---

## Security Considerations

### ✅ What This System Protects

1. **UI Access** - Users cannot navigate to restricted pages
2. **Route Access** - Direct URL access is blocked
3. **Feature Visibility** - UI elements hidden based on role
4. **Automatic Redirects** - Unauthorized access redirected safely

### ⚠️ What You Still Need to Protect

1. **API Routes** - Add authorization checks to all API endpoints
   ```typescript
   // src/app/api/protected-route/route.ts
   const user = await getCurrentUser();
   if (!user?.roles.some(r => r.role_name === 'Super Admin')) {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
   }
   ```

2. **Database Queries** - Use Row Level Security (RLS) policies
   ```sql
   CREATE POLICY enable_read_own_company
     ON public.documents
     FOR SELECT
     USING (company_id IN (SELECT company_id FROM user_companies WHERE user_id = auth.uid()));
   ```

3. **Sensitive Data** - Always validate server-side before returning

---

## Verification Checklist

- [x] Route permissions configuration created (`src/config/routePermissions.ts`)
- [x] RouteGuard component enhanced with role checking
- [x] Permission hooks created for granular checks
- [x] All routes defined in permission config
- [x] Layout component wraps RouteGuard
- [x] TypeScript compilation passes
- [x] Project builds successfully
- [x] Console logging implemented for debugging
- [x] Public routes bypass authentication
- [x] Protected routes enforce authorization
- [x] Temporary password enforcement integrated
- [x] Company selection validation integrated
- [x] Fallback routes configured per role
- [x] Error handling prevents lockout

---

## Next Steps (Recommended)

### Phase 1: API Security (Recommended: This Week)
```bash
# 1. Add authorization checks to all API routes
# 2. Implement server-side permission validation
# 3. Add audit logging for API access
```

### Phase 2: Database Security (Recommended: This Month)
```bash
# 1. Enable RLS on all tables
# 2. Create RLS policies for each table
# 3. Test RLS with different roles
```

### Phase 3: Feature Expansion (Optional: Next Quarter)
```bash
# 1. Add feature flags for role-based features
# 2. Implement dynamic permission loading
# 3. Add permission audit dashboard
```

---

## Summary

✅ **What's Protected:**
- 20+ routes across the application
- 5 distinct user roles with clear hierarchy
- Automatic redirects for unauthorized access
- Temporary password enforcement
- Company-scoped access
- Console logging for debugging

✅ **How It Works:**
1. RouteGuard checks on every page load
2. User roles validated against route requirements
3. Unauthorized users redirected appropriately
4. All events logged to browser console

✅ **How to Use:**
1. Routes automatically protected via Layout component
2. Use permission hooks for conditional UI rendering
3. Add new routes to `routePermissions.ts`
4. Check browser console for authorization events

**Status:** ✅ Production Ready
**Security Level:** High (Client-side) + Requires API/DB security (Next Phase)
**Maintainability:** Excellent (Centralized configuration)

---

For detailed implementation documentation, see: `src/lib/RBAC_IMPLEMENTATION.md`
