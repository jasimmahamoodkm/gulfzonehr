'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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

  // Fetch companies from database on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setCompanies(data || []);
      } catch (err) {
        console.error('Error fetching companies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  const handleSetSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompanyState(company);
  }, []);

  return (
    <CompanyContext.Provider
      value={{
        selectedCompany,
        setSelectedCompany: handleSetSelectedCompany,
        companies,
        loading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
};
