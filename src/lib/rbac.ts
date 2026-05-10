/**
 * RBAC (Role-Based Access Control) Utility Library
 * Provides permission checking, role management, and access control functions
 */

import { createClient } from '@supabase/supabase-js';
import type { PermissionCheckResult } from '@/types/rbac';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Check if a user has a specific permission
 * @param userId - The user ID to check
 * @param companyId - The company context
 * @param resource - The resource to access
 * @param action - The action to perform
 * @returns PermissionCheckResult with allowed flag and reason
 */
export async function checkPermission(
  userId: string,
  companyId: string,
  resource: string,
  action: string
): Promise<PermissionCheckResult> {
  try {
    // Get user's roles in this company
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (roleError || !userRoles || userRoles.length === 0) {
      return {
        allowed: false,
        reason: 'User has no roles assigned in this company',
      };
    }

    const roleIds = userRoles.map(ur => ur.role_id);

    // Check if any of the user's roles have this permission
    const { data: permissions, error: permError } = await supabase
      .from('role_permissions')
      .select('*')
      .in('role_id', roleIds)
      .eq('resource', resource)
      .eq('action', action);

    if (permError) {
      return {
        allowed: false,
        reason: `Error checking permissions: ${permError.message}`,
      };
    }

    if (permissions && permissions.length > 0) {
      return {
        allowed: true,
      };
    }

    return {
      allowed: false,
      reason: `User does not have ${action} permission for ${resource}`,
    };
  } catch (error) {
    return {
      allowed: false,
      reason: `Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get all permissions for a user in a company
 * @param userId - The user ID
 * @param companyId - The company ID
 * @returns Array of permissions
 */
export async function getUserPermissions(userId: string, companyId: string) {
  try {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', userId)
      .eq('company_id', companyId);

    if (!userRoles || userRoles.length === 0) {
      return [];
    }

    const roleIds = userRoles.map(ur => ur.role_id);

    const { data: permissions } = await supabase
      .from('role_permissions')
      .select('*')
      .in('role_id', roleIds);

    return permissions || [];
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}

/**
 * Get all roles for a user in a company
 * @param userId - The user ID
 * @param companyId - The company ID
 * @returns Array of roles
 */
export async function getUserRoles(userId: string, companyId: string) {
  try {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role:roles(*)')
      .eq('user_id', userId)
      .eq('company_id', companyId);

    return userRoles?.map(ur => ur.role) || [];
  } catch (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }
}

/**
 * Assign a role to a user
 * @param userId - The user ID
 * @param roleId - The role ID
 * @param companyId - The company ID
 * @param assignedBy - The user assigning the role (admin)
 * @returns Success status
 */
export async function assignRole(
  userId: string,
  roleId: string,
  companyId: string,
  assignedBy: string
) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .insert([
        {
          user_id: userId,
          role_id: roleId,
          company_id: companyId,
          assigned_by: assignedBy,
        },
      ]);

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a role from a user
 * @param userId - The user ID
 * @param roleId - The role ID
 * @param companyId - The company ID
 * @returns Success status
 */
export async function removeRole(userId: string, roleId: string, companyId: string) {
  try {
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .eq('company_id', companyId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all roles in a company
 * @param companyId - The company ID
 * @returns Array of roles
 */
export async function getCompanyRoles(companyId: string) {
  try {
    const { data: roles } = await supabase
      .from('roles')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    return roles || [];
  } catch (error) {
    console.error('Error fetching company roles:', error);
    return [];
  }
}

/**
 * Create a new role in a company
 * @param name - Role name
 * @param description - Role description
 * @param companyId - The company ID
 * @returns Created role
 */
export async function createRole(
  name: string,
  description: string,
  companyId: string
) {
  try {
    const { data, error } = await supabase
      .from('roles')
      .insert([
        {
          name,
          description,
          company_id: companyId,
          is_system: false,
        },
      ])
      .select();

    if (error) {
      throw error;
    }

    return { success: true, data: data?.[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Grant a permission to a role
 * @param roleId - The role ID
 * @param resource - The resource
 * @param action - The action
 * @returns Success status
 */
export async function grantPermission(
  roleId: string,
  resource: string,
  action: string
) {
  try {
    const { data, error } = await supabase
      .from('role_permissions')
      .insert([
        {
          role_id: roleId,
          resource,
          action,
        },
      ]);

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revoke a permission from a role
 * @param roleId - The role ID
 * @param resource - The resource
 * @param action - The action
 * @returns Success status
 */
export async function revokePermission(
  roleId: string,
  resource: string,
  action: string
) {
  try {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('resource', resource)
      .eq('action', action);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if user can access a specific resource
 * Checks if user has at least one permission for the resource
 * @param userId - The user ID
 * @param companyId - The company ID
 * @param resource - The resource to access
 * @returns Boolean indicating access
 */
export async function canAccessResource(
  userId: string,
  companyId: string,
  resource: string
): Promise<boolean> {
  try {
    const permissions = await getUserPermissions(userId, companyId);
    return permissions.some(p => p.resource === resource);
  } catch (error) {
    console.error('Error checking resource access:', error);
    return false;
  }
}

/**
 * Check if user is an admin (Super Admin or Company Admin)
 * @param userId - The user ID
 * @param companyId - The company ID (optional, if provided checks Company Admin)
 * @returns Boolean indicating if user is admin
 */
export async function isAdmin(userId: string, companyId?: string): Promise<boolean> {
  try {
    const query = supabase
      .from('user_roles')
      .select('role:roles(name)')
      .eq('user_id', userId);

    if (companyId) {
      query.eq('company_id', companyId);
    }

    const { data: userRoles } = await query as any;

    if (!userRoles || userRoles.length === 0) {
      return false;
    }

    return userRoles.some(
      (ur: any) =>
        ur.role?.name === 'Super Admin' ||
        (companyId && ur.role?.name === 'Company Admin')
    );
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
