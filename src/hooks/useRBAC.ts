'use client';

/**
 * useRBAC Hook
 * Provides RBAC functionality in React components
 */

import { useCallback, useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import { checkPermission, isAdmin, canAccessResource } from '@/lib/rbac';

export function useRBAC() {
  const context = useContext(AuthContext);
  const user = context?.user;

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback(
    async (resource: string, action: string): Promise<boolean> => {
      if (!user?.id || !user?.company_id) return false;

      const result = await checkPermission(user.id, user.company_id, resource, action);
      return result.allowed;
    },
    [user?.id, user?.company_id]
  );

  /**
   * Check if user has any of the provided permissions
   */
  const hasAnyPermission = useCallback(
    async (
      permissions: Array<{ resource: string; action: string }>
    ): Promise<boolean> => {
      if (!user?.id || !user?.company_id) return false;

      const results = await Promise.all(
        permissions.map(p =>
          checkPermission(user.id!, user.company_id!, p.resource, p.action)
        )
      );

      return results.some(r => r.allowed);
    },
    [user?.id, user?.company_id]
  );

  /**
   * Check if user has all of the provided permissions
   */
  const hasAllPermissions = useCallback(
    async (
      permissions: Array<{ resource: string; action: string }>
    ): Promise<boolean> => {
      if (!user?.id || !user?.company_id) return false;

      const results = await Promise.all(
        permissions.map(p =>
          checkPermission(user.id!, user.company_id!, p.resource, p.action)
        )
      );

      return results.every(r => r.allowed);
    },
    [user?.id, user?.company_id]
  );

  /**
   * Check if user can access a resource
   */
  const canAccess = useCallback(
    async (resource: string): Promise<boolean> => {
      if (!user?.id || !user?.company_id) return false;

      return canAccessResource(user.id, user.company_id, resource);
    },
    [user?.id, user?.company_id]
  );

  /**
   * Check if user is an admin
   */
  const isUserAdmin = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    return isAdmin(user.id, user?.company_id);
  }, [user?.id, user?.company_id]);

  /**
   * Check if user is a super admin (no company context)
   */
  const isSuperAdmin = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;

    return isAdmin(user.id);
  }, [user?.id]);

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccess,
    isUserAdmin,
    isSuperAdmin,
    user,
  };
}

/**
 * Hook to get pending leave approvals for a manager
 */
export function usePendingLeaveApprovals() {
  const context = useContext(AuthContext);
  const user = context?.user;

  const fetchPendingApprovals = useCallback(async () => {
    if (!user?.id || !user?.company_id) {
      return [];
    }

    try {
      const { data, error } = await fetch('/api/leaves/approvals/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approver_id: user.id,
          company_id: user.company_id,
        }),
      }).then(res => res.json());

      if (error) {
        console.error('Error fetching pending approvals:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      return [];
    }
  }, [user?.id, user?.company_id]);

  return {
    fetchPendingApprovals,
  };
}
