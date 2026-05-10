-- Migration: Enhance Leaves Table for Approval Workflow
-- Date: May 2026
-- Description: Add approval workflow columns and approver tracking

ALTER TABLE leaves
ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS manager_comments TEXT,
ADD COLUMN IF NOT EXISTS approval_status VARCHAR DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS is_comp_off BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS comp_off_request_id UUID;

CREATE INDEX IF NOT EXISTS idx_leaves_approval_status ON leaves(approval_status);
CREATE INDEX IF NOT EXISTS idx_leaves_approved_by ON leaves(approved_by);
CREATE INDEX IF NOT EXISTS idx_leaves_is_comp_off ON leaves(is_comp_off);

-- Leave approvers mapping table
CREATE TABLE IF NOT EXISTS leave_approvers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  approval_level INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, approver_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_leave_approvers_employee ON leave_approvers(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvers_approver ON leave_approvers(approver_id);
CREATE INDEX IF NOT EXISTS idx_leave_approvers_company ON leave_approvers(company_id);

-- Leave types configuration table
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  description TEXT,
  days_per_year INTEGER NOT NULL,
  requires_approval BOOLEAN DEFAULT TRUE,
  allow_half_day BOOLEAN DEFAULT FALSE,
  color VARCHAR DEFAULT '#3B82F6',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_leave_types_company ON leave_types(company_id);

-- Employee leave balance table
CREATE TABLE IF NOT EXISTS employee_leave_balance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_days INTEGER NOT NULL,
  used_days INTEGER DEFAULT 0,
  pending_days INTEGER DEFAULT 0,
  remaining_days INTEGER GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balance_employee ON employee_leave_balance(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balance_year ON employee_leave_balance(year);

-- Insert default leave types for companies
INSERT INTO leave_types (company_id, name, days_per_year, requires_approval, allow_half_day, color)
SELECT
  c.id,
  leave_type,
  days,
  TRUE,
  allow_half,
  color
FROM companies c
CROSS JOIN (
  VALUES
    ('Vacation', 20, TRUE, '#3B82F6'),
    ('Sick Leave', 10, FALSE, '#EF4444'),
    ('Personal Leave', 5, TRUE, '#8B5CF6'),
    ('Maternity Leave', 60, TRUE, '#EC4899'),
    ('Paternity Leave', 5, TRUE, '#EC4899'),
    ('Bereavement Leave', 3, FALSE, '#6B7280'),
    ('Unpaid Leave', 0, TRUE, '#9CA3AF')
) AS t(leave_type, days, allow_half, color)
ON CONFLICT (company_id, name) DO NOTHING;

-- Function to get pending approvals for a manager
CREATE OR REPLACE FUNCTION get_pending_leave_approvals(p_approver_id UUID, p_company_id UUID)
RETURNS TABLE (
  leave_id UUID,
  employee_id UUID,
  employee_name VARCHAR,
  leave_type VARCHAR,
  start_date DATE,
  end_date DATE,
  days INTEGER,
  reason TEXT,
  requested_on TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.employee_id,
    e.first_name || ' ' || e.last_name,
    l.leave_type,
    l.start_date,
    l.end_date,
    l.days,
    l.reason,
    l.created_at
  FROM leaves l
  JOIN employees e ON l.employee_id = e.id
  JOIN leave_approvers la ON e.id = la.employee_id
  WHERE la.approver_id = p_approver_id
    AND la.company_id = p_company_id
    AND l.approval_status = 'pending'
    AND e.company_id = p_company_id
  ORDER BY l.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to approve leave
CREATE OR REPLACE FUNCTION approve_leave(
  p_leave_id UUID,
  p_approver_id UUID,
  p_comments TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE leaves
  SET
    approval_status = 'approved',
    approved_by = p_approver_id,
    approval_date = NOW(),
    manager_comments = p_comments
  WHERE id = p_leave_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reject leave
CREATE OR REPLACE FUNCTION reject_leave(
  p_leave_id UUID,
  p_approver_id UUID,
  p_rejection_reason TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  UPDATE leaves
  SET
    approval_status = 'rejected',
    approved_by = p_approver_id,
    approval_date = NOW(),
    rejection_reason = p_rejection_reason
  WHERE id = p_leave_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to initialize leave balance for new employee
CREATE OR REPLACE FUNCTION initialize_employee_leave_balance(
  p_employee_id UUID,
  p_company_id UUID,
  p_year INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO employee_leave_balance (employee_id, leave_type_id, year, total_days)
  SELECT
    p_employee_id,
    lt.id,
    p_year,
    lt.days_per_year
  FROM leave_types lt
  WHERE lt.company_id = p_company_id
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create view for leave dashboard
CREATE OR REPLACE VIEW leave_dashboard AS
SELECT
  e.id as employee_id,
  e.first_name || ' ' || e.last_name as employee_name,
  e.company_id,
  lt.name as leave_type,
  elb.total_days,
  elb.used_days,
  elb.pending_days,
  elb.remaining_days,
  elb.year,
  ROUND((elb.used_days::NUMERIC / NULLIF(elb.total_days, 0) * 100)::NUMERIC, 2) as usage_percentage
FROM employee_leave_balance elb
JOIN employees e ON elb.employee_id = e.id
JOIN leave_types lt ON elb.leave_type_id = lt.id
ORDER BY e.company_id, e.id, lt.name;

GRANT SELECT ON leave_types TO authenticated;
GRANT SELECT ON employee_leave_balance TO authenticated;
GRANT SELECT ON leave_approvers TO authenticated;
GRANT SELECT ON leave_dashboard TO authenticated;
