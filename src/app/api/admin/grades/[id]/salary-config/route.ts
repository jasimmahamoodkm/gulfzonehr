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
    const { salary, currency = 'AED', effective_from, effective_to, notes } = body;

    if (salary === undefined || !effective_from) {
      return NextResponse.json({ error: 'Missing required fields: salary, effective_from' }, { status: 400 });
    }

    const { data, error: dbError } = await supabaseAdmin
      .from('grade_salary_config')
      .insert({
        grade_id: gradeId,
        company_id: companyId,
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
    const { config_id, salary, currency, effective_from, effective_to, notes } = body;

    if (!config_id) {
      return NextResponse.json({ error: 'Missing required field: config_id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
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
