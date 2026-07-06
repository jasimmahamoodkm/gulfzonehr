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
      .from('grade_benefits')
      .select('*')
      .eq('grade_id', gradeId)
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
    const { id: gradeId } = await params;
    const { grade, userId, error } = await authorizeGrade(request, gradeId);
    if (error || !grade) return error!;

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
        // Benefit rows belong to the grade's company, not the caller's.
        company_id: grade.company_id,
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
      console.error('[Benefits POST] Database error:', {
        message: dbError.message,
        code: (dbError as any).code,
        details: (dbError as any).details,
        hint: (dbError as any).hint,
      });
      return NextResponse.json({
        error: dbError.message,
        details: (dbError as any).details,
        code: (dbError as any).code
      }, { status: 500 });
    }

    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: userId ?? undefined, company_id: grade.company_id, action: 'create_benefit', resource_type: 'grade_benefits', resource_id: undefined, resource_name: `Benefit for grade ${grade.name}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
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
    const { id: gradeId } = await params;
    const { grade, userId, error } = await authorizeGrade(request, gradeId);
    if (error || !grade) return error!;

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
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: userId ?? undefined, company_id: grade.company_id, action: 'update_benefit', resource_type: 'grade_benefits', resource_id: undefined, resource_name: `Benefit for grade ${grade.name}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
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
    const { id: gradeId } = await params;
    const { grade, userId, error } = await authorizeGrade(request, gradeId);
    if (error || !grade) return error!;

    const { searchParams } = new URL(request.url);
    const benefitId = searchParams.get('benefit_id');

    if (!benefitId) {
      return NextResponse.json({ error: 'Missing query param: benefit_id' }, { status: 400 });
    }

    const { error: dbError } = await supabaseAdmin
      .from('grade_benefits')
      .delete()
      .eq('id', benefitId)
      .eq('grade_id', gradeId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    try {
      const hdrs = Object.fromEntries(request.headers.entries());
      await logAuditEvent({ user_id: userId ?? undefined, company_id: grade.company_id, action: 'delete_benefit', resource_type: 'grade_benefits', resource_id: undefined, resource_name: `Benefit for grade ${grade.name}`, status: 'success', ip_address: getIpAddress(hdrs), user_agent: getUserAgent(hdrs) });
    } catch (_) {}
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
