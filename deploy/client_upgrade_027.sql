-- ============================================================================
-- GulfZone HR — CLIENT UPGRADE SCRIPT (migration 027: global leave types)
-- Run this WHOLE file in the CLIENT Supabase SQL editor. Idempotent.
-- ============================================================================
-- Migration 027: leave types become GLOBAL (shared by all companies).
--
-- Previously each company duplicated the same leave types ("Annual Leave",
-- "Sick Leave", …) because leave_types.company_id was NOT NULL and RLS
-- restricted reads to the caller's company. This migration:
--   1. makes company_id nullable (NULL = global),
--   2. de-duplicates types by name, remapping grade_leave_config and
--      employee_leave_balance references to the surviving row,
--   3. marks the survivors global and enforces unique names,
--   4. opens the read policy to all authenticated users.
-- Idempotent — safe to re-run.

-- 1. company_id nullable
ALTER TABLE public.leave_types ALTER COLUMN company_id DROP NOT NULL;

-- 2. De-duplicate by name (case-insensitive): keep the earliest row,
--    remap references, delete the duplicates.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT (array_agg(id ORDER BY created_at, id))[1] AS keep_id,
           array_agg(id ORDER BY created_at, id)      AS all_ids
    FROM public.leave_types
    GROUP BY lower(name)
    HAVING count(*) > 1
  LOOP
    -- grade_leave_config → keeper (skip rows that would collide, then drop them)
    UPDATE public.grade_leave_config glc
       SET leave_type_id = r.keep_id
     WHERE glc.leave_type_id = ANY(r.all_ids)
       AND glc.leave_type_id <> r.keep_id
       AND NOT EXISTS (
         SELECT 1 FROM public.grade_leave_config g2
          WHERE g2.grade_id = glc.grade_id
            AND g2.leave_type_id = r.keep_id
            AND g2.year IS NOT DISTINCT FROM glc.year);
    DELETE FROM public.grade_leave_config
     WHERE leave_type_id = ANY(r.all_ids) AND leave_type_id <> r.keep_id;

    -- employee_leave_balance → keeper (same collision guard)
    UPDATE public.employee_leave_balance b
       SET leave_type_id = r.keep_id
     WHERE b.leave_type_id = ANY(r.all_ids)
       AND b.leave_type_id <> r.keep_id
       AND NOT EXISTS (
         SELECT 1 FROM public.employee_leave_balance b2
          WHERE b2.employee_id = b.employee_id
            AND b2.leave_type_id = r.keep_id
            AND b2.year = b.year);
    DELETE FROM public.employee_leave_balance
     WHERE leave_type_id = ANY(r.all_ids) AND leave_type_id <> r.keep_id;

    -- drop the duplicate type rows themselves
    DELETE FROM public.leave_types WHERE id = ANY(r.all_ids) AND id <> r.keep_id;
  END LOOP;
END $$;

-- 3. Survivors are global; names unique from here on
UPDATE public.leave_types SET company_id = NULL WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_types_name
  ON public.leave_types (lower(name));

-- 4. RLS: every authenticated user can read the global list
--    (insert/update/delete stay HR-and-above via the existing policies)
DROP POLICY IF EXISTS leave_types_read ON public.leave_types;
CREATE POLICY leave_types_read ON public.leave_types
  FOR SELECT TO public
  USING ((select auth.uid()) IS NOT NULL);
