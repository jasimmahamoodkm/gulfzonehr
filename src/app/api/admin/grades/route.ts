import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Resolve which company the request operates on.
 * If the client passes a company_id (the company selected in the UI), honor it
 * — but only after verifying the caller may access it: Super Admins can use any
 * company; everyone else only companies they're assigned to. With no requested
 * company, fall back to the caller's own company.
 */
async function getCompanyId(
  request: NextRequest,
  requested?: string | null,
): Promise<{ companyId: string | null; userId: string | null; error: NextResponse | null }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { companyId: null, userId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const token = authHeader.substring(7);
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return { companyId: null, userId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: roleRows } = await supabaseAdmin.from('user_roles').select('roles(name)').eq('user_id', user.id);
  const isSuperAdmin = (roleRows || []).some((r: any) => r.roles?.name === 'Super Admin');

  // Honor an explicitly requested company once access is verified.
  if (requested) {
    if (isSuperAdmin) return { companyId: requested, userId: user.id, error: null };
    const { data: ud } = await supabaseAdmin.from('users').select('company_id').eq('id', user.id).single();
    const { data: uc } = await supabaseAdmin
      .from('user_companies').select('company_id').eq('user_id', user.id).eq('company_id', requested).maybeSingle();
    if (ud?.company_id === requested || uc) return { companyId: requested, userId: user.id, error: null };
    return { companyId: null, userId: user.id, error: NextResponse.json({ error: 'No access to that company' }, { status: 403 }) };
  }

  // Fall back to the caller's own company.
  const { data: userData } = await supabaseAdmin.from('users').select('company_id').eq('id', user.id).single();
  let companyId: string | null = userData?.company_id ?? null;
  if (!companyId) {
    const { data: ucData } = await supabaseAdmin
      .from('user_companies').select('company_id').eq('user_id', user.id).eq('is_primary', true).maybeSingle();
    companyId = ucData?.company_id ?? null;
  }
  if (!companyId) {
    const { data: anyUc } = await supabaseAdmin
      .from('user_companies').select('company_id').eq('user_id', user.id).limit(1).maybeSingle();
    companyId = anyUc?.company_id ?? null;
  }
  if (!companyId) {
    return { companyId: null, userId: user.id, error: NextResponse.json({ error: 'No company associated with user' }, { status: 403 }) };
  }
  return { companyId, userId: user.id, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const requested = request.nextUrl.searchParams.get('company_id');
    const { companyId, error } = await getCompanyId(request, requested);
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
    const body = await request.json();
    const { name, level, description, company_id: requestedCompany } = body;
    const { companyId, error } = await getCompanyId(request, requestedCompany);
    if (error) return error;

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

    // Get user from token for audit
    const authHeader2 = request.headers.get('Authorization');
    const token2 = authHeader2?.substring(7);
    const { data: { user: usr } } = await supabaseAdmin.auth.getUser(token2!);
    try {
      const { logAuditEvent, getIpAddress, getUserAgent } = await import('@/lib/audit');
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: usr?.id, company_id: companyId!, action: 'create_grade', resource_type: 'employee_grades', resource_id: data.id, resource_name: data.name, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
