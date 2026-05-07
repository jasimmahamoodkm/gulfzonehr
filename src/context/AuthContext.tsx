'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types/index';
import { AuthContextType, LoginPayload, SignupPayload, AuthError } from '@/types/auth';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

          setUser(userData as User);
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

          setUser(userData as User);
          setError(null);
        } catch (err) {
          console.error('Error fetching user data:', err);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

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
        setUser(userData as User);
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

        setUser(userData as User);
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
      setUser(data as User);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
