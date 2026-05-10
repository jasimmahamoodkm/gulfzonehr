-- Migration: Create RBAC (Role-Based Access Control) Tables
-- Date: May 2026
-- Description: Implement role management and permission system

-- Roles table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL UNIQUE,
  description TEXT,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster role lookups
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_company_id ON roles(company_id);

-- Role Permissions table
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource VARCHAR NOT NULL,
  action VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, resource, action)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_resource ON role_permissions(resource);

-- User Roles junction table (many-to-many)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES users(id),
  UNIQUE(user_id, role_id, company_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_company_id ON user_roles(company_id);

-- Insert default system roles
INSERT INTO roles (name, description, is_system) VALUES
  ('Super Admin', 'System administrator with full access', TRUE),
  ('Company Admin', 'Administrator for a specific company', TRUE),
  ('HR Manager', 'HR department manager with leave and payroll approvals', TRUE),
  ('Department Manager', 'Department manager who approves team leaves', TRUE),
  ('Employee', 'Regular employee with self-service access', TRUE)
ON CONFLICT (name) DO NOTHING;
