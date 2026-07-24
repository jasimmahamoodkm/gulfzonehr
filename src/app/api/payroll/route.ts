import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// POST /api/payroll  — process payroll for a single employee
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
      employee_id, month, salary, bonus, deductions,
      net_pay, status, company_id,
      leave_deduction_days, leave_deduction_amount,
      adjustment, adjustment_note,
    } = body;

    if (!employee_id || !month || salary === undefined || net_pay === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for existing record for this month
    const { data: existing } = await supabaseAdmin
      .from('payroll')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('month', month)
      .maybeSingle();

    let payrollRecord: any;

    if (existing) {
      // Update existing record
      const { data, error: dbError } = await supabaseAdmin
        .from('payroll')
        .update({
          salary, bonus: bonus ?? 0, deductions: deductions ?? 0,
          net_pay, status: status ?? 'Processed',
          leave_deduction_days: leave_deduction_days ?? 0,
          leave_deduction_amount: leave_deduction_amount ?? 0,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
      payrollRecord = data;
    } else {
      // Insert new record (payroll table has no company_id column — used for audit only)
      const payload: any = {
        employee_id, month,
        salary, bonus: bonus ?? 0, deductions: deductions ?? 0,
        net_pay, status: status ?? 'Processed',
      };
      if (leave_deduction_days !== undefined) payload.leave_deduction_days = leave_deduction_days;
      if (leave_deduction_amount !== undefined) payload.leave_deduction_amount = leave_deduction_amount;
      // Manual one-off adjustment (migration 028) — only sent when used
      if (adjustment !== undefined) payload.adjustment = adjustment;
      if (adjustment_note !== undefined) payload.adjustment_note = adjustment_note;

      const { data, error: dbError } = await supabaseAdmin
        .from('payroll')
        .insert(payload)
        .select()
        .single();

      if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
      payrollRecord = data;
    }

    // Fetch employee name for audit log
    const { data: empData } = await supabaseAdmin
      .from('employees')
      .select('first_name, last_name')
      .eq('id', employee_id)
      .single();

    const empName = empData ? `${empData.first_name} ${empData.last_name}` : employee_id;

    // Audit log
    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({
        user_id: user.id,
        company_id: company_id ?? null,
        action: existing ? 'update_payroll' : 'create_payroll',
        resource_type: 'payroll',
        resource_id: payrollRecord.id,
        resource_name: `Payroll ${month} — ${empName}`,
        status: 'success',
        ip_address: getIpAddress(hdrs),
        user_agent: getUserAgent(hdrs),
      });
    } catch (_) {}

    return NextResponse.json({ data: payrollRecord }, { status: existing ? 200 : 201 });
  } catch (err) {
    console.error('Payroll API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/payroll?id=<payroll_id>  — delete a payroll record
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const payrollId = searchParams.get('id');
    if (!payrollId) {
      return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
    }

    // Fetch before delete for audit
    const { data: existing } = await supabaseAdmin
      .from('payroll')
      .select('id, employee_id, month, employees(first_name, last_name)')
      .eq('id', payrollId)
      .single();

    const { error: dbError } = await supabaseAdmin
      .from('payroll')
      .delete()
      .eq('id', payrollId);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    try {
      const emp = existing?.employees as any;
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : payrollId;
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({
        user_id: user.id,
        company_id: undefined,
        action: 'delete_payroll',
        resource_type: 'payroll',
        resource_id: payrollId as any,
        resource_name: `Payroll ${existing?.month} — ${empName}`,
        status: 'success',
        ip_address: getIpAddress(hdrs),
        user_agent: getUserAgent(hdrs),
      });
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
