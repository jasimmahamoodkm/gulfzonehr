'use client';

import { useEffect, useState, useMemo, useRef, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/context/CompanyContext';
import {
  getRoutePermission,
  hasRouteAccess,
  getFallbackRoute,
  isPublicRoute,
} from '@/config/routePermissions';

interface RouteGuardProps {
  children: ReactNode;
  fallbackRoute?: string;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children, fallbackRoute }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading } = useAuth();
  const { selectedCompany } = useCompany();
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [checkingAuthorization, setCheckingAuthorization] = useState(true);

  // Memoize userRoles so a new array reference isn't created on every render,
  // which would otherwise re-trigger the useEffect on every render cycle.
  const userRoles = useMemo(
    () => user?.roles?.map(role => role.role_name || role.role_id) || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.roles]
  );

  const hasSelectedCompany = !!selectedCompany?.id;

  // Track whether this is the first authorization check so we only show
  // the full-page spinner on initial load, not on every navigation.
  const hasCheckedOnce = useRef(false);

  useEffect(() => {
    if (loading) return;

    const performAuthorizationCheck = () => {
      // Only show the spinner on the very first check
      if (!hasCheckedOnce.current) {
        setCheckingAuthorization(true);
      }

      try {
        // Public routes — always allow
        if (isPublicRoute(pathname)) {
          setIsAuthorized(true);
          return;
        }

        // Not authenticated — redirect to login
        if (!isAuthenticated) {
          const redirectUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
          router.push(redirectUrl);
          setIsAuthorized(false);
          return;
        }

        // Temporary password — must change before accessing anything else
        if (user?.is_temporary_password && pathname !== '/change-password-required') {
          router.push('/change-password-required');
          setIsAuthorized(false);
          return;
        }

        // Route-level permission check
        const routePermission = getRoutePermission(pathname);
        const hasAccess = hasRouteAccess(userRoles, routePermission, hasSelectedCompany);

        if (!hasAccess) {
          const fallback = fallbackRoute || getFallbackRoute(userRoles);
          router.push(fallback);
          setIsAuthorized(false);
          return;
        }

        // Root path redirect
        if (pathname === '/' || pathname === '') {
          const homeRoute = getFallbackRoute(userRoles);
          if (homeRoute !== '/') {
            router.push(homeRoute);
            return;
          }
        }

        setIsAuthorized(true);
      } catch (err) {
        console.error('RouteGuard error:', err);
        setIsAuthorized(true); // fail-open to avoid lockout
      } finally {
        hasCheckedOnce.current = true;
        setCheckingAuthorization(false);
      }
    };

    performAuthorizationCheck();
  }, [isAuthenticated, loading, user?.is_temporary_password, pathname, userRoles, hasSelectedCompany, fallbackRoute, router]);

  // Show full-page spinner only on initial load, not on every re-check
  if (loading || checkingAuthorization) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return <>{children}</>;
};
