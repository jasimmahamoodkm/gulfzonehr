import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function getCompanyId(request: NextRequest): Promise<{ companyId: string | null; error: NextResponse | null }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { companyId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const token = authHeader.substring(7);
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return { companyId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: userData } = await supabaseAdmin.from('users').select('company_id').eq('id', user.id).single();
  const companyId = userData?.company_id ?? null;
  if (!companyId) {
    return { companyId: null, error: NextResponse.json({ error: 'No company associated with user' }, { status: 403 }) };
  }
  return { companyId, error: null };
}

async function verifyGradeOwnership(gradeId: string, companyId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('employee_grades')
    .select('id')
    .eq('id', gradeId)
    .eq('company_id', companyId)
    .single();
  return !!data;
}

/**
 * Record a salary-change history row for every active employee on a grade.
 * Called whenever the grade's effective salary changes. Non-blocking.
 */
async function recordGradeSalaryHistory(
  gradeId: string, companyId: string | null,
  oldSalary: number | null, newSalary: number, currency: string,
  effectiveFrom: string, changedBy?: string
) {
  try {
    const effectiveMonth = (effectiveFrom || new Date().toISOString()).slice(0, 7); // YYYY-MM
    const { data: emps } = await supabaseAdmin
      .from('employees')
      .select('id, first_name, last_name')
      .eq('grade_id', gradeId);
    if (!emps || emps.length === 0) return;
    const rows = emps.map((e: any) => ({
      employee_id: e.id,
      company_id: companyId,
      change_type: 'salary',
      old_grade_id: gradeId,
      new_grade_id: gradeId,
      old_salary: oldSalary,
      new_salary: newSalary,
      currency,
      effective_month: effectiveMonth,
      changed_by: changedBy ?? null,
      note: `Grade salary updated for ${e.first_name} ${e.last_name}`,
    }));
    await supabaseAdmin.from('employee_change_history').insert(rows);
  } catch (err) {
    console.warn('recordGradeSalaryHistory failed (non-critical):', err);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, error } = await getCompanyId(request);
    if (error) return error;

    const { id: gradeId } = await params;

    if (!(await verifyGradeOwnership(gradeId, companyId!))) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }

    const { data, error: dbError } = await supabaseAdmin
      .from('grade_salary_config')
      .select('*')
      .eq('grade_id', gradeId)
      .eq('company_id', companyId!)
      .order('effective_from', { ascending: false });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, error } = await getCompanyId(request);
    if (error) return error;

    const { id: gradeId } = await params;

    if (!(await verifyGradeOwnership(gradeId, companyId!))) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }

    const body = await request.json();
    const { salary, salary_component = 'Basic Salary', currency = 'AED', effective_from, effective_to, notes } = body;

    if (salary === undefined || !effective_from) {
      return NextResponse.json({ error: 'Missing required fields: salary, effective_from' }, { status: 400 });
    }

    const { data, error: dbError } = await supabaseAdmin
      .from('grade_salary_config')
      .insert({
        grade_id: gradeId,
        company_id: companyId,
        salary_component: salary_component || 'Basic Salary',
        salary: Number(salary),
        currency,
        effective_from,
        effective_to: effective_to || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    let usrId: string | undefined;
    try {
      const { data: { user: usr } } = await supabaseAdmin.auth.getUser(request.headers.get('Authorization')!.substring(7));
      usrId = usr?.id;
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: usr?.id, company_id: companyId!, action: 'create_salary_config', resource_type: 'grade_salary_config', resource_id: data.id, resource_name: `Salary config for grade ${gradeId}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}

    // Record per-employee salary-change history (prior effective salary -> new)
    const { data: prior } = await supabaseAdmin
      .from('grade_salary_config')
      .select('salary')
      .eq('grade_id', gradeId)
      .lt('effective_from', effective_from)
      .order('effective_from', { ascending: false })
      .limit(1);
    await recordGradeSalaryHistory(
      gradeId, companyId, prior?.[0]?.salary ?? null, Number(salary), currency, effective_from, usrId
    );

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, error } = await getCompanyId(request);
    if (error) return error;

    const { id: gradeId } = await params;

    if (!(await verifyGradeOwnership(gradeId, companyId!))) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }

    const body = await request.json();
    const { config_id, salary, salary_component, currency, effective_from, effective_to, notes } = body;

    if (!config_id) {
      return NextResponse.json({ error: 'Missing required field: config_id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (salary_component !== undefined) updates.salary_component = salary_component;
    if (salary !== undefined) updates.salary = Number(salary);
    if (currency !== undefined) updates.currency = currency;
    if (effective_from !== undefined) updates.effective_from = effective_from;
    if (effective_to !== undefined) updates.effective_to = effective_to || null;
    if (notes !== undefined) updates.notes = notes || null;

    const { data, error: dbError } = await supabaseAdmin
      .from('grade_salary_config')
      .update(updates)
      .eq('id', config_id)
      .eq('grade_id', gradeId)
      .eq('company_id', companyId!)
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    try {
      const { data: { user: usr } } = await supabaseAdmin.auth.getUser(request.headers.get('Authorization')!.substring(7));
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: usr?.id, company_id: companyId!, action: 'update_salary_config', resource_type: 'grade_salary_config', resource_id: data.id, resource_name: `Salary config for grade ${gradeId}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, error } = await getCompanyId(request);
    if (error) return error;

    const { id: gradeId } = await params;

    if (!(await verifyGradeOwnership(gradeId, companyId!))) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('config_id');

    if (!configId) {
      return NextResponse.json({ error: 'Missing query param: config_id' }, { status: 400 });
    }

    const { error: dbError } = await supabaseAdmin
      .from('grade_salary_config')
      .delete()
      .eq('id', configId)
      .eq('grade_id', gradeId)
      .eq('company_id', companyId!);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
