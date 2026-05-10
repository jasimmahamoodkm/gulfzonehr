import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/rbac';
import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const { user_id, company_id, resource, action } = await request.json();

    if (!user_id || !company_id || !resource || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await checkPermission(user_id, company_id, resource, action);

    const headers = {
      'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
      'user-agent': request.headers.get('user-agent') || '',
    };

    await logAuditEvent({
      user_id,
      company_id,
      action: 'check_permission',
      resource_type: resource,
      status: 'success',
      new_values: {
        resource,
        action,
        allowed: result.allowed,
      },
      ip_address: getIpAddress(headers) || undefined,
      user_agent: getUserAgent(headers) || undefined,
    });

    return NextResponse.json({
      allowed: result.allowed,
      reason: result.reason,
    });
  } catch (error) {
    console.error('Error in check-permission route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
