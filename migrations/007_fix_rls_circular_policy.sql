-- Migration: Fix RLS Circular Policy
-- Date: May 2026
-- Description: Fix circular RLS policy on roles and user_roles tables

-- Drop problematic policies
DROP POLICY IF EXISTS roles_admin_select_policy ON roles;
DROP POLICY IF EXISTS roles_admin_write_policy ON roles;
DROP POLICY IF EXISTS user_roles_admin_policy ON user_roles;

-- Fix roles table: Allow authenticated users to read roles for their company
CREATE POLICY roles_read_policy ON roles
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
    OR is_system = true
  );

CREATE POLICY roles_write_policy ON roles
  FOR ALL
  USING (
    is_system = false
    AND company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
    AND auth.uid() IN (
      SELECT user_id FROM user_roles ur
      WHERE ur.company_id = roles.company_id
      AND ur.role_id IN (
        SELECT id FROM roles r2
        WHERE r2.name IN ('Super Admin', 'Company Admin')
        AND r2.company_id = roles.company_id
      )
    )
  )
  WITH CHECK (
    is_system = false
    AND company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
    AND auth.uid() IN (
      SELECT user_id FROM user_roles ur
      WHERE ur.company_id = roles.company_id
      AND ur.role_id IN (
        SELECT id FROM roles r2
        WHERE r2.name IN ('Super Admin', 'Company Admin')
        AND r2.company_id = roles.company_id
      )
    )
  );

-- Fix user_roles table: Allow users to read their own roles and admins to manage
CREATE POLICY user_roles_read_policy ON user_roles
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY user_roles_write_policy ON user_roles
  FOR ALL
  USING (
    company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
    AND auth.uid() IN (
      SELECT user_id FROM user_roles ur
      WHERE ur.company_id = user_roles.company_id
      AND ur.role_id IN (
        SELECT id FROM roles
        WHERE name IN ('Super Admin', 'Company Admin')
        AND company_id = user_roles.company_id
      )
    )
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid())
    AND auth.uid() IN (
      SELECT user_id FROM user_roles ur
      WHERE ur.company_id = user_roles.company_id
      AND ur.role_id IN (
        SELECT id FROM roles
        WHERE name IN ('Super Admin', 'Company Admin')
        AND company_id = user_roles.company_id
      )
    )
  );
