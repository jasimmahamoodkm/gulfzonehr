-- Migration: Fix Users RLS Policy for Admin Access
-- Date: May 2026
-- Description: Allow admins to read all users in their company for RBAC management

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS users_authenticated_read ON users;
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS users_admin_read ON users;

-- Allow users to read their own profile
CREATE POLICY users_read_own_profile ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Allow admins to read all users in their company
CREATE POLICY users_admin_read_all ON users
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM user_roles
      WHERE role_id IN (
        SELECT id FROM roles
        WHERE name IN ('Super Admin', 'Company Admin')
      )
    )
    AND (
      company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
      OR company_id IS NULL
    )
  );

-- System roles can read all users
CREATE POLICY users_service_read ON users
  FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'Super Admin'
  ));

-- Users can update their own profile
CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role can insert users
CREATE POLICY users_insert ON users
  FOR INSERT
  WITH CHECK (true);
