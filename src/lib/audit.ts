/**
 * Audit Logging Utility Library
 * Provides functions for logging audit events and activity
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase as appClient } from '@/lib/supabase';
import type { CreateAuditLogRequest, AuditLogFilter, AuditLogSearchResult } from '@/types/audit';

// Server (API routes): a dedicated service-role client so audit inserts bypass
// RLS (SUPABASE_SERVICE_ROLE_KEY is never exposed to the client bundle).
// Browser (pages that log activity): REUSE the app's singleton — creating a
// second client here shipped a duplicate GoTrueClient (extra auth listeners /
// storage handling) to every page importing this module.
const supabase: SupabaseClient =
  typeof window === 'undefined'
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
    : (appClient as SupabaseClient);

/**
 * Log an audit event (called from Supabase function via RPC)
 * @param request - The audit log details
 * @returns Success status
 */
export async function logAuditEvent(request: CreateAuditLogRequest) {
  const serializeError = (e: unknown): string =>
    e instanceof Error ? e.message : (typeof e === 'object' && e !== null ? JSON.stringify(e) : String(e));

  try {
    // Try RPC first; fall back to direct insert if function doesn't exist
    const { error: rpcError } = await supabase.rpc('log_audit_event', {
      p_user_id: request.user_id,
      p_company_id: request.company_id,
      p_action: request.action,
      p_resource_type: request.resource_type,
      p_resource_id: request.resource_id,
      p_resource_name: request.resource_name,
      p_old_values: request.old_values,
      p_new_values: request.new_values,
      p_ip_address: request.ip_address,
      p_user_agent: request.user_agent,
      p_status: request.status || 'success',
      p_error_message: request.error_message,
    });

    if (!rpcError) return { success: true };

    // RPC failed — fall back to direct insert
    // entity_type must be set (NOT NULL, no default in DB) — map from resource_type
    const { error: insertError } = await supabase.from('audit_logs').insert({
      user_id: request.user_id,
      company_id: request.company_id,
      action: request.action,
      entity_type: request.resource_type || '',   // NOT NULL column
      entity_id: request.resource_id || null,
      resource_type: request.resource_type,
      resource_id: request.resource_id || null,
      resource_name: request.resource_name || null,
      old_values: request.old_values || null,
      new_values: request.new_values || null,
      ip_address: request.ip_address || null,
      user_agent: request.user_agent || null,
      status: request.status || 'success',
      error_message: request.error_message || null,
    });

    if (insertError) {
      // Audit logging is non-critical — log a readable message and return gracefully
      console.warn('Audit log skipped:', serializeError(insertError));
      return { success: false, error: serializeError(insertError) };
    }

    return { success: true };
  } catch (e) {
    console.warn('Audit log skipped:', serializeError(e));
    return { success: false, error: serializeError(e) };
  }
}

/**
 * Log an activity event
 * @param userId - The user ID
 * @param companyId - The company ID
 * @param activityType - The activity type
 * @param description - The activity description
 * @param metadata - Optional metadata
 * @param ipAddress - Optional IP address
 * @returns Success status
 */
