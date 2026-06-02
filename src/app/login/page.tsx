'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/context/CompanyContext';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, loading, user, userCompanies, selectedCompanyId } = useAuth();
  const { setSelectedCompany, companies } = useCompany();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (selectedCompanyId && userCompanies.length > 0) {
        // Set selected company in context using full Company object
        const fullCompany = companies.find(c => c.id === selectedCompanyId);
        if (fullCompany) {
          setSelectedCompany(fullCompany);
        }
      }

      // Check if user has temporary password
      if (user?.is_temporary_password) {
        console.log('🔑 User has temporary password, redirecting to change password page');
        router.push('/change-password-required');
        return;
      }

      // Determine where to redirect
      const isEmployee = user?.roles?.some(r => r.role_name === 'Employee');
      if (isEmployee) {
        router.push('/employee-dashboard');
      } else {
        const redirect = searchParams.get('redirect') || '/dashboard';
        router.push(redirect);
      }
    }
  }, [isAuthenticated, loading, user, selectedCompanyId, userCompanies, router, searchParams, setSelectedCompany]);

  // Show company selection if user has multiple companies
  const showCompanySelection = !loading && isAuthenticated && user && userCompanies.length > 1;

  const handleCompanySelect = async (companyId: string) => {
    try {
      // Update selected company in context using full Company object
      const fullCompany = companies.find(c => c.id === companyId);
      if (fullCompany) {
        setSelectedCompany(fullCompany);
        console.log('✅ Company selected:', companyId, fullCompany.name);
      }

      // Check if user has temporary password
      if (user?.is_temporary_password) {
        console.log('🔑 User has temporary password, redirecting to change password page');
        router.push('/change-password-required');
        return;
      }

      // Redirect based on user role
      const isEmployee = user?.roles?.some(r => r.role_name === 'Employee');
      if (isEmployee) {
        router.push('/employee-dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('❌ Error selecting company:', err);
      setErrorMessage('Failed to select company. Please try again.');
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await login(data);
      // Redirect will happen via useEffect after login
    } catch (error) {
      const err = error as any;
      setErrorMessage(err.message || 'Login failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show company selection for users with multiple companies
  if (showCompanySelection && userCompanies.length > 1) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Your Company</h1>
          <p className="text-gray-600">You have access to multiple companies</p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{errorMessage}</p>
          </div>
        )}

        <div className="space-y-3">
          {userCompanies.map((company) => (
            <button
              key={company.company_id}
              onClick={() => handleCompanySelect(company.company_id)}
              className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                company.is_primary
                  ? 'border-blue-500 bg-blue-50 hover:border-blue-600'
                  : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{company.company_name}</p>
                  {company.is_primary && (
                    <p className="text-xs text-blue-600 font-medium">Primary Company</p>
                  )}
                </div>
                <div className={`w-5 h-5 rounded-full border-2 ${
                  company.is_primary ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                }`}></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
        <p className="text-gray-600">Sign in to your GulfZone HR account</p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            {...register('email')}
            type="email"
            id="email"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            {...register('password')}
            type="password"
            id="password"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
      <LoginPageInner />
    </Suspense>
  );
}
