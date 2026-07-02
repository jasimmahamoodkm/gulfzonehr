import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED = ['Super Admin', 'Company Admin', 'HR Manager'];

interface BenefitChange {
  benefit_type: string;
  benefit_value?: number;
  value_type?: string;        // 'fixed' | 'percentage'
  currency?: string;
  action: 'add' | 'update' | 'remove';
}

async function callerRoles(token: string) {
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return { user: null, roles: [] as string[] };
  const { data } = await supabaseAdmin.from('user_roles').select('roles(name)').eq('user_id', user.id);
  return { user, roles: (data?.map((r: any) => r.roles?.name).filter(Boolean) || []) as string[] };
}

/** Basic salary configured for a grade (latest effective_from <= today). */
async function gradeSalary(gradeId: string | null): Promise<number | null> {
  if (!gradeId) return null;
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabaseAdmin
    .from('grade_salary_config').select('salary')
    .eq('grade_id', gradeId).lte('effective_from', today)
    .order('effective_from', { ascending: false }).limit(1);
  return data?.[0]?.salary ?? null;
}

/** GET /api/grade-changes?status=pending — list requests (HR+ only). */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, roles } = await callerRoles(authHeader.substring(7));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!roles.some(r => ALLOWED.includes(r))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const status = request.nextUrl.searchParams.get('status');
    const companyId = request.nextUrl.searchParams.get('company_id');
    let q = supabaseAdmin
      .from('grade_change_requests')
      .select('*, employees:employee_id(first_name,last_name,email), curr:current_grade_id(name,level), req:requested_grade_id(name,level)')
      .order('requested_at', { ascending: false });
    if (status) q = q.eq('status', status);
    // Scope to the company selected in the UI so multi-company admins only see
    // the requests for the company they're currently viewing.
    if (companyId) q = q.eq('company_id', companyId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}

/** POST /api/grade-changes — raise a promotion / demotion / change request. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, roles } = await callerRoles(authHeader.substring(7));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!roles.some(r => ALLOWED.includes(r))) {
      return NextResponse.json({ error: 'Forbidden: HR Manager or above required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      employee_id,
      change_grade = false, requested_grade_id = null,
      change_salary = false, requested_salary = null,
      change_benefits = false, benefit_changes = null,
      reason = null,
    } = body as {
      employee_id: string;
      change_grade?: boolean; requested_grade_id?: string | null;
      change_salary?: boolean; requested_salary?: number | null;
      change_benefits?: boolean; benefit_changes?: BenefitChange[] | null;
      reason?: string | null;
    };

    if (!employee_id) return NextResponse.json({ error: 'employee_id is required' }, { status: 400 });
    if (!change_grade && !change_salary && !change_benefits) {
      return NextResponse.json({ error: 'Select at least one change (grade, salary, or benefits)' }, { status: 400 });
    }
    if (change_grade && !requested_grade_id) {
      return NextResponse.json({ error: 'requested_grade_id is required for a grade change' }, { status: 400 });
    }
    if (change_salary && (requested_salary == null || isNaN(Number(requested_salary)))) {
      return NextResponse.json({ error: 'requested_salary is required for a salary change' }, { status: 400 });
    }
    if (change_benefits && (!Array.isArray(benefit_changes) || benefit_changes.length === 0)) {
      return NextResponse.json({ error: 'benefit_changes is required for a benefits change' }, { status: 400 });
    }

    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('id, company_id, grade_id, salary_override, first_name, last_name')
      .eq('id', employee_id).single();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    if (change_grade && emp.grade_id === requested_grade_id) {
      return NextResponse.json({ error: 'Employee is already on this grade' }, { status: 400 });
    }

    // Block a second pending request for the same employee
    const { data: existing } = await supabaseAdmin
      .from('grade_change_requests').select('id').eq('employee_id', employee_id).eq('status', 'pending').limit(1);
    if (existing && existing.length) {
      return NextResponse.json({ error: 'A pending request already exists for this employee' }, { status: 409 });
    }

    // Resolve current & resulting effective salary to classify the request.
    const currentGradeSalary = await gradeSalary(emp.grade_id);
    const currentSalary = emp.salary_override ?? currentGradeSalary;
    let resultingSalary = currentSalary;
    if (change_salary) resultingSalary = Number(requested_salary);
    else if (change_grade) resultingSalary = await gradeSalary(requested_grade_id);

    let request_type: 'promotion' | 'demotion' | 'lateral' = 'lateral';
    if (resultingSalary != null && currentSalary != null) {
      request_type = resultingSalary > currentSalary ? 'promotion'
        : resultingSalary < currentSalary ? 'demotion' : 'lateral';
    } else if (change_grade) {
      request_type = 'lateral'; // grade moved but salary unknown
    }

    const { data: reqRow, error: insErr } = await supabaseAdmin
      .from('grade_change_requests')
      .insert({
        employee_id, company_id: emp.company_id, request_type,
        change_grade, current_grade_id: emp.grade_id, requested_grade_id: change_grade ? requested_grade_id : null,
        change_salary, current_salary: currentSalary, requested_salary: change_salary ? Number(requested_salary) : null,
        change_benefits, benefit_changes: change_benefits ? benefit_changes : null,
        currency: 'AED', reason: reason || null, status: 'pending',
        effective_month: new Date().toISOString().slice(0, 7),
        requested_by: user.id,
      })
      .select().single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      const scopes = [change_grade && 'grade', change_salary && 'salary', change_benefits && 'benefits'].filter(Boolean).join(', ');
      await logAuditEvent({
        user_id: user.id, company_id: emp.company_id,
        action: 'request_compensation_change', resource_type: 'grade_change_requests',
        resource_id: reqRow.id,
        resource_name: `${request_type} (${scopes}) requested for ${emp.first_name} ${emp.last_name}`,
        status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs),
      });
    } catch (_) {}

    return NextResponse.json({ data: reqRow }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
