-- Migration: Fix documents RLS policies
-- Problem: documents_write_own policy uses get_my_company_id() which reads
--          users.company_id (primary company only). Super Admins and multi-
--          company admins selecting a different company in the UI fail the
--          company_id check even though they have legitimate access.
-- Fix:     Super Admins bypass the check entirely; other users can insert for
--          any company they belong to (via user_companies OR users.company_id).

-- Helper function: returns TRUE if the given company_id is one the current
-- user is associated with (either via user_companies or users.company_id).
CREATE OR REPLACE FUNCTION public.user_has_company_access(p_company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid() AND company_id = p_company_id
  )
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND company_id = p_company_id
  )
$$;

-- Drop old documents policies
DROP POLICY IF EXISTS documents_read        ON public.documents;
DROP POLICY IF EXISTS documents_write_own   ON public.documents;
DROP POLICY IF EXISTS documents_update      ON public.documents;
DROP POLICY IF EXISTS documents_delete      ON public.documents;

-- Also drop any old-style policies from migration 001 that may still exist
DROP POLICY IF EXISTS "Allow users to see company documents"           ON public.documents;
DROP POLICY IF EXISTS "Allow users to insert documents for their company" ON public.documents;
DROP POLICY IF EXISTS "Allow users to update company documents"        ON public.documents;
DROP POLICY IF EXISTS "Allow users to delete company documents"        ON public.documents;

-- SELECT: authenticated users can see documents for companies they belong to,
--         or their own employee documents, or super admins see all.
CREATE POLICY documents_read ON public.documents
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR public.user_has_company_access(company_id)
    )
  );

-- INSERT: super admins can insert for any company; HR+ can insert for any
--         company they belong to; employees can only insert their own docs.
CREATE POLICY documents_write ON public.documents
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR (
        public.user_has_company_access(company_id)
        AND (public.is_hr_or_above() OR employee_id = public.get_my_employee_id())
      )
    )
  );

-- UPDATE: same rules as INSERT
CREATE POLICY documents_update ON public.documents
  FOR UPDATE USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR (
        public.user_has_company_access(company_id)
        AND (public.is_hr_or_above() OR employee_id = public.get_my_employee_id())
      )
    )
  ) WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR (
        public.user_has_company_access(company_id)
        AND (public.is_hr_or_above() OR employee_id = public.get_my_employee_id())
      )
    )
  );

-- DELETE: HR+ for their company, super admins for all
CREATE POLICY documents_delete ON public.documents
  FOR DELETE USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_super_admin()
      OR (
        public.is_hr_or_above()
        AND public.user_has_company_access(company_id)
      )
    )
  );

-- Verify
SELECT
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'documents'
ORDER BY policyname;
