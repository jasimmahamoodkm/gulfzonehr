'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, UserRole, UserPermission } from '@/types/index';
import { AuthContextType, LoginPayload, SignupPayload, AuthError } from '@/types/auth';
import { PermissionCheckResult } from '@/types/rbac';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionsCache, setPermissionsCache] = useState<Map<string, boolean>>(new Map());

  // Load user roles and permissions
  const loadUserRolesAndPermissions = async (userId: string, companyId?: string) => {
    try {
      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role_id, company_id, assigned_at, assigned_by, roles(name)')
        .eq('user_id', userId)
        .eq('company_id', companyId || '');

      if (rolesError) throw rolesError;

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

        if (permError) throw permError;
        permissions = permissionsData || [];
      }

      // Clear cache for new permissions
      setPermissionsCache(new Map());

      return { roles, permissions };
    } catch (err) {
      console.error('Error loading roles and permissions:', err);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
