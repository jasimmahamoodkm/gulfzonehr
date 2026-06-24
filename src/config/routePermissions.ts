/**
 * Route Permissions Configuration
 * Defines which roles can access which routes/modules
 *
 * Role Hierarchy (from highest to lowest privilege):
 * 1. Super Admin - Full system access
 * 2. Company Admin - Company-level admin access
 * 3. HR Manager - HR functions for company
 * 4. Manager - Team and reporting access
 * 5. Employee - Self-service access only
 */

export type UserRole = 'Super Admin' | 'Company Admin' | 'HR Manager' | 'Manager' | 'Employee';

export interface RoutePermission {
  path: string;
  requiredRoles: UserRole[];
  description: string;
  requiresCompany?: boolean; // Whether user must have selected company
  requiresAuth?: boolean; // Whether user must be authenticated
}

/**
 * Route permissions mapping
 * Order matters: more specific paths should come before general ones
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Public routes (no authentication required)
  {
    path: '/login',
    requiredRoles: [], // Anyone can access
    description: 'Login page',
    requiresAuth: false,
  },
  {
    path: '/signup',
    requiredRoles: [], // Anyone can access
    description: 'Sign up page',
    requiresAuth: false,
  },
  {
    path: '/logout',
    requiredRoles: [], // No role required — user is being signed out mid-request
    description: 'Logout',
    requiresAuth: false,
  },

  // Password change (required for all authenticated users)
  {
    path: '/change-password-required',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager', 'Employee'],
    description: 'Force password change',
    requiresAuth: true,
  },

  // Employee Dashboard (accessible to all roles)
  {
    path: '/employee-dashboard',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager', 'Employee'],
    description: 'Employee Dashboard',
    requiresAuth: true,
  },

  // Manager Dashboard
  {
    path: '/manager-dashboard',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager'],
    description: 'Manager Dashboard - Team overview',
    requiresAuth: true,
    requiresCompany: true,
  },

  // Super Admin Dashboard
  {
    path: '/dashboard',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager'],
    description: 'Admin Dashboard',
    requiresAuth: true,
    requiresCompany: true,
  },

  // Attendance Management
  {
    path: '/attendance',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager', 'Employee'],
    description: 'Attendance Management',
    requiresAuth: true,
    requiresCompany: false, // Employees can view their own attendance without company selection
  },

  // Leave Management
  {
    path: '/leave',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager', 'Employee'],
    description: 'Leave Management',
    requiresAuth: true,
    requiresCompany: false, // Employees can view their own leaves without company selection
  },
  {
    path: '/leaves',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager', 'Employee'],
    description: 'Leave Requests',
    requiresAuth: true,
  },

  // Employee Management
  {
    path: '/employees',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager'],
    description: 'Employee Management',
    requiresAuth: true,
    requiresCompany: true,
  },
  {
    path: '/employees/[id]',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager'],
    description: 'Employee Details',
    requiresAuth: true,
    requiresCompany: true,
  },

  // Company Management
  {
    path: '/companies',
    requiredRoles: ['Super Admin', 'Company Admin'],
    description: 'Company Management',
    requiresAuth: true,
    requiresCompany: true,
  },

  // Document Management
  {
    path: '/documents',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager', 'Employee'],
    description: 'Document Management',
    requiresAuth: true,
    requiresCompany: false, // Employees can view their own documents without company selection
  },

  // Payroll Management
  {
    path: '/payroll',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager', 'Employee'],
    description: 'Payroll Processing',
    requiresAuth: true,
    requiresCompany: false, // Employees can view their own payroll without company selection
  },

  // Reports
  {
    path: '/reports',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager'],
    description: 'Reports & Analytics',
    requiresAuth: true,
    requiresCompany: true,
  },

  // Settings
  {
    path: '/settings',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager', 'Manager', 'Employee'],
    description: 'User Settings',
    requiresAuth: true,
  },

  // Admin Routes - RBAC Management
  {
    path: '/admin/rbac',
    requiredRoles: ['Super Admin', 'Company Admin'],
    description: 'Role-Based Access Control',
    requiresAuth: true,
    requiresCompany: true,
  },

  // Admin Routes - Grade Configuration
  {
    path: '/admin/grades',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager'],
    description: 'Grade Configuration',
    requiresAuth: true,
    requiresCompany: true,
  },
  {
    path: '/admin/grades/[id]',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager'],
    description: 'Grade Details',
    requiresAuth: true,
    requiresCompany: true,
  },

  // Admin Routes - Leave Approvals
  {
    path: '/admin/leave-approvals',
    requiredRoles: ['Super Admin', 'Company Admin', 'HR Manager'],
    description: 'Leave Approval Workflow',
    requiresAuth: true,
    requiresCompany: true,
  },

  // Admin Routes - Audit Logs
  {
    path: '/admin/audit-logs',
    requiredRoles: ['Super Admin', 'Company Admin'],
    description: 'Audit Logs',
    requiresAuth: true,
    requiresCompany: true,
  },
];

/**
 * Get the permissions for a specific route
 */
