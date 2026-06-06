/**
 * Hook for checking route and feature permissions
 * Can be used in pages to verify access before rendering
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './useAuth';
import { useCompany } from '@/context/CompanyContext';
import {
  getRoutePermission,
  hasRouteAccess,
  isPublicRoute,
} from '@/config/routePermissions';

export interface UseRoutePermissionResult {
  isAuthorized: boolean;
  isLoading: boolean;
  hasPermission: boolean;
  userRoles: string[];
  missingRoles: string[];
  requiresCompany: boolean;
  hasSelectedCompany: boolean;
}

/**
 * Hook to check if user has permission to access current route
 */
export const useRoutePermission = (): UseRoutePermissionResult => {
  const pathname = usePathname();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { selectedCompany } = useCompany();

  const [isAuthorized, setIsAuthorized] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const userRoles = user?.roles?.map(role => role.role_name || role.role_id) || [];
  const hasSelectedCompany = !!selectedCompany?.id;

  useEffect(() => {
    setIsLoading(true);

    try {
      // Public routes are always accessible
      if (isPublicRoute(pathname)) {
        setIsAuthorized(true);
        setIsLoading(false);
        return;
      }

      // Private routes require authentication
      if (!isAuthenticated || !user) {
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      // Check route-specific permissions
      const routePermission = getRoutePermission(pathname);
      const hasAccess = hasRouteAccess(userRoles, routePermission, hasSelectedCompany);

      setIsAuthorized(hasAccess);
    } catch (error) {
      console.error('Error checking route permission:', error);
      setIsAuthorized(false);
    } finally {
      setIsLoading(false);
    }
  }, [pathname, isAuthenticated, user, userRoles, hasSelectedCompany]);

  // Get route requirement info
  const routePermission = getRoutePermission(pathname);
  const missingRoles = routePermission?.requiredRoles.filter(
    role => !userRoles.includes(role)
  ) || [];

  return {
    isAuthorized,
    isLoading: authLoading || isLoading,
    hasPermission: isAuthorized,
    userRoles,
    missingRoles,
    requiresCompany: routePermission?.requiresCompany || false,
    hasSelectedCompany,
  };
};

/**
 * Hook to check if user has permission for a specific resource/action
 * @param resource - The resource to check permission for
 * @param action - The action to check permission for (e.g., 'read', 'write', 'delete')
 */
export const usePermission = (_resource: string, _action: string): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  // Try to use the auth context's hasPermission method if available
  // This is a fallback - actual permission check should be done server-side
  const userRoles = user?.roles?.map(role => role.role_name || role.role_id) || [];

  // For now, allow Super Admin and Company Admin full access
  if (userRoles.includes('Super Admin') || userRoles.includes('Company Admin')) {
    return true;
  }

  // More specific permission checks can be added here
  // based on the resource and action
  return false;
};

/**
 * Hook to check if user can upload documents
 */
export const useCanUploadDocuments = (): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  const allowedRoles = [
    'Super Admin',
    'Company Admin',
    'HR Manager',
    'Manager',
  ];

  return user?.roles?.some(role =>
    allowedRoles.includes(role.role_name || role.role_id)
  ) || false;
};

/**
 * Hook to check if user can manage employees
 */
export const useCanManageEmployees = (): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  const allowedRoles = [
    'Super Admin',
    'Company Admin',
    'HR Manager',
    'Manager',
  ];

  return user?.roles?.some(role =>
    allowedRoles.includes(role.role_name || role.role_id)
  ) || false;
};

/**
 * Hook to check if user can manage payroll
 */
export const useCanManagePayroll = (): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  const allowedRoles = [
    'Super Admin',
    'Company Admin',
    'HR Manager',
  ];

  return user?.roles?.some(role =>
    allowedRoles.includes(role.role_name || role.role_id)
  ) || false;
};

/**
 * Hook to check if user can approve leaves
 */
export const useCanApproveLeaves = (): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  const allowedRoles = [
    'Super Admin',
    'Company Admin',
    'HR Manager',
    'Manager',
  ];

  return user?.roles?.some(role =>
    allowedRoles.includes(role.role_name || role.role_id)
  ) || false;
};

/**
 * Hook to check if user is admin (Super Admin, Company Admin, or HR Manager)
 */
export const useIsAdmin = (): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  const adminRoles = ['Super Admin', 'Company Admin', 'HR Manager'];

  return user?.roles?.some(role =>
    adminRoles.includes(role.role_name || role.role_id)
  ) || false;
};

/**
 * Hook to check if user is super admin
 */
export const useIsSuperAdmin = (): boolean => {
  const { user } = useAuth();

  if (!user) return false;

  return user?.roles?.some(role =>
    role.role_name === 'Super Admin' || role.role_id === 'super_admin'
  ) || false;
};
