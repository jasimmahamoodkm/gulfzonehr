'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, UserPermission } from '@/types/index';
import { AuthContextType, LoginPayload, SignupPayload, AuthError } from '@/types/auth';
import { PermissionCheckResult } from '@/types/rbac';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionsCache, setPermissionsCache] = useState<Map<string, boolean>>(new Map());
  const [userCompanies, setUserCompanies] = useState<Array<{ company_id: string; company_name: string; is_primary: boolean; assigned_at: string }>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Load user companies
  const loadUserCompanies = async (userId: string) => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('user_companies')
        .select('company_id, companies(name), is_primary, assigned_at')
        .eq('user_id', userId);

      if (companiesError) {
        console.warn('⚠️ Warning loading companies:', companiesError.message);
        return [];
      }

      const companies = companiesData?.map(comp => ({
        company_id: comp.company_id,
        company_name: (comp.companies as any)?.name || 'Unknown',
        is_primary: comp.is_primary || false,
        assigned_at: comp.assigned_at || new Date().toISOString(),
      })) || [];

      if (companies.length > 0) {
        setUserCompanies(companies);
        // Set primary company as selected
        const primaryCompany = companies.find(c => c.is_primary);
        setSelectedCompanyId(primaryCompany?.company_id || companies[0].company_id);
      }

      return companies;
    } catch (err) {
      console.warn('⚠️ Error loading user companies:', err);
      return [];
    }
  };

  // Load user roles and permissions
  const loadUserRolesAndPermissions = async (userId: string, companyId?: string) => {
    try {
      // Fetch user roles
      let rolesQuery = supabase
        .from('user_roles')
        .select('id, user_id, role_id, company_id, assigned_at, assigned_by, roles(name)')
        .eq('user_id', userId);

      // Only filter by company_id if provided
      if (companyId) {
        rolesQuery = rolesQuery.eq('company_id', companyId);
      }

      const { data: rolesData, error: rolesError } = await rolesQuery;

      if (rolesError) {
        console.error('❌ Error fetching roles:', rolesError.message || rolesError);
        throw rolesError;
      }

      // Transform roles data with role names
      const roles = rolesData?.map(role => ({
        ...role,
        role_name: (role.roles as any)?.name,
      })) || [];

      // Fetch permissions for all roles
      const roleIds = roles.map(r => r.role_id);
      let permissions: UserPermission[] = [];

      if (roleIds.length > 0) {
        const { data: permissionsData, error: permError } = await supabase
          .from('role_permissions')
          .select('id, role_id, resource, action, created_at')
          .in('role_id', roleIds);

        if (permError) {
          console.error('❌ Error fetching permissions:', permError.message || permError);
          throw permError;
        }
        permissions = permissionsData || [];
      }

      // Clear cache for new permissions
      setPermissionsCache(new Map());

      return { roles, permissions };
    } catch (err) {
      const errorMsg = (err as any)?.message || (err as any)?.error?.message || String(err) || 'Unknown error';
      console.error('❌ Error loading roles and permissions:', errorMsg, err);
      return { roles: [], permissions: [] };
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check current session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Fetch full user profile from database
          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (fetchError) throw fetchError;

          // Load user companies
          await loadUserCompanies(session.user.id);

          // Load roles and permissions
          const { roles, permissions } = await loadUserRolesAndPermissions(
            session.user.id,
            userData?.company_id
          );

          setUser({
            ...userData as User,
            roles,
            permissions,
          });
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError((err as AuthError).message || 'Failed to initialize authentication');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (userData) {
            // Load user companies
            await loadUserCompanies(session.user.id);

            const { roles, permissions } = await loadUserRolesAndPermissions(
              session.user.id,
              userData?.company_id
            );

            setUser({
              ...userData as User,
              roles,
              permissions,
            });
          }
          setError(null);
        } catch (err) {
          console.error('Error fetching user data:', err);
        }
      } else {
        setUser(null);
        setPermissionsCache(new Map());
        setUserCompanies([]);
        setSelectedCompanyId(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Check if user has permission
  const hasPermission = (resource: string, action: string): PermissionCheckResult => {
    if (!user || !user.permissions) {
      return { allowed: false, reason: 'User not authenticated' };
    }

    const cacheKey = `${resource}:${action}`;

    // Check cache first
    if (permissionsCache.has(cacheKey)) {
      return { allowed: permissionsCache.get(cacheKey)! };
    }

    // Check permissions
    const hasAccess = user.permissions.some(
      p => p.resource === resource && p.action === action
    );

    // Update cache
    setPermissionsCache(prev => new Map(prev).set(cacheKey, hasAccess));

    return {
      allowed: hasAccess,
      reason: hasAccess ? undefined : `No permission to ${action} ${resource}`,
    };
  };

  const login = async (payload: LoginPayload) => {
    try {
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (fetchError) throw fetchError;

        // Load user companies
        await loadUserCompanies(data.user.id);

        // Load roles and permissions
        const { roles, permissions } = await loadUserRolesAndPermissions(
          data.user.id,
          userData?.company_id
        );

        setUser({
          ...userData as User,
          roles,
          permissions,
        });
      }
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Login failed');
      throw err;
    }
  };

  const signup = async (payload: SignupPayload) => {
    try {
      setError(null);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // Create user profile in database
        const { data: userData, error: createError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: payload.email,
            first_name: payload.first_name,
            last_name: payload.last_name,
            role: 'Employee',
          })
          .select()
          .single();

        if (createError) {
          console.error('Profile creation error:', createError);
          throw createError;
        }

        // Load roles and permissions for new user
        const { roles, permissions } = await loadUserRolesAndPermissions(
          data.user.id,
          userData?.company_id
        );

        setUser({
          ...userData as User,
          roles,
          permissions,
        });
      }
    } catch (err) {
      const authError = err as AuthError;
      const errorMessage = authError.message || (err as any)?.message || 'Signup failed';
      console.error('Signup error:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  };

  const logout = async () => {
    try {
      setError(null);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
      setPermissionsCache(new Map());
      setUserCompanies([]);
      setSelectedCompanyId(null);
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Logout failed');
      throw err;
    }
  };

  const updatePassword = async (_currentPassword: string, newPassword: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Password update failed');
      throw err;
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      setError(null);
      if (!user) throw new Error('No user logged in');

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Reload permissions if company changed
      if (updates.company_id && updates.company_id !== user.company_id) {
        const { roles, permissions } = await loadUserRolesAndPermissions(
          user.id,
          updates.company_id
        );
        setUser({
          ...data as User,
          roles,
          permissions,
        });
      } else {
        setUser(data as User);
      }
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message || 'Profile update failed');
      throw err;
    }
  };

  const completePasswordChange = async (newPassword: string) => {
    try {
      setError(null);
      console.log('🔐 completePasswordChange called');

      // Step 1: Update password in Supabase Auth
      console.log('📍 Step 1: Updating password in Supabase Auth...');
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;
      console.log('✅ Password updated successfully in Supabase Auth');

      // Step 2: Get session and extract bearer token
      console.log('📍 Step 2: Clearing temporary password flag via API...');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      console.log('📍 Session data:', {
        hasSession: !!sessionData?.session,
        hasAccessToken: !!token,
        tokenLength: token?.length || 0,
      });

      if (!token) {
        throw new Error('No access token available. Please log in again.');
      }

      // Step 3: Call clear-temporary-password API with Bearer token
      console.log('📍 Making API call to clear-temporary-password...');
      const response = await fetch('/api/auth/clear-temporary-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📍 API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(
          errorData.error || `API error: ${response.status}`
        );
      }

      const responseData = await response.json();
      console.log('✅ Temporary password flag cleared:', responseData);

      // Step 4: Update local user state
      console.log('📍 Step 3: Updating local user state...');
      if (user) {
        setUser({ ...user, is_temporary_password: false });
      }
      console.log('✅ Local user state updated');

      // Step 5: Refresh session to ensure metadata is up-to-date
      console.log('📍 Step 4: Refreshing session...');
      const { data: refreshData } = await supabase.auth.refreshSession();
      console.log('✅ Session refreshed successfully');

      if (refreshData.user?.user_metadata) {
        console.log('📍 Refreshed user metadata:', refreshData.user.user_metadata);
      }

      // Step 6: Verify flag was actually cleared
      console.log('📍 Step 5: Verifying flag was cleared...');
      const { data: { user: verifyUser } } = await supabase.auth.getUser(token);

      if (verifyUser) {
        const isFlagCleared = !verifyUser.user_metadata?.is_temporary_password;
        console.log('✅ Flag verification:', {
          isFlagCleared,
          currentMetadata: verifyUser.user_metadata,
        });
      }

      console.log('✅ Password changed successfully!');
    } catch (err) {
      const authError = err as AuthError;
      const errorMessage = authError.message || (err as any)?.message || 'Password change failed';
      console.error('❌ Password change error:', err);
      setError(errorMessage);
      throw err;
    }
  };

  const switchCompany = async (companyId: string) => {
    setSelectedCompanyId(companyId);
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    signup,
    logout,
    updatePassword,
    updateProfile,
    hasPermission,
    completePasswordChange,
    userCompanies,
    selectedCompanyId,
    switchCompany,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
