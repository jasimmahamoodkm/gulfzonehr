/**
 * Returns the correct API URL with basePath prefix.
 * Use this for ALL fetch('/api/...') calls in client components.
 *
 * Example:
 *   fetch(apiUrl('/api/admin/grades'))
 *   fetch(apiUrl(`/api/admin/grades/${id}`))
 */
export function apiUrl(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  // Avoid double-prefix
  if (basePath && path.startsWith(basePath + '/')) return path;
  return `${basePath}${path}`;
}

/**
 * Client-side audit logging helper.
 * Fire-and-forget — logs an activity to the audit trail without blocking the UI.
 * The user identity is derived server-side from the JWT, not from the payload.
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase';
 *   await logActivity(supabase, { action: 'assign_grade', resource_type: 'employees', ... });
 */
export async function logActivity(
  supabaseClient: { auth: { getSession: () => Promise<{ data: { session: { access_token?: string } | null } }> } },
  entry: {
    company_id?: string | null;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    resource_name?: string | null;
    old_values?: unknown;
    new_values?: unknown;
    status?: string;
  }
): Promise<void> {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    await fetch(apiUrl('/api/audit/log'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
    });
  } catch {
    // Non-critical — never throw from audit logging
  }
}
