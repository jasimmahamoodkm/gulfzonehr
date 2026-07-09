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
    const { id } = await params;
    // Authorize against the GRADE's company (multi-company safe)
    const { error } = await authorizeGrade(request, id);
    if (error) return error;

    const { data: grade, error: gradeError } = await supabaseAdmin
      .from('employee_grades')
      .select('*')
      .eq('id', id)
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
    const { id } = await params;
    const { grade, userId, error } = await authorizeGrade(request, id);
    if (error || !grade) return error!;

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
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: userId ?? undefined, company_id: grade.company_id, action: 'update_grade', resource_type: 'employee_grades', resource_id: data.id, resource_name: data.name, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
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
    const { id } = await params;
    const { grade, userId, error } = await authorizeGrade(request, id);
    if (error || !grade) return error!;

    const { error: dbError } = await supabaseAdmin
      .from('employee_grades')
      .delete()
      .eq('id', id);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: userId ?? undefined, company_id: grade.company_id, action: 'delete_grade', resource_type: 'employee_grades', resource_id: id as any, resource_name: `Grade ${grade.name}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
