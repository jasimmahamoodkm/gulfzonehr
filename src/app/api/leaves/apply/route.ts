import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      days,
      reason,
      user_id,
      company_id,
    } = body;

    // Validate required fields
    if (!employee_id || !leave_type_id || !start_date || !end_date || !days || !user_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check leave balance
    const { data: balanceData, error: balanceError } = await supabase
      .from('employee_leave_balance')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('leave_type_id', leave_type_id)
      .eq('year', new Date().getFullYear())
      .single();

    if (balanceError && balanceError.code !== 'PGRST116') {
      throw balanceError;
    }

    if (balanceData) {
      const availableDays = balanceData.total_days - balanceData.used_days - balanceData.pending_days;
      if (days > availableDays) {
        await logAuditEvent({
          user_id,
          company_id,
          action: 'apply_leave',
          resource_type: 'leaves',
          resource_id: employee_id,
          status: 'failure',
          error_message: `Insufficient leave balance. Available: ${availableDays} days, Requested: ${days} days`,
        });

        return NextResponse.json(
          { error: `Insufficient leave balance. Available: ${availableDays} days` },
          { status: 400 }
        );
      }
    }

    // Create leave request
    const { data: leaveData, error: leaveError } = await supabase
      .from('leaves')
      .insert({
        employee_id,
        leave_type: (await supabase.from('leave_types').select('name').eq('id', leave_type_id).single()).data?.name || 'Leave',
        start_date,
        end_date,
        days,
        reason,
        approval_status: 'pending',
        is_comp_off: false,
        company_id,
      })
      .select()
      .single();

    if (leaveError) throw leaveError;

    // Update pending days in leave balance
    if (balanceData) {
      await supabase
        .from('employee_leave_balance')
        .update({
          pending_days: balanceData.pending_days + days,
          last_updated: new Date().toISOString(),
        })
        .eq('id', balanceData.id);
    }

    // Log audit event
    await logAuditEvent({
      user_id,
      company_id,
      action: 'apply_leave',
      resource_type: 'leaves',
      resource_id: leaveData.id,
      resource_name: `Leave from ${start_date} to ${end_date}`,
      status: 'success',
    });

    return NextResponse.json(
      {
        success: true,
        leave_id: leaveData.id,
        message: 'Leave request submitted successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error applying for leave:', error);
    return NextResponse.json(
      { error: 'Failed to apply for leave' },
      { status: 500 }
    );
  }
}
