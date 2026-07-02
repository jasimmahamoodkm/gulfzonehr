'use client';

import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, UserPermission } from '@/types/index';
import { AuthContextType, LoginPayload, SignupPayload, AuthError } from '@/types/auth';
import { PermissionCheckResult } from '@/types/rbac';
import { apiUrl } from '@/lib/api';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Permission-check cache. A ref (not state): hasPermission is called during
  // render, and caching via setState re-rendered the whole provider tree on
  // every cache miss. A ref caches with zero re-renders.
  const permissionsCache = useRef<Map<string, boolean>>(new Map());
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
        console.warn('Warning loading companies:', companiesError.message);
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
      console.warn('Error loading user companies:', err);
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
        console.error('Error fetching roles:', rolesError.message || rolesError);
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
          console.error('Error fetching permissions:', permError.message || permError);
          throw permError;
        }
        permissions = permissionsData || [];
      }

      // Clear cache for new permissions
      permissionsCache.current = new Map();

      return { roles, permissions };
    } catch (err) {
      const errorMsg = (err as any)?.message || (err as any)?.error?.message || String(err) || 'Unknown error';
      console.error('Error loading roles and permissions:', errorMsg, err);
      return { roles: [], permissions: [] };
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    // Safety net: never let the app hang on the loading spinner if auth init
    // stalls (e.g. a token-refresh request that never resolves). After a while
    // we stop blocking so the app can proceed; if the session later resolves,
    // onAuthStateChange picks it up. We do NOT abort getSession itself, so a
    // merely-slow (but valid) session is never killed mid-flight.
    let settled = false;
    const safety = setTimeout(() => {
      if (!settled) {
        console.warn('Auth initialization slow — unblocking the UI.');
        setLoading(false);
      }
    }, 10000);

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Fetch user profile and companies in parallel (independent queries)
          const [{ data: userData, error: fetchError }] = await Promise.all([
            supabase.from('users').select('*').eq('id', session.user.id).single(),
            loadUserCompanies(session.user.id),
          ]);

          if (fetchError) throw fetchError;

          // Load roles and permissions (needs company_id from userData)
          const { roles, permissions } = await loadUserRolesAndPermissions(
            session.user.id,
            userData?.company_id
          );

          setUser({
            ...userData as User,
            roles,
            permissions,
            is_temporary_password: session.user.user_metadata?.is_temporary_password,
          });
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError((err as AuthError).message || 'Failed to initialize authentication');
      } finally {
        settled = true;
        clearTimeout(safety);
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // USER_UPDATED fires when password changes — skip full reload to avoid
      // overwriting the is_temporary_password flag we just cleared in state.
      if (event === 'USER_UPDATED') {
        return;
      }

      if (session?.user) {
        try {
          const [{ data: userData }] = await Promise.all([
            supabase.from('users').select('*').eq('id', session.user.id).single(),
            loadUserCompanies(session.user.id),
          ]);

          if (userData) {
            const { roles, permissions } = await loadUserRolesAndPermissions(
              session.user.id,
              userData?.company_id
            );

            setUser({
              ...userData as User,
              roles,
              permissions,
              is_temporary_password: session.user.user_metadata?.is_temporary_password,
            });
          }
          setError(null);
        } catch (err) {
          console.error('Error fetching user data:', err);
        }
      } else {
        setUser(null);
        permissionsCache.current = new Map();
        setUserCompanies([]);
        setSelectedCompanyId(null);
      }
    });

    return () => {
      clearTimeout(safety);
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
    if (permissionsCache.current.has(cacheKey)) {
      return { allowed: permissionsCache.current.get(cacheKey)! };
    }

    // Check permissions
    const hasAccess = user.permissions.some(
      p => p.resource === resource && p.action === action
    );

    // Update cache
    permissionsCache.current.set(cacheKey, hasAccess);

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
      permissionsCache.current = new Map();
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

      // Step 1: Get current valid token BEFORE changing password
      const { data: sessionData } = await supabase.auth.getSession();
      const currentToken = sessionData?.session?.access_token;

      if (!currentToken) {
        throw new Error('Session expired. Please log in again.');
      }

      // Step 2: Clear the temporary password flag via API (non-blocking)
      // Must be done BEFORE updateUser() because that invalidates the token
      try {
        const response = await fetch(apiUrl('/api/auth/clear-temporary-password'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`,
          },
        });
        if (!response.ok) {
          console.warn('clear-temporary-password API returned non-OK status, continuing anyway');
        }
      } catch (apiErr) {
        // Non-critical — continue with password update even if this fails
        console.warn('clear-temporary-password API failed (non-critical):', apiErr);
      }

      // Step 3: Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update password');
      }

      // Step 4: Update local state so UI unblocks immediately
      // Do NOT call refreshSession() — it hangs after a password change
      if (user) {
        setUser({ ...user, is_temporary_password: false });
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Password change failed';
      setError(msg);
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
