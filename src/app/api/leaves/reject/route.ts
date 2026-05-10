import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkPermission } from '@/lib/rbac';
import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const { leave_id, rejected_by, reason, company_id } = await request.json();

    if (!leave_id || !rejected_by || !reason || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const hasPermission = await checkPermission(
      rejected_by,
      company_id,
      'leaves',
      'approve'
    );

    if (!hasPermission.allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to reject leaves' },
        { status: 403 }
      );
    }

    const { data: leave, error: fetchError } = await supabase
      .from('leaves')
      .select('*')
      .eq('id', leave_id)
      .single();

    if (fetchError || !leave) {
      return NextResponse.json(
        { error: 'Leave not found' },
        { status: 404 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('leaves')
      .update({
        approval_status: 'rejected',
        approved_by: rejected_by,
        approval_date: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', leave_id)
      .select();

    if (updateError) {
      throw updateError;
    }

    const headers = {
      'x-forwarded-for': request.headers.get('x-forwarded-for') || '',
      'user-agent': request.headers.get('user-agent') || '',
    };

    await logAuditEvent({
      user_id: rejected_by,
      company_id,
      action: 'reject_leave',
      resource_type: 'leaves',
      resource_id: leave_id,
      status: 'success',
      old_values: { approval_status: leave.approval_status },
      new_values: {
        approval_status: 'rejected',
        rejection_reason: reason,
      },
      ip_address: getIpAddress(headers) || undefined,
      user_agent: getUserAgent(headers) || undefined,
    });

    return NextResponse.json({
      success: true,
      data: updated?.[0],
    });
  } catch (error) {
    console.error('Error in reject leave route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
