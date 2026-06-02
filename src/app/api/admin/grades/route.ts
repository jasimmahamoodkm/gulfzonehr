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

export async function GET(request: NextRequest) {
  try {
    const { companyId, error } = await getCompanyId(request);
    if (error) return error;

    // Fetch grades
    const { data: gradesData, error: dbError } = await supabaseAdmin
      .from('employee_grades')
      .select('*')
      .eq('company_id', companyId!)
      .order('level', { ascending: true });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const grades = gradesData || [];

    // Fetch employee counts per grade in a single query
    const gradeIds = grades.map((g) => g.id);
    let countMap: Record<string, number> = {};

    if (gradeIds.length > 0) {
      const { data: empData } = await supabaseAdmin
        .from('employees')
        .select('grade_id')
        .in('grade_id', gradeIds)
        .eq('status', 'Active');

      (empData || []).forEach((e: { grade_id: string }) => {
        countMap[e.grade_id] = (countMap[e.grade_id] || 0) + 1;
      });
    }

    // Fetch current salary config for each grade
    const { data: salaryData } = await supabaseAdmin
      .from('grade_salary_config')
      .select('grade_id, salary, currency, effective_from, effective_to')
      .in('grade_id', gradeIds.length > 0 ? gradeIds : ['00000000-0000-0000-0000-000000000000'])
      .lte('effective_from', new Date().toISOString().split('T')[0]);

    // Pick the most recent salary config per grade
    const salaryMap: Record<string, { salary: number; currency: string }> = {};
    (salaryData || []).forEach((s: any) => {
      if (!salaryMap[s.grade_id]) {
        salaryMap[s.grade_id] = { salary: s.salary, currency: s.currency };
      }
    });

    const enriched = grades.map((g) => ({
      ...g,
      employee_count: countMap[g.id] ?? 0,
      salary: salaryMap[g.id]?.salary ?? null,
      currency: salaryMap[g.id]?.currency ?? 'AED',
    }));

    return NextResponse.json({ data: enriched });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, error } = await getCompanyId(request);
    if (error) return error;

    const body = await request.json();
    const { name, level, description } = body;

    if (!name || level === undefined || level === null) {
      return NextResponse.json({ error: 'Missing required fields: name, level' }, { status: 400 });
    }

    const { data, error: dbError } = await supabaseAdmin
      .from('employee_grades')
      .insert({
        company_id: companyId,
        name,
        level: Number(level),
        description: description || null,
      })
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') {
        return NextResponse.json({ error: 'A grade with this name already exists for your company' }, { status: 409 });
      }
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
