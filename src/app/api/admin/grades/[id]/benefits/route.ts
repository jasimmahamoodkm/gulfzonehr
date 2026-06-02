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
      .from('grade_benefits')
      .select('*')
      .eq('grade_id', gradeId)
      .eq('company_id', companyId!)
      .order('created_at', { ascending: true });

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
    const {
      benefit_type,
      benefit_value,
      value_type = 'fixed',
      currency = 'AED',
      description,
      active = true,
    } = body;

    if (!benefit_type) {
      return NextResponse.json({ error: 'Missing required field: benefit_type' }, { status: 400 });
    }

    const { data, error: dbError } = await supabaseAdmin
      .from('grade_benefits')
      .insert({
        grade_id: gradeId,
        company_id: companyId,
        benefit_type,
        benefit_value: benefit_value !== undefined ? Number(benefit_value) : null,
        value_type,
        currency,
        description: description || null,
        active,
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
    const { benefit_id, benefit_type, benefit_value, value_type, currency, description, active } = body;

    if (!benefit_id) {
      return NextResponse.json({ error: 'Missing required field: benefit_id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (benefit_type !== undefined) updates.benefit_type = benefit_type;
    if (benefit_value !== undefined) updates.benefit_value = benefit_value !== null ? Number(benefit_value) : null;
    if (value_type !== undefined) updates.value_type = value_type;
    if (currency !== undefined) updates.currency = currency;
    if (description !== undefined) updates.description = description || null;
    if (active !== undefined) updates.active = active;

    const { data, error: dbError } = await supabaseAdmin
      .from('grade_benefits')
      .update(updates)
      .eq('id', benefit_id)
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
    const benefitId = searchParams.get('benefit_id');

    if (!benefitId) {
      return NextResponse.json({ error: 'Missing query param: benefit_id' }, { status: 400 });
    }

    const { error: dbError } = await supabaseAdmin
      .from('grade_benefits')
      .delete()
      .eq('id', benefitId)
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
