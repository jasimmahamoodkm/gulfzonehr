-- Migration: Create documents table
-- This migration creates the documents table for tracking employee documents
-- like passports, visas, driving licenses, etc.

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type VARCHAR NOT NULL,
  document_number VARCHAR NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  issuing_authority VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON public.documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee_id ON public.documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date ON public.documents(expiry_date);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow users to see company documents" ON public.documents
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow users to insert documents for their company" ON public.documents
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow users to update company documents" ON public.documents
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow users to delete company documents" ON public.documents
  FOR DELETE USING (company_id IN (
    SELECT company_id FROM public.users WHERE id = auth.uid()
  ));