export async function logActivityEvent(
  userId: string,
  companyId: string,
  activityType: string,
  description: string,
  metadata?: Record<string, any>,
  ipAddress?: string
) {
  try {
    const { data, error } = await supabase.rpc('log_activity_event', {
      p_user_id: userId,
      p_company_id: companyId,
      p_activity_type: activityType,
      p_description: description,
      p_metadata: metadata,
      p_ip_address: ipAddress,
    });

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : (typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error));
    console.warn('Activity log skipped:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Get audit logs with optional filtering
 * @param filter - Filter criteria
 * @returns Audit logs search result
 */
export async function getAuditLogs(
  filter?: AuditLogFilter
): Promise<AuditLogSearchResult> {
  try {
    let query = supabase
      .from('audit_log_search')
      .select('*', { count: 'exact' });

    if (filter?.user_id) {
      query = query.eq('user_id', filter.user_id);
    }

    if (filter?.company_id) {
      query = query.eq('company_id', filter.company_id);
    }

    if (filter?.resource_type) {
      query = query.eq('resource_type', filter.resource_type);
    }

    if (filter?.action) {
      query = query.eq('action', filter.action);
    }

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    if (filter?.start_date) {
      query = query.gte('created_at', filter.start_date);
    }

    if (filter?.end_date) {
      query = query.lte('created_at', filter.end_date);
    }

    if (filter?.search_term) {
      query = query.or(
        `resource_name.ilike.%${filter.search_term}%,action.ilike.%${filter.search_term}%`
      );
    }

    const page = filter?.page || 1;
    const perPage = filter?.per_page || 50;
    const offset = (page - 1) * perPage;

    const { data: logs, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) {
      throw error;
    }

    return {
      total: count || 0,
      page,
      per_page: perPage,
      logs: logs || [],
    };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return {
      total: 0,
      page: filter?.page || 1,
      per_page: filter?.per_page || 50,
      logs: [],
    };
  }
}

/**
 * Get audit logs for a specific resource
 * @param resourceType - The resource type
 * @param resourceId - The resource ID
 * @returns Array of audit logs
 */
export async function getResourceAuditTrail(
  resourceType: string,
  resourceId: string
) {
  try {
    const { data: logs, error } = await supabase
      .from('audit_log_search')
      .select('*')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return logs || [];
  } catch (error) {
    console.error('Error fetching resource audit trail:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific user
 * @param userId - The user ID
 * @param companyId - Optional company ID filter
 * @returns Array of audit logs
 */
export async function getUserAuditTrail(userId: string, companyId?: string) {
  try {
    let query = supabase
      .from('audit_log_search')
      .select('*')
      .eq('user_id', userId);

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data: logs, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      throw error;
    }

    return logs || [];
  } catch (error) {
    console.error('Error fetching user audit trail:', error);
    return [];
  }
}

/**
 * Get audit log statistics
 * @param companyId - The company ID
 * @param startDate - Start date for statistics
 * @param endDate - End date for statistics
 * @returns Statistics object
 */
export async function getAuditStatistics(
  companyId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    let query = supabase
      .from('audit_logs')
      .select('action, resource_type, status', { count: 'exact' })
      .eq('company_id', companyId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: logs, count, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate statistics
    const byAction: Record<string, number> = {};
    const byResource: Record<string, number> = {};
    let failures = 0;

    logs?.forEach(log => {
      // Count by action
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // Count by resource
      byResource[log.resource_type] = (byResource[log.resource_type] || 0) + 1;

      // Count failures
      if (log.status === 'failure') {
        failures++;
      }
    });

    const successRate = count ? ((count - failures) / count) * 100 : 0;

    return {
      total_logs: count || 0,
      logs_by_action: byAction,
      logs_by_resource: byResource,
      success_rate: Math.round(successRate * 100) / 100,
      recent_failures: logs?.filter(l => l.status === 'failure').slice(0, 10) || [],
    };
  } catch (error) {
    console.error('Error calculating audit statistics:', error);
    return {
      total_logs: 0,
      logs_by_action: {},
      logs_by_resource: {},
      success_rate: 0,
      recent_failures: [],
    };
  }
}

/**
 * Export audit logs to CSV format
 * @param filter - Filter criteria
 * @returns CSV string
 */
export async function exportAuditLogsCSV(filter?: AuditLogFilter): Promise<string> {
  try {
    const result = await getAuditLogs({ ...filter, per_page: 10000 });

    if (result.logs.length === 0) {
      return 'No audit logs found';
    }

    const headers = [
      'ID',
      'User',
      'Company',
      'Action',
      'Resource Type',
      'Resource ID',
      'Resource Name',
      'Status',
      'IP Address',
      'Created At',
    ];

    const rows = result.logs.map(log => [
      log.id,
      log.user_name || 'Unknown',
      log.company_name || 'Unknown',
      log.action,
      log.resource_type,
      log.resource_id || '',
      log.resource_name || '',
      log.status,
      log.ip_address || '',
      log.created_at,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return 'Error exporting audit logs';
  }
}

/**
 * Get IP address from request headers
 * @param headers - Request headers
 * @returns IP address or null
 */
export function getIpAddress(headers?: Record<string, string>): string | undefined {
  if (!headers) return undefined;

  return (
    headers['x-forwarded-for']?.split(',')[0] ||
    headers['x-real-ip'] ||
    headers['cf-connecting-ip'] ||
    undefined
  );
}

/**
 * Get user agent from request headers
 * @param headers - Request headers
 * @returns User agent or null
 */
export function getUserAgent(headers?: Record<string, string>): string | undefined {
  if (!headers) return undefined;
  return headers['user-agent'] || undefined;
}
