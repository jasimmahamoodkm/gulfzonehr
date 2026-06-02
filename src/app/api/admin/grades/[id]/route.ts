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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { companyId, error } = await getCompanyId(request);
    if (error) return error;

    const { id } = await params;

    const { data: grade, error: gradeError } = await supabaseAdmin
      .from('employee_grades')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId!)
      .single();

    if (gradeError || !grade) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }

    const { count } = await supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('grade_id', id);

    return NextResponse.json({ data: { ...grade, employee_count: count ?? 0 } });
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

    const { id } = await params;

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from('employee_grades')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId!)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, level, description, active } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (level !== undefined) updates.level = Number(level);
    if (description !== undefined) updates.description = description;
    if (active !== undefined) updates.active = active;

    const { data, error: dbError } = await supabaseAdmin
      .from('employee_grades')
      .update(updates)
      .eq('id', id)
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

    const { id } = await params;

    // Verify ownership before delete
    const { data: existing } = await supabaseAdmin
      .from('employee_grades')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId!)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }

    const { error: dbError } = await supabaseAdmin
      .from('employee_grades')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId!);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
