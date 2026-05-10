'use client';

/**
 * PermissionGuard Component
 * Wrapper component to guard routes/sections by permission
 */

import React, { useEffect, useState, useCallback } from 'react';
import { checkPermission } from '@/lib/rbac';
import { useAuth } from '@/hooks/useAuth';

interface PermissionGuardProps {
  children: React.ReactNode;
  resource: string;
  action: string;
  fallback?: React.ReactNode;
  onDenied?: () => void;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  resource,
  action,
  fallback,
  onDenied,
}) => {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAccess = useCallback(async () => {
    if (!user?.id || !user?.company_id) {
      setHasPermission(false);
      setLoading(false);
      onDenied?.();
      return;
    }

    try {
      const result = await checkPermission(user.id, user.company_id, resource, action);
      setHasPermission(result.allowed);

      if (!result.allowed) {
        onDenied?.();
      }
    } catch (error) {
      console.error('Error checking permission:', error);
      setHasPermission(false);
      onDenied?.();
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.company_id, resource, action, onDenied]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  if (loading) {
    return <div className="flex items-center justify-center p-4">Loading...</div>;
  }

  if (!hasPermission) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex items-center justify-center p-4 text-red-600">
        <p>You do not have permission to access this section.</p>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * PermissionBoundary - Higher order component version
 */
export function withPermissionGuard<P extends object>(
  Component: React.ComponentType<P>,
  resource: string,
  action: string,
  fallback?: React.ReactNode
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionGuard resource={resource} action={action} fallback={fallback}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
