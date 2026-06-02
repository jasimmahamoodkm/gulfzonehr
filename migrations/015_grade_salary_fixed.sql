-- Migration 015: Ensure grade_salary_config uses single salary column
-- Safe to run whether or not min_salary/max_salary columns exist.

-- Drop the dependent view first (recreated at the end)
DROP VIEW IF EXISTS grade_summary;

-- Add salary column if it doesn't already exist
ALTER TABLE grade_salary_config
  ADD COLUMN IF NOT EXISTS salary DECIMAL(12,2);

-- If old min_salary/max_salary columns still exist, migrate their data
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grade_salary_config' AND column_name = 'min_salary'
  ) THEN
    -- Copy midpoint value into salary where salary is still NULL
    UPDATE grade_salary_config
    SET salary = COALESCE(
      CASE
        WHEN min_salary IS NOT NULL AND max_salary IS NOT NULL
          THEN ROUND((min_salary + max_salary) / 2, 2)
        ELSE COALESCE(min_salary, max_salary)
      END,
      0
    )
    WHERE salary IS NULL;

    -- Drop old columns
    ALTER TABLE grade_salary_config
      DROP COLUMN IF EXISTS min_salary,
      DROP COLUMN IF EXISTS max_salary;
  END IF;
END;
$$;

-- Set salary NOT NULL (fill any remaining NULLs with 0 first)
UPDATE grade_salary_config SET salary = 0 WHERE salary IS NULL;
ALTER TABLE grade_salary_config ALTER COLUMN salary SET NOT NULL;

-- Recreate grade_summary view
CREATE OR REPLACE VIEW grade_summary AS
SELECT
  g.id,
  g.company_id,
  g.name,
  g.level,
  g.description,
  g.active,
  g.created_at,
  g.updated_at,
  COUNT(e.id) AS employee_count,
  s.salary,
  s.currency
FROM employee_grades g
LEFT JOIN employees e ON e.grade_id = g.id AND e.status = 'Active'
LEFT JOIN LATERAL (
  SELECT salary, currency
  FROM grade_salary_config sc
  WHERE sc.grade_id = g.id
    AND sc.effective_from <= CURRENT_DATE
    AND (sc.effective_to IS NULL OR sc.effective_to >= CURRENT_DATE)
  ORDER BY sc.effective_from DESC
  LIMIT 1
) s ON TRUE
GROUP BY g.id, g.company_id, g.name, g.level, g.description, g.active,
         g.created_at, g.updated_at, s.salary, s.currency;
