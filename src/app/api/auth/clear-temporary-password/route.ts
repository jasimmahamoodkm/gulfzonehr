import { NextRequest, NextResponse } from 'next/server';
import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {

    // Get the authorization header
    const authHeader = request.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    // Initialize Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get current user session from the auth header
    const token = authHeader.substring(7);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
      console.error('Failed to get user from token:', userError.message);
      console.error('Error code:', userError.code);
      return NextResponse.json({ error: `Unauthorized: ${userError.message}` }, { status: 401 });
    }

    if (!user) {
      console.error('User not found in token');
      return NextResponse.json({ error: 'Unauthorized: No user in token' }, { status: 401 });
    }


    // Clear the temporary password flag by updating user metadata
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          is_temporary_password: false,
        },
      }
    );

    if (updateError) {
      console.error('Failed to clear temporary password flag:', updateError.message);
      return NextResponse.json(
        { error: `Failed to clear temporary password flag: ${updateError.message}` },
        { status: 500 }
      );
    }


    // Log audit event (non-blocking)
    try {
      const ipAddress = getIpAddress(Object.fromEntries(request.headers.entries()));
      const userAgent = getUserAgent(Object.fromEntries(request.headers.entries()));

      // Get user company (non-blocking, don't fail if this fails)
      let companyId: string | undefined = undefined;
      try {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('company_id')
          .eq('id', user.id)
          .single();
        companyId = (userData as any)?.company_id;
      } catch (err) {
        console.warn('Warning: Could not fetch user company:', err);
      }

      await logAuditEvent({
        user_id: user.id,
        company_id: companyId,
        action: 'update_password',
        resource_type: 'users',
        resource_id: user.id,
        resource_name: `Password updated - ${user.email}`,
        status: 'success',
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    } catch (auditError) {
      console.warn('Audit logging failed (non-critical):', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Temporary password flag cleared',
      user_email: user.email,
    });
  } catch (error) {
    console.error('Error in clear-temporary-password endpoint:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: `Internal server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
