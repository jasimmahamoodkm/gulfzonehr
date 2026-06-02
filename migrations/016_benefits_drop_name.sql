-- Migration 016: Remove benefit_name, use benefit_type as the unique identifier per grade

ALTER TABLE grade_benefits DROP COLUMN IF EXISTS benefit_name;

-- Enforce one benefit_type per grade (deduplicate first if needed)
DELETE FROM grade_benefits a
USING grade_benefits b
WHERE a.id > b.id
  AND a.grade_id = b.grade_id
  AND a.benefit_type = b.benefit_type;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_grade_benefit_type'
      AND conrelid = 'grade_benefits'::regclass
  ) THEN
    ALTER TABLE grade_benefits
      ADD CONSTRAINT uq_grade_benefit_type UNIQUE (grade_id, benefit_type);
  END IF;
END;
$$;