export const getRoutePermission = (pathname: string): RoutePermission | null => {
  // Normalize pathname (remove trailing slashes and query params)
  const normalizedPath = pathname.split('?')[0].replace(/\/$/, '');

  // Try exact match first
  let permission = ROUTE_PERMISSIONS.find(p => p.path === normalizedPath);

  // Try prefix match for dynamic routes (e.g., /admin/grades/123 matches /admin/grades/[id])
  if (!permission) {
    for (const p of ROUTE_PERMISSIONS) {
      // Replace [id] pattern with regex
      const pattern = p.path.replace(/\[.*?\]/g, '[^/]+');
      const regex = new RegExp(`^${pattern}(/.*)?$`);
      if (regex.test(normalizedPath)) {
        permission = p;
        break;
      }
    }
  }

  return permission || null;
};

/**
 * Check if a user has access to a route
 */
export const hasRouteAccess = (
  userRoles: string[],
  routePermission: RoutePermission | null,
  hasSelectedCompany: boolean = false
): boolean => {
  if (!routePermission) {
    // If route not in config, deny access by default (fail-secure)
    console.warn('Route not found in permissions config');
    return false;
  }

  // Check if route requires authentication
  if (routePermission.requiresAuth && userRoles.length === 0) {
    console.warn('Route requires authentication');
    return false;
  }

  // Check if route requires company selection
  if (routePermission.requiresCompany && !hasSelectedCompany) {
    console.warn('Route requires company selection');
    return false;
  }

  // Public routes with no required roles
  if (routePermission.requiredRoles.length === 0) {
    return true;
  }

  // Check if user has any of the required roles
  const hasRequiredRole = userRoles.some(role =>
    routePermission.requiredRoles.includes(role as UserRole)
  );

  if (!hasRequiredRole) {
    console.warn(`🚫 User roles ${userRoles} do not match required roles ${routePermission.requiredRoles} for route ${routePermission.path}`);
  }

  return hasRequiredRole;
};

/**
 * Get the fallback route based on user roles
 * (where to redirect if access is denied)
 */
export const getFallbackRoute = (userRoles: string[]): string => {
  if (userRoles.length === 0) {
    return '/login';
  }

  // Route based on highest privilege role
  if (userRoles.includes('Super Admin')) {
    return '/dashboard';
  }

  if (userRoles.includes('Company Admin') || userRoles.includes('HR Manager')) {
    return '/dashboard';
  }

  if (userRoles.includes('Manager')) {
    return '/manager-dashboard';
  }

  // Default for Employee
  return '/employee-dashboard';
};

/**
 * Get all accessible routes for a user
 */
export const getAccessibleRoutes = (userRoles: string[], hasSelectedCompany: boolean = false): string[] => {
  return ROUTE_PERMISSIONS
    .filter(permission => hasRouteAccess(userRoles, permission, hasSelectedCompany))
    .map(permission => permission.path);
};

/**
 * Check if a route is considered protected (requires authentication)
 */
export const isProtectedRoute = (pathname: string): boolean => {
  const permission = getRoutePermission(pathname);
  return permission?.requiresAuth ?? true; // Default to protected
};

/**
 * Check if a route is public (no authentication required)
 */
export const isPublicRoute = (pathname: string): boolean => {
  return !isProtectedRoute(pathname);
};
