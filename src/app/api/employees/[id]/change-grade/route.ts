import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED_ROLES = ['Super Admin', 'Company Admin', 'HR Manager'];

/** Current effective basic salary for a grade (latest effective_from <= today). */
async function currentSalaryForGrade(gradeId: string | null): Promise<{ salary: number | null; currency: string }> {
  if (!gradeId) return { salary: null, currency: 'AED' };
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabaseAdmin
    .from('grade_salary_config')
    .select('salary, currency')
    .eq('grade_id', gradeId)
    .lte('effective_from', today)
    .order('effective_from', { ascending: false })
    .limit(1);
  return { salary: data?.[0]?.salary ?? null, currency: data?.[0]?.currency ?? 'AED' };
}

/**
 * POST /api/employees/[id]/change-grade
 * Body: { grade_id: string | null }
 * Updates the employee's grade AND records a row in employee_change_history.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { data: rolesData } = await supabaseAdmin
      .from('user_roles').select('roles(name)').eq('user_id', user.id);
    const callerRoles: string[] = rolesData?.map((r: any) => r.roles?.name).filter(Boolean) || [];
    if (!callerRoles.some(r => ALLOWED_ROLES.includes(r))) {
      return NextResponse.json({ error: 'Forbidden: HR Manager or above required' }, { status: 403 });
    }

    const { id: employeeId } = await params;
    const { grade_id: newGradeId } = await request.json();

    // Load the employee (current grade + company)
    const { data: emp, error: empErr } = await supabaseAdmin
      .from('employees')
      .select('id, company_id, grade_id, first_name, last_name')
      .eq('id', employeeId)
      .single();
    if (empErr || !emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const oldGradeId: string | null = emp.grade_id ?? null;
    if (oldGradeId === (newGradeId || null)) {
      return NextResponse.json({ success: true, message: 'No change' });
    }

    // Resolve salaries before/after for the history record
    const [{ salary: oldSalary }, { salary: newSalary, currency }] = await Promise.all([
      currentSalaryForGrade(oldGradeId),
      currentSalaryForGrade(newGradeId || null),
    ]);

    // Apply the grade change
    const { error: updErr } = await supabaseAdmin
      .from('employees')
      .update({ grade_id: newGradeId || null })
      .eq('id', employeeId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    // Record history (non-blocking failure shouldn't undo the change)
    const effectiveMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    try {
      await supabaseAdmin.from('employee_change_history').insert({
        employee_id: employeeId,
        company_id: emp.company_id,
        change_type: 'grade',
        old_grade_id: oldGradeId,
        new_grade_id: newGradeId || null,
        old_salary: oldSalary,
        new_salary: newSalary,
        currency,
        effective_month: effectiveMonth,
        changed_by: user.id,
        note: `Grade changed for ${emp.first_name} ${emp.last_name}`,
      });
    } catch (histErr) {
      console.warn('change-grade: history insert failed (non-critical):', histErr);
    }

    // Audit log
    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({
        user_id: user.id,
        company_id: emp.company_id,
        action: 'change_grade',
        resource_type: 'employees',
        resource_id: employeeId,
        resource_name: `Grade change — ${emp.first_name} ${emp.last_name}`,
        old_values: { grade_id: oldGradeId, salary: oldSalary },
        new_values: { grade_id: newGradeId || null, salary: newSalary },
        status: 'success',
        ip_address: getIpAddress(hdrs),
        user_agent: getUserAgent(hdrs),
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      old_grade_id: oldGradeId,
      new_grade_id: newGradeId || null,
      old_salary: oldSalary,
      new_salary: newSalary,
    });
  } catch (err) {
    console.error('change-grade error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
