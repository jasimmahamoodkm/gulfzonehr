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
  // Look up company_id from users table, fallback to user_companies (primary)
  const { data: userData } = await supabaseAdmin.from('users').select('company_id').eq('id', user.id).single();
  let companyId: string | null = userData?.company_id ?? null;

  if (!companyId) {
    const { data: ucData } = await supabaseAdmin
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .single();
    companyId = ucData?.company_id ?? null;
  }

  if (!companyId) {
    const { data: anyUc } = await supabaseAdmin
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();
    companyId = anyUc?.company_id ?? null;
  }

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
      .from('grade_leave_config')
      .select(`
        *,
        leave_types (
          name,
          color
        )
      `)
      .eq('grade_id', gradeId)
      .eq('company_id', companyId!);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const configs = (data || []).map((item: any) => ({
      ...item,
      leave_type_name: item.leave_types?.name ?? null,
      leave_type_color: item.leave_types?.color ?? null,
      leave_types: undefined,
    }));

    return NextResponse.json({ data: configs });
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
    const {
      leave_type_id,
      days_per_year,
      carry_forward_days = 0,
      carry_forward_expiry_months = 3,
      year = null,
    } = body;

    if (!leave_type_id || days_per_year === undefined) {
      return NextResponse.json({ error: 'Missing required fields: leave_type_id, days_per_year' }, { status: 400 });
    }

    // Check if config already exists for this grade + leave_type + year
    let existingQuery = supabaseAdmin
      .from('grade_leave_config')
      .select('id')
      .eq('grade_id', gradeId)
      .eq('leave_type_id', leave_type_id);

    if (year != null) {
      existingQuery = existingQuery.eq('year', year);
    } else {
      existingQuery = existingQuery.is('year', null);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    let data, dbError;

    if (existing?.id) {
      // Update existing record
      ({ data, error: dbError } = await supabaseAdmin
        .from('grade_leave_config')
        .update({
          days_per_year: Number(days_per_year),
          carry_forward_days: Number(carry_forward_days),
          carry_forward_expiry_months: Number(carry_forward_expiry_months),
        })
        .eq('id', existing.id)
        .select()
        .single());
    } else {
      // Insert new record
      ({ data, error: dbError } = await supabaseAdmin
        .from('grade_leave_config')
        .insert({
          grade_id: gradeId,
          company_id: companyId,
          leave_type_id,
          days_per_year: Number(days_per_year),
          carry_forward_days: Number(carry_forward_days),
          carry_forward_expiry_months: Number(carry_forward_expiry_months),
          year: year ?? null,
        })
        .select()
        .single());
    }

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

        try {
      const { data: { user: usr } } = await supabaseAdmin.auth.getUser(request.headers.get('Authorization')!.substring(7));
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: usr?.id, company_id: companyId!, action: 'create_leave_config', resource_type: 'grade_leave_config', resource_id: undefined, resource_name: `Leave config for grade ${gradeId}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
    return NextResponse.json({ data }, { status: 201 });
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
    const leaveTypeId = searchParams.get('leave_type_id');

    if (!leaveTypeId) {
      return NextResponse.json({ error: 'Missing query param: leave_type_id' }, { status: 400 });
    }

    const { error: dbError } = await supabaseAdmin
      .from('grade_leave_config')
      .delete()
      .eq('grade_id', gradeId)
      .eq('company_id', companyId!)
      .eq('leave_type_id', leaveTypeId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

        try {
      const { data: { user: usr } } = await supabaseAdmin.auth.getUser(request.headers.get('Authorization')!.substring(7));
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: usr?.id, company_id: companyId!, action: 'delete_leave_config', resource_type: 'grade_leave_config', resource_id: undefined, resource_name: `Leave config for grade ${gradeId}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
