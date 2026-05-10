import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const approver_id = request.nextUrl.searchParams.get('approver_id');
    const company_id = request.nextUrl.searchParams.get('company_id');

    if (!approver_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing approver_id or company_id' },
        { status: 400 }
      );
    }

    // Get leave approvers mapping for this manager
    const { data: approverMappings, error: mappingError } = await supabase
      .from('leave_approvers')
      .select('employee_id')
      .eq('approver_id', approver_id)
      .eq('company_id', company_id)
      .eq('active', true);

    if (mappingError) throw mappingError;

    const employeeIds = (approverMappings || []).map(m => m.employee_id);

    if (employeeIds.length === 0) {
      return NextResponse.json({
        success: true,
        pending_approvals: [],
        count: 0,
      });
    }

    // Get pending leaves for these employees
    const { data: leaves, error: leaveError } = await supabase
      .from('leaves')
      .select(`
        id,
        employee_id,
        employees(first_name, last_name),
        leave_type,
        start_date,
        end_date,
        days,
        reason,
        approval_status,
        created_at,
        company_id
      `)
      .eq('company_id', company_id)
      .eq('approval_status', 'pending')
      .in('employee_id', employeeIds)
      .order('created_at', { ascending: true });

    if (leaveError) throw leaveError;

    // Transform response
    const pendingApprovals = (leaves || []).map(leave => ({
      leave_id: leave.id,
      employee_id: leave.employee_id,
      employee_name: `${(leave.employees as any)?.first_name} ${(leave.employees as any)?.last_name}`,
      leave_type: leave.leave_type,
      start_date: leave.start_date,
      end_date: leave.end_date,
      days: leave.days,
      reason: leave.reason,
      requested_on: leave.created_at,
      days_until_leave: Math.floor(
        (new Date(leave.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

    return NextResponse.json({
      success: true,
      pending_approvals: pendingApprovals,
      count: pendingApprovals.length,
      urgent_count: pendingApprovals.filter(
        p => p.days_until_leave <= 7 && p.days_until_leave >= 0
      ).length,
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending approvals' },
      { status: 500 }
    );
  }
}
