import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';
import { getMergedBenefits } from '@/lib/compensation';

const fmtBenefitVal = (v: number | null | undefined, vt?: string) =>
  v == null ? 'none' : vt === 'percentage' ? `${v}% of basic` : `AED ${Number(v).toLocaleString()}`;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED = ['Super Admin', 'Company Admin', 'HR Manager'];

interface BenefitChange {
  benefit_type: string;
  benefit_value?: number;
  value_type?: string;
  currency?: string;
  action: 'add' | 'update' | 'remove';
}

async function callerRoles(token: string) {
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return { user: null, roles: [] as string[] };
  const { data } = await supabaseAdmin.from('user_roles').select('roles(name)').eq('user_id', user.id);
  return { user, roles: (data?.map((r: any) => r.roles?.name).filter(Boolean) || []) as string[] };
}

async function gradeSalary(gradeId: string | null): Promise<number | null> {
  if (!gradeId) return null;
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabaseAdmin
    .from('grade_salary_config').select('salary')
    .eq('grade_id', gradeId).lte('effective_from', today)
    .order('effective_from', { ascending: false }).limit(1);
  return data?.[0]?.salary ?? null;
}

/**
 * POST /api/grade-changes/[id]/decision
 * Body: { decision: 'approve' | 'reject', note?: string }
 * Approver must be HR Manager or above AND must not be the requester.
 * On approval the grade / salary / benefit overrides are applied and recorded.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { user, roles } = await callerRoles(authHeader.substring(7));
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!roles.some(r => ALLOWED.includes(r))) {
      return NextResponse.json({ error: 'Forbidden: HR Manager or above required' }, { status: 403 });
    }

    const { id } = await params;
    const { decision, note } = await request.json() as { decision: 'approve' | 'reject'; note?: string };
    if (decision !== 'approve' && decision !== 'reject') {
      return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
    }

    const { data: req } = await supabaseAdmin
      .from('grade_change_requests').select('*').eq('id', id).single();
    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (req.status !== 'pending') {
      return NextResponse.json({ error: `Request already ${req.status}` }, { status: 409 });
    }
    // No self-approval (a reviewer cannot decide their own request)
    if (req.requested_by && req.requested_by === user.id) {
      return NextResponse.json({ error: 'You cannot approve or reject your own request' }, { status: 403 });
    }

    const hdrs = Object.fromEntries(request.headers.entries());

    if (decision === 'reject') {
      await supabaseAdmin.from('grade_change_requests')
        .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: note || null })
        .eq('id', id);
      try {
        await logAuditEvent({
          user_id: user.id, company_id: req.company_id,
          action: 'reject_compensation_change', resource_type: 'grade_change_requests',
          resource_id: id, resource_name: `Rejected ${req.request_type} request`,
          status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs),
        });
      } catch (_) {}
      return NextResponse.json({ success: true, status: 'rejected' });
    }

    // ---- APPROVE: apply each requested scope ----
    const { data: emp } = await supabaseAdmin
      .from('employees').select('id, company_id, grade_id, salary_override, first_name, last_name')
      .eq('id', req.employee_id).single();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const effectiveMonth = new Date().toISOString().slice(0, 7);
    const currency = req.currency || 'AED';
    const historyRows: any[] = [];

    // (a) Grade change
    if (req.change_grade && req.requested_grade_id && req.requested_grade_id !== emp.grade_id) {
      const [oldGradeSal, newGradeSal] = await Promise.all([gradeSalary(emp.grade_id), gradeSalary(req.requested_grade_id)]);
      await supabaseAdmin.from('employees').update({ grade_id: req.requested_grade_id }).eq('id', emp.id);
      historyRows.push({
        employee_id: emp.id, company_id: emp.company_id, change_type: 'grade',
        old_grade_id: emp.grade_id, new_grade_id: req.requested_grade_id,
        old_salary: emp.salary_override ?? oldGradeSal, new_salary: newGradeSal,
        currency, effective_month: effectiveMonth, changed_by: user.id,
        note: `${req.request_type} approved — grade change`,
      });
    }

    // (b) Salary change (same grade) → per-employee salary override
    if (req.change_salary && req.requested_salary != null) {
      const oldEffective = emp.salary_override ?? (await gradeSalary(emp.grade_id));
      await supabaseAdmin.from('employees').update({ salary_override: req.requested_salary }).eq('id', emp.id);
      historyRows.push({
        employee_id: emp.id, company_id: emp.company_id, change_type: 'salary',
        old_grade_id: null, new_grade_id: null,
        old_salary: oldEffective, new_salary: req.requested_salary,
        currency, effective_month: effectiveMonth, changed_by: user.id,
        note: `${req.request_type} approved — salary override`,
      });
    }

    // (c) Benefits change (same grade) → per-employee benefit overrides
    if (req.change_benefits && Array.isArray(req.benefit_changes)) {
      // Capture the effective benefit values BEFORE applying, so the history
      // note can show each benefit's real before → after.
      const priorBenefits = await getMergedBenefits(supabaseAdmin, emp.id, emp.grade_id);
      const priorMap = new Map(priorBenefits.map(b => [b.benefit_type, b]));

      const details: string[] = [];
      for (const bc of req.benefit_changes as BenefitChange[]) {
        const prior = priorMap.get(bc.benefit_type);
        if (bc.action === 'remove') {
          details.push(`${bc.benefit_type}: ${fmtBenefitVal(prior?.benefit_value, prior?.value_type)} → removed`);
        } else {
          details.push(`${bc.benefit_type}: ${fmtBenefitVal(prior?.benefit_value, prior?.value_type)} → ${fmtBenefitVal(bc.benefit_value ?? 0, bc.value_type || 'fixed')}`);
        }
        // 'remove' suppresses the benefit (active=false) so it hides a grade
        // benefit too, not just a prior override; 'add'/'update' set it active.
        await supabaseAdmin.from('employee_benefit_overrides').upsert({
          employee_id: emp.id, company_id: emp.company_id,
          benefit_type: bc.benefit_type, benefit_value: bc.benefit_value ?? 0,
          value_type: bc.value_type || 'fixed', currency: bc.currency || currency,
          active: bc.action !== 'remove', updated_at: new Date().toISOString(),
        }, { onConflict: 'employee_id,benefit_type' });
      }
      historyRows.push({
        employee_id: emp.id, company_id: emp.company_id, change_type: 'benefits',
        old_grade_id: null, new_grade_id: null, old_salary: null, new_salary: null,
        currency, effective_month: effectiveMonth, changed_by: user.id,
        note: details.join('; '),
      });
    }

    if (historyRows.length) {
      try { await supabaseAdmin.from('employee_change_history').insert(historyRows); }
      catch (e) { console.warn('decision: history insert failed (non-critical)', e); }
    }

    await supabaseAdmin.from('grade_change_requests')
      .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: note || null })
      .eq('id', id);

    try {
      const scopes = [req.change_grade && 'grade', req.change_salary && 'salary', req.change_benefits && 'benefits'].filter(Boolean).join(', ');
      await logAuditEvent({
        user_id: user.id, company_id: req.company_id,
        action: 'approve_compensation_change', resource_type: 'employees',
        resource_id: emp.id,
        resource_name: `Approved ${req.request_type} (${scopes}) — ${emp.first_name} ${emp.last_name}`,
        status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs),
      });
    } catch (_) {}

    return NextResponse.json({ success: true, status: 'approved' });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
