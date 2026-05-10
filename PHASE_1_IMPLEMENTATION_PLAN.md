# GulfZone HR - Phase 1 Implementation Plan

**Status**: 🚀 In Progress  
**Date**: May 2026  
**Phase**: 1 of 4 (Enterprise Features)  

---

## Overview

Phase 1 focuses on implementing the foundational enterprise features:
1. **Role-Based Access Control (RBAC)**
2. **Comprehensive Audit Logging & Monitoring**
3. **Leave Approval Workflow**

These are prerequisites for all subsequent phases.

---

## Deliverables Completed ✅

### Database Migrations
- ✅ `migrations/003_create_rbac_tables.sql`
  - Roles table with system roles (Super Admin, Company Admin, HR Manager, Department Manager, Employee)
  - Role Permissions junction table
  - User Roles mapping table
  - Default role and permission initialization

- ✅ `migrations/004_create_audit_logging.sql`
  - Audit logs table with comprehensive tracking
  - Activity logs table for simplified tracking
  - Audit log policies for data retention
  - Helper functions: `log_audit_event()`, `log_activity_event()`, `cleanup_old_audit_logs()`
  - Audit log search view

- ✅ `migrations/005_enhance_leaves_for_approvals.sql`
  - Enhanced leaves table with approval workflow fields
  - Leave types configuration table
  - Employee leave balance tracking
  - Leave approvers mapping
  - Helper functions: `get_pending_leave_approvals()`, `approve_leave()`, `reject_leave()`, `initialize_employee_leave_balance()`
  - Leave dashboard view

### TypeScript Types
- ✅ `src/types/rbac.ts` - RBAC types (Role, Permission, UserRole, PermissionContext)
- ✅ `src/types/audit.ts` - Audit types (AuditLog, ActivityLog, ComplianceReport)
- ✅ `src/types/leaves.ts` - Leave management types (Leave, EmployeeLeaveBalance, CompOffRequest)

---

## Next Steps (Phase 1 Implementation)

### 1. Apply Database Migrations
```bash
# Connect to Supabase and run migrations in order:
1. migrations/003_create_rbac_tables.sql
2. migrations/004_create_audit_logging.sql
3. migrations/005_enhance_leaves_for_approvals.sql
```

### 2. Create RBAC Library & Utilities
**File**: `src/lib/rbac.ts`
- `checkPermission()` - Check if user has permission
- `getUserPermissions()` - Get all permissions for user
- `getUserRoles()` - Get all roles for user
- `assignRole()` - Assign role to user

### 3. Create React Hooks
**File**: `src/hooks/useRBAC.ts`
- `usePermission()` - Check permission in components
- `useUserRoles()` - Get current user's roles

**File**: `src/hooks/useLeaveApprovals.ts`
- `usePendingApprovals()` - Get pending approvals for manager
- `useApproveLeave()` - Approve leave mutation

### 4. Create Protected Components
**File**: `src/components/PermissionGuard.tsx`
- Wrapper component to guard routes by permission
- Support granular control (resource + action)

### 5. Create Admin Dashboards
**File**: `src/app/admin/rbac/page.tsx` - Role management
**File**: `src/app/admin/audit-logs/page.tsx` - Audit log viewer
**File**: `src/app/admin/leave-approvals/page.tsx` - Leave approval queue

### 6. Update AuthContext
**File**: `src/context/AuthContext.tsx`
- Load user roles and permissions on login
- Provide `hasPermission()` method

### 7. Create API Routes
- `src/app/api/rbac/check-permission/route.ts`
- `src/app/api/leaves/approve/route.ts`
- `src/app/api/leaves/reject/route.ts`
- `src/app/api/audit/logs/route.ts`

---

## Database Schema Summary

### New Tables
1. **roles** - System and custom roles
2. **role_permissions** - Permission grants
3. **user_roles** - User to role mapping
4. **audit_logs** - Audit trail
5. **activity_logs** - Activity tracking
6. **audit_log_policies** - Retention policies
7. **leave_types** - Leave type configuration
8. **employee_leave_balance** - Leave balance tracking
9. **leave_approvers** - Manager to employee mapping

---

## Success Criteria

✅ All migrations run successfully  
✅ Default roles and permissions created  
✅ Users can be assigned roles  
✅ Permissions enforced on routes  
✅ Leave approval workflow functional  
✅ Audit logs capture operations  
✅ Admin dashboards working  
✅ No broken routes  
✅ TypeScript compilation passes  

---

## Timeline Estimate

- **Database Setup**: 30 minutes
- **RBAC Library & Hooks**: 2-3 hours
- **API Routes**: 2 hours
- **Components & UI**: 3-4 hours
- **Admin Dashboards**: 2-3 hours
- **Testing & Integration**: 2-3 hours
- **Total**: 12-16 hours (2-3 days)

---

## Notes

- Phase 1 foundation for all later phases
- Can be implemented independently
- No breaking changes to existing code
- Backward compatible with current auth
- RLS policies optional for Phase 1
- Can extend roles with custom roles per company
