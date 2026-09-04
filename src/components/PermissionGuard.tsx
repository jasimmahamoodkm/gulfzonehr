'use client';

/**
 * PermissionGuard Component
 * Wrapper component to guard routes/sections by permission
 */

import React, { useEffect, useState, useRef } from 'react';
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
  const onDeniedRef = useRef(onDenied);
  onDeniedRef.current = onDenied;

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (!user?.id || !user?.company_id) {
        if (!cancelled) {
          setHasPermission(false);
          setLoading(false);
        }
        onDeniedRef.current?.();
        return;
      }

      try {
        const result = await checkPermission(user.id, user.company_id, resource, action);
        if (cancelled) return;
        setHasPermission(result.allowed);
        if (!result.allowed) onDeniedRef.current?.();
      } catch (error) {
        console.error('Error checking permission:', error);
        if (cancelled) return;
        setHasPermission(false);
        onDeniedRef.current?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.company_id, resource, action]);

  if (loading) {
    return <div className="flex items-center justify-center p-4">Loading...</div>;
  }

  if (!hasPermission) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex items-center justify-center p-4 text-destructive">
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
