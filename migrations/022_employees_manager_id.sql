-- Migration 022: add employees.manager_id (reporting manager)
-- This column backs the "Assign Manager" feature and the manager-scoped data
-- views. It was originally applied directly to the production project, so this
-- file exists to bring DEV / fresh environments in line. Idempotent.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS manager_id uuid;

-- Self-referencing FK: an employee's manager is another employee.
DO $$ BEGIN
  ALTER TABLE public.employees
    ADD CONSTRAINT employees_manager_id_fkey
    FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_employees_manager_id
  ON public.employees (manager_id);
