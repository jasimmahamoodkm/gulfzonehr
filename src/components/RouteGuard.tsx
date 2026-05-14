'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';


interface RouteGuardProps {
  children: ReactNode;
  fallbackRoute?: string;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children, fallbackRoute = '/employee-dashboard' }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, loading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [checkingAuthorization, setCheckingAuthorization] = useState(true);

  // Check if user is an employee
  const isEmployee = user?.roles?.some(role => role.role_name === 'Employee');

  // Allowed routes for employees
  const allowedEmployeeRoutes = [
    '/',
    '/employee-dashboard',
    '/leaves',
    '/settings',
    '/login',
    '/logout',
    '/change-password-required',
  ];

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      console.log('🔐 Unauthenticated access, redirecting to login');
      router.push(`/login?redirect=${encodeURIComponent(fallbackRoute)}`);
      return;
    }

    if (!loading && isAuthenticated) {
      setCheckingAuthorization(true);

      // Check if user needs to change temporary password
      if (user?.is_temporary_password) {
        console.log('🔑 User has temporary password, redirecting to change password page');
        if (pathname !== '/change-password-required') {
          router.push('/change-password-required');
        }
        setCheckingAuthorization(false);
        return;
      }

      // Check authorization based on role
      const checkAuthorization = async () => {
        try {
          if (isEmployee) {
            // Employees can only access specific routes
            const isAllowedRoute = allowedEmployeeRoutes.some(route => {
              if (route === '/') {
                // Home page access - redirect to employee dashboard
                return pathname === route;
              }
              return pathname === route || pathname.startsWith(route + '/');
            });

            if (!isAllowedRoute) {
              console.log(`🚫 Employee trying to access unauthorized route: ${pathname}, redirecting to employee dashboard`);
              setIsAuthorized(false);
              router.push('/employee-dashboard');
              return;
            }

            // Redirect home page to employee dashboard
            if (pathname === '/') {
              router.push('/employee-dashboard');
              return;
            }
          } else {
            // Non-employees: redirect home to dashboard
            if (pathname === '/') {
              router.push('/dashboard');
              return;
            }
          }

          setIsAuthorized(true);
        } catch (err) {
          console.error('Error checking authorization:', err);
          setIsAuthorized(true); // Allow access on error
        } finally {
          setCheckingAuthorization(false);
        }
      };

      checkAuthorization();
    }
  }, [isAuthenticated, loading, user, pathname, router, isEmployee, fallbackRoute]);

  if (loading || checkingAuthorization) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return null;
  }

  return <>{children}</>;
};
