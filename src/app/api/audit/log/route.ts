import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Generic client-callable audit logging endpoint.
 * Used by client components that perform their DB operations directly
 * (grade assignment, document creation, RBAC changes).
 *
 * The caller's identity is taken from the JWT, NOT from the request body,
 * so the logged user_id cannot be spoofed.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      company_id,
      action,
      resource_type,
      resource_id,
      resource_name,
      old_values,
      new_values,
      status,
    } = body;

    if (!action || !resource_type) {
      return NextResponse.json({ error: 'Missing required fields: action, resource_type' }, { status: 400 });
    }

    const hdrs = Object.fromEntries(request.headers.entries());

    await logAuditEvent({
      user_id: user.id,                  // from JWT — trusted
      company_id: company_id ?? undefined,
      action,
      resource_type,
      resource_id: resource_id ?? undefined,
      resource_name: resource_name ?? undefined,
      old_values: old_values ?? undefined,
      new_values: new_values ?? undefined,
      status: status ?? 'success',
      ip_address: getIpAddress(hdrs),
      user_agent: getUserAgent(hdrs),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    // Audit logging is non-critical — never fail the caller's flow
    console.warn('Audit log endpoint error:', err);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
