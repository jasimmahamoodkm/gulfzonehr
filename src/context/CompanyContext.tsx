'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Company } from '@/types';
import { supabase } from '@/lib/supabase';

interface CompanyContextType {
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  companies: Company[];
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  // Track the last userId we loaded for — avoid re-fetching for the same user
  const loadedForUser = useRef<string | null>(null);

  const fetchGen = useRef(0);

  const fetchCompanies = useCallback(async (userId: string) => {
    // Skip if already loaded for this user
    if (loadedForUser.current === userId) return;

    const gen = ++fetchGen.current;
    const stillCurrent = () => gen === fetchGen.current;

    try {
      setLoading(true);
      loadedForUser.current = userId;

      // Super Admins can select ANY company, not just the ones assigned to them.
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', userId);
      if (!stillCurrent()) return;
      const isSuperAdmin = (roleRows || []).some(
        (r) => (r.roles as { name?: string } | null)?.name === 'Super Admin',
      );

      if (isSuperAdmin) {
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('*')
          .order('name', { ascending: true });
        if (!stillCurrent()) return;
        if (allCompanies && allCompanies.length > 0) {
          setCompanies(allCompanies as unknown as Company[]);
          // Default to the admin's primary assigned company (if any), else the
          // first — but never override a selection the user already made.
          const { data: primaryUc } = await supabase
            .from('user_companies')
            .select('company_id')
            .eq('user_id', userId)
            .eq('is_primary', true)
            .maybeSingle();
          if (!stillCurrent()) return;
          const defaultCompany =
            (primaryUc?.company_id && allCompanies.find((c) => c.id === primaryUc.company_id)) ||
            allCompanies[0];
          setSelectedCompanyState((prev) => prev ?? (defaultCompany as unknown as Company));
          return;
        }
      }

      // Single query: user's companies with full details via join
      const { data: ucData, error: ucError } = await supabase
        .from('user_companies')
        .select('is_primary, companies(*)')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false });
      if (!stillCurrent()) return;

      if (!ucError && ucData && ucData.length > 0) {
        const userCompanies = ucData
          .map((uc) => uc.companies as unknown as Company)
          .filter(Boolean);

        setCompanies(userCompanies);

        // Primary company comes first due to ordering
        const primaryRow = ucData.find((uc) => uc.is_primary) ?? ucData[0];
        const primaryCompany = primaryRow?.companies as unknown as Company;
        if (primaryCompany) setSelectedCompanyState(primaryCompany);
        return;
      }

      // Fallback: employee whose company is stored in users.company_id
      const { data: userData } = await supabase
        .from('users')
        .select('companies(*)')
        .eq('id', userId)
        .single();
      if (!stillCurrent()) return;

      if (userData?.companies) {
        const company = userData.companies as unknown as Company;
        setCompanies([company]);
        setSelectedCompanyState(company);
      }
    } catch (err) {
      console.error('CompanyContext error:', err);
      if (stillCurrent()) loadedForUser.current = null; // allow retry on error
    } finally {
      if (stillCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Run once on mount for users who are already logged in (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user?.id) {
        fetchCompanies(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Re-run whenever auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_IN' && session?.user?.id) {
        fetchCompanies(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        fetchGen.current += 1;
        setCompanies([]);
        setSelectedCompanyState(null);
        loadedForUser.current = null;
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      fetchGen.current += 1;
      subscription.unsubscribe();
    };
  }, [fetchCompanies]);

  const handleSetSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompanyState(company);
  }, []);

  // Memoize the context value so consumers only re-render when the company
  // state actually changes, not on every provider render.
  const value = useMemo(
    () => ({ selectedCompany, setSelectedCompany: handleSetSelectedCompany, companies, loading }),
    [selectedCompany, handleSetSelectedCompany, companies, loading]
  );

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) throw new Error('useCompany must be used within CompanyProvider');
  return context;
};
