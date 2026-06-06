-- Migration: Create Audit Logging Tables
-- Date: May 2026
-- Description: Implement comprehensive audit trail for all system activities

-- Audit logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  action VARCHAR NOT NULL,
  resource_type VARCHAR NOT NULL,
  resource_id UUID,
  resource_name VARCHAR,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR,
  user_agent TEXT,
  status VARCHAR DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Activity logs table
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  activity_type VARCHAR NOT NULL,
  description TEXT,
  metadata JSONB,
  ip_address VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_company_id ON activity_logs(company_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_type ON activity_logs(activity_type);

-- Audit log retention policy table
CREATE TABLE audit_log_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  resource_type VARCHAR NOT NULL,
  retention_days INTEGER DEFAULT 365,
  archive_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, resource_type)
);

INSERT INTO audit_log_policies (company_id, resource_type, retention_days, archive_enabled)
SELECT
  companies.id,
  resource_type,
  CASE
    WHEN resource_type IN ('users', 'roles', 'permissions') THEN 730
    WHEN resource_type IN ('leaves', 'payroll') THEN 365
    ELSE 180
  END,
  TRUE
FROM companies
CROSS JOIN (
  VALUES
    ('users'),
    ('roles'),
    ('permissions'),
    ('employees'),
    ('leaves'),
    ('payroll'),
    ('attendance'),
    ('companies')
) AS t(resource_type)
ON CONFLICT (company_id, resource_type) DO NOTHING;

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_company_id UUID,
  p_action VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id UUID,
  p_resource_name VARCHAR,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_status VARCHAR DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    company_id,
    action,
    resource_type,
    resource_id,
    resource_name,
    old_values,
    new_values,
    ip_address,
    user_agent,
    status,
    error_message
  ) VALUES (
    p_user_id,
    p_company_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent,
    p_status,
    p_error_message
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_activity_event(
  p_user_id UUID,
  p_company_id UUID,
  p_activity_type VARCHAR,
  p_description TEXT,
  p_metadata JSONB DEFAULT NULL,
  p_ip_address VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO activity_logs (
    user_id,
    company_id,
    activity_type,
    description,
    metadata,
    ip_address
  ) VALUES (
    p_user_id,
    p_company_id,
    p_activity_type,
    p_description,
    p_metadata,
    p_ip_address
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW audit_log_search AS
SELECT
  al.id,
  al.user_id,
  u.first_name || ' ' || u.last_name as user_name,
  al.company_id,
  c.name as company_name,
  al.action,
  al.resource_type,
  al.resource_id,
  al.resource_name,
  al.status,
  al.created_at,
  al.ip_address,
  (al.old_values IS NOT NULL OR al.new_values IS NOT NULL) as has_changes
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN companies c ON al.company_id = c.id;

-- Enable RLS on audit tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to INSERT their own audit logs
CREATE POLICY "Users can insert their own audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR auth.uid() IS NOT NULL);

-- Allow authenticated users to SELECT audit logs for their company
CREATE POLICY "Users can view company audit logs" ON audit_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
    )
    OR auth.role() = 'authenticated'
  );

-- Allow activity log inserts
CREATE POLICY "Users can insert activity logs" ON activity_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow activity log selects
CREATE POLICY "Users can view activity logs" ON activity_logs
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_company_roles
      WHERE user_id = auth.uid()
    )
    OR auth.uid() = user_id
  );

-- Grant permissions
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT ON activity_logs TO authenticated;
GRANT SELECT ON audit_log_policies TO authenticated;
GRANT SELECT ON audit_log_search TO authenticated;
