'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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

  const fetchCompanies = useCallback(async (userId: string) => {
    // Skip if already loaded for this user
    if (loadedForUser.current === userId) return;

    try {
      setLoading(true);
      loadedForUser.current = userId;

      // Single query: user's companies with full details via join
      const { data: ucData, error: ucError } = await supabase
        .from('user_companies')
        .select('is_primary, companies(*)')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false });

      if (!ucError && ucData && ucData.length > 0) {
        const userCompanies = ucData
          .map(uc => uc.companies as unknown as Company)
          .filter(Boolean);

        setCompanies(userCompanies);

        // Primary company comes first due to ordering
        const primaryRow = ucData.find(uc => uc.is_primary) ?? ucData[0];
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

      if (userData?.companies) {
        const company = userData.companies as unknown as Company;
        setCompanies([company]);
        setSelectedCompanyState(company);
      }
    } catch (err) {
      console.error('CompanyContext error:', err);
      loadedForUser.current = null; // allow retry on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Run once on mount for users who are already logged in (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        fetchCompanies(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Re-run whenever auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.id) {
        // User just logged in — load their companies
        fetchCompanies(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // Clear company state on logout
        setCompanies([]);
        setSelectedCompanyState(null);
        loadedForUser.current = null;
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchCompanies]);

  const handleSetSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompanyState(company);
  }, []);

  return (
    <CompanyContext.Provider
      value={{ selectedCompany, setSelectedCompany: handleSetSelectedCompany, companies, loading }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) throw new Error('useCompany must be used within CompanyProvider');
  return context;
};
