-- Migration: Create user_companies table for multi-company support
-- Date: May 2026
-- Description: Add many-to-many relationship between users and companies

-- Create user_companies table (junction table)
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure no duplicate assignments
  UNIQUE(user_id, company_id)
);

-- Create indexes for performance
DROP INDEX IF EXISTS idx_user_companies_user_id;
DROP INDEX IF EXISTS idx_user_companies_company_id;
DROP INDEX IF EXISTS idx_user_companies_primary;

CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);
CREATE INDEX idx_user_companies_primary ON user_companies(user_id, is_primary);

-- Enable Row Level Security
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS user_companies_select_own ON user_companies;
DROP POLICY IF EXISTS user_companies_admin ON user_companies;
DROP POLICY IF EXISTS user_companies_service ON user_companies;

-- Policy: Users can see their own assigned companies
CREATE POLICY user_companies_select_own ON user_companies
FOR SELECT USING (
  auth.uid() = user_id
);

-- Policy: Admins can see and manage all user_companies
CREATE POLICY user_companies_admin ON user_companies
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('Super Admin', 'Company Admin')
  )
);

-- Policy: Allow service role (for migrations/setup)
CREATE POLICY user_companies_service ON user_companies
FOR ALL USING (
  auth.role() = 'service_role'
);

-- Backfill existing data from users.company_id if it exists and has values
DO $$
BEGIN
  -- Check if company_id column exists in users table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'company_id'
  ) THEN
    -- Backfill user_companies from existing users.company_id
    INSERT INTO user_companies (user_id, company_id, is_primary)
    SELECT id, company_id, true FROM users
    WHERE company_id IS NOT NULL
    ON CONFLICT (user_id, company_id) DO NOTHING;

    RAISE NOTICE 'Backfilled user_companies from existing company_id values';
  ELSE
    RAISE NOTICE 'No company_id column found in users table, skipping backfill';
  END IF;
END
$$;

-- Verify the table was created
SELECT 'user_companies table created successfully' AS status;
