-- Migration 025: archive employees instead of hard-deleting them.
-- Archiving sets status = 'Inactive' and records archived_at (and who did it),
-- so the employee's full history stays viewable with its current status and the
-- date it was archived. Reactivating clears archived_at.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS archived_at timestamp without time zone;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employees.archived_at IS
  'When set, the employee is archived (status Inactive). NULL = active record.';

CREATE INDEX IF NOT EXISTS idx_employees_archived_at
  ON public.employees (archived_at);
