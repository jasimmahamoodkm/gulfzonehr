'use client';

import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { User, UserPermission } from '@/types/index';
import { AuthContextType, LoginPayload, SignupPayload } from '@/types/auth';
import { PermissionCheckResult } from '@/types/rbac';
import { apiUrl } from '@/lib/api';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

type UserCompanyRow = {
  company_id: string;
  company_name: string;
  is_primary: boolean;
  assigned_at: string;
};

function messageFromUnknown(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Permission-check cache. A ref (not state): hasPermission is called during
  // render, and caching via setState re-rendered the whole provider tree on
  // every cache miss. A ref caches with zero re-renders.
  const permissionsCache = useRef<Map<string, boolean>>(new Map());
  const [userCompanies, setUserCompanies] = useState<UserCompanyRow[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const loadUserCompanies = useCallback(async (userId: string) => {
    try {
      const { data: companiesData, error: companiesError } = await supabase
        .from('user_companies')
        .select('company_id, companies(name), is_primary, assigned_at')
        .eq('user_id', userId);

      if (companiesError) {
        console.warn('Warning loading companies:', companiesError.message);
        return [];
      }

      const companies: UserCompanyRow[] = companiesData?.map((comp) => ({
        company_id: comp.company_id,
        company_name: (comp.companies as { name?: string } | null)?.name || 'Unknown',
        is_primary: comp.is_primary || false,
        assigned_at: comp.assigned_at || new Date().toISOString(),
      })) || [];

      if (!aliveRef.current) return companies;

      if (companies.length > 0) {
        setUserCompanies(companies);
        const primaryCompany = companies.find((c) => c.is_primary);
        setSelectedCompanyId(primaryCompany?.company_id || companies[0].company_id);
      }

      return companies;
    } catch (err) {
      console.warn('Error loading user companies:', err);
      return [];
    }
  }, []);

  const loadUserRolesAndPermissions = useCallback(async (userId: string, companyId?: string) => {
    try {
      let rolesQuery = supabase
        .from('user_roles')
        .select('id, user_id, role_id, company_id, assigned_at, assigned_by, roles(name)')
        .eq('user_id', userId);

      if (companyId) {
        rolesQuery = rolesQuery.eq('company_id', companyId);
      }

      const { data: rolesData, error: rolesError } = await rolesQuery;

      if (rolesError) {
        console.error('Error fetching roles:', rolesError.message || rolesError);
        throw rolesError;
      }

      const roles = rolesData?.map((role) => ({
        ...role,
        role_name: (role.roles as { name?: string } | null)?.name,
      })) || [];

      const roleIds = roles.map((r) => r.role_id);
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

      permissionsCache.current = new Map();

      return { roles, permissions };
    } catch (err) {
      console.error('Error loading roles and permissions:', messageFromUnknown(err, 'Unknown error'), err);
      return { roles: [], permissions: [] };
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    let settled = false;
    const safety = setTimeout(() => {
      if (!settled && aliveRef.current) {
        console.warn('Auth initialization slow — unblocking the UI.');
        setLoading(false);
      }
    }, 10000);

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!aliveRef.current) return;

        if (session?.user) {
          const [{ data: userData, error: fetchError }] = await Promise.all([
            supabase.from('users').select('*').eq('id', session.user.id).single(),
            loadUserCompanies(session.user.id),
          ]);
          if (!aliveRef.current) return;
          if (fetchError) throw fetchError;

          const { roles, permissions } = await loadUserRolesAndPermissions(
            session.user.id,
            userData?.company_id,
          );
          if (!aliveRef.current) return;

          setUser({
            ...(userData as User),
            roles,
            permissions,
            is_temporary_password: session.user.user_metadata?.is_temporary_password,
          });
        }
      } catch (err) {
        if (!aliveRef.current) return;
        console.error('Auth initialization error:', err);
        setError(messageFromUnknown(err, 'Failed to initialize authentication'));
      } finally {
        settled = true;
        clearTimeout(safety);
        if (aliveRef.current) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!aliveRef.current) return;

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
          if (!aliveRef.current) return;

          if (userData) {
            const { roles, permissions } = await loadUserRolesAndPermissions(
              session.user.id,
              userData?.company_id,
            );
            if (!aliveRef.current) return;

            setUser({
              ...(userData as User),
              roles,
              permissions,
              is_temporary_password: session.user.user_metadata?.is_temporary_password,
            });
          }
          setError(null);
        } catch (err) {
          if (!aliveRef.current) return;
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
      aliveRef.current = false;
      settled = true;
      clearTimeout(safety);
      subscription?.unsubscribe();
    };
  }, [loadUserCompanies, loadUserRolesAndPermissions]);

  const hasPermission = useCallback((resource: string, action: string): PermissionCheckResult => {
    if (!user || !user.permissions) {
      return { allowed: false, reason: 'User not authenticated' };
    }

    const cacheKey = `${resource}:${action}`;
    if (permissionsCache.current.has(cacheKey)) {
      return { allowed: permissionsCache.current.get(cacheKey)! };
    }

    const hasAccess = user.permissions.some(
      (p) => p.resource === resource && p.action === action,
    );
    permissionsCache.current.set(cacheKey, hasAccess);

    return {
      allowed: hasAccess,
      reason: hasAccess ? undefined : `No permission to ${action} ${resource}`,
    };
  }, [user]);

  const login = useCallback(async (payload: LoginPayload) => {
    try {
      setError(null);
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password,
      });

      if (signInError) throw signInError;
      if (!aliveRef.current) return;

      if (data.user) {
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (fetchError) throw fetchError;
        if (!aliveRef.current) return;

        await loadUserCompanies(data.user.id);
        if (!aliveRef.current) return;

        const { roles, permissions } = await loadUserRolesAndPermissions(
          data.user.id,
          userData?.company_id,
        );
        if (!aliveRef.current) return;

        setUser({
          ...(userData as User),
          roles,
          permissions,
          is_temporary_password: data.user.user_metadata?.is_temporary_password,
        });
      }
    } catch (err) {
      const message = messageFromUnknown(err, 'Login failed');
      if (aliveRef.current) setError(message);
      throw err;
    }
  }, [loadUserCompanies, loadUserRolesAndPermissions]);

  const signup = useCallback(async (payload: SignupPayload) => {
    try {
      setError(null);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
      });

      if (signUpError) throw signUpError;
      if (!aliveRef.current) return;

      if (data.user) {
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
        if (!aliveRef.current) return;

        const { roles, permissions } = await loadUserRolesAndPermissions(
          data.user.id,
          userData?.company_id,
        );
        if (!aliveRef.current) return;

        setUser({
          ...(userData as User),
          roles,
          permissions,
        });
      }
    } catch (err) {
      const errorMessage = messageFromUnknown(err, 'Signup failed');
      console.error('Signup error:', errorMessage);
      if (aliveRef.current) setError(errorMessage);
      throw err;
    }
  }, [loadUserRolesAndPermissions]);

  const logout = useCallback(async () => {
    try {
      setError(null);
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      if (!aliveRef.current) return;
      setUser(null);
      permissionsCache.current = new Map();
      setUserCompanies([]);
      setSelectedCompanyId(null);
    } catch (err) {
      const message = messageFromUnknown(err, 'Logout failed');
      if (aliveRef.current) setError(message);
      throw err;
    }
  }, []);

  const updatePassword = useCallback(async (_currentPassword: string, newPassword: string) => {
    try {
      setError(null);
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;
    } catch (err) {
      const message = messageFromUnknown(err, 'Password update failed');
      if (aliveRef.current) setError(message);
      throw err;
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    try {
      setError(null);
      if (!user) throw new Error('No user logged in');

      const { data, error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (!aliveRef.current) return;

      if (updates.company_id && updates.company_id !== user.company_id) {
        const { roles, permissions } = await loadUserRolesAndPermissions(
          user.id,
          updates.company_id,
        );
        if (!aliveRef.current) return;
        setUser({
          ...(data as User),
          roles,
          permissions,
        });
      } else {
        setUser(data as User);
      }
    } catch (err) {
      const message = messageFromUnknown(err, 'Profile update failed');
      if (aliveRef.current) setError(message);
      throw err;
    }
  }, [user, loadUserRolesAndPermissions]);

  const completePasswordChange = useCallback(async (newPassword: string) => {
    try {
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const currentToken = sessionData?.session?.access_token;

      if (!currentToken) {
        throw new Error('Session expired. Please log in again.');
      }

      try {
        const response = await fetch(apiUrl('/api/auth/clear-temporary-password'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}`,
          },
        });
        if (!response.ok) {
          console.warn('clear-temporary-password API returned non-OK status, continuing anyway');
        }
      } catch (apiErr) {
        console.warn('clear-temporary-password API failed (non-critical):', apiErr);
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update password');
      }

      if (!aliveRef.current) return;
      if (user) {
        setUser({ ...user, is_temporary_password: false });
      }
    } catch (err) {
      const msg = messageFromUnknown(err, 'Password change failed');
      if (aliveRef.current) setError(msg);
      throw err;
    }
  }, [user]);

  const switchCompany = useCallback(async (companyId: string) => {
    setSelectedCompanyId(companyId);
  }, []);

  const value: AuthContextType = useMemo(
    () => ({
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
    }),
    [
      user,
      loading,
      error,
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
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
