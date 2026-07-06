import { logAuditEvent, getIpAddress, getUserAgent } from '@/lib/audit';
import { authorizeGrade } from '@/lib/gradeAccess';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gradeId } = await params;
    // Authorize against the GRADE's company (multi-company safe)
    const { grade, error } = await authorizeGrade(request, gradeId);
    if (error || !grade) return error!;

    const { data, error: dbError } = await supabaseAdmin
      .from('grade_leave_config')
      .select(`
        *,
        leave_types (
          name,
          color
        )
      `)
      .eq('grade_id', gradeId);

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
    const { id: gradeId } = await params;
    const { grade, userId, error } = await authorizeGrade(request, gradeId);
    if (error || !grade) return error!;

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
          // Config rows belong to the grade's company, not the caller's.
          company_id: grade.company_id,
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
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: userId ?? undefined, company_id: grade.company_id, action: 'create_leave_config', resource_type: 'grade_leave_config', resource_id: undefined, resource_name: `Leave config for grade ${grade.name}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
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
    const { id: gradeId } = await params;
    const { grade, userId, error } = await authorizeGrade(request, gradeId);
    if (error || !grade) return error!;

    const { searchParams } = new URL(request.url);
    const leaveTypeId = searchParams.get('leave_type_id');

    if (!leaveTypeId) {
      return NextResponse.json({ error: 'Missing query param: leave_type_id' }, { status: 400 });
    }

    const { error: dbError } = await supabaseAdmin
      .from('grade_leave_config')
      .delete()
      .eq('grade_id', gradeId)
      .eq('leave_type_id', leaveTypeId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: userId ?? undefined, company_id: grade.company_id, action: 'delete_leave_config', resource_type: 'grade_leave_config', resource_id: undefined, resource_name: `Leave config for grade ${grade.name}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
