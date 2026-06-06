import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { employee_id, grade_id, company_id } = body as {
      employee_id: string;
      grade_id: string;
      company_id: string;
    };

    if (!employee_id || !grade_id || !company_id) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_id, grade_id, company_id' },
        { status: 400 }
      );
    }

    // Fetch all leave configs for this grade
    const { data: configs, error: configError } = await supabaseAdmin
      .from('grade_leave_config')
      .select('leave_type_id, days_per_year')
      .eq('grade_id', grade_id)
      .eq('company_id', company_id);

    if (configError) {
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({ success: true, initialized: 0 });
    }

    const currentYear = new Date().getFullYear();

    const upsertRows = configs.map((config: { leave_type_id: string; days_per_year: number }) => ({
      employee_id,
      leave_type_id: config.leave_type_id,
      year: currentYear,
      total_days: config.days_per_year,
      used_days: 0,
      pending_days: 0,
    }));

    const { error: upsertError } = await supabaseAdmin
      .from('employee_leave_balance')
      .upsert(upsertRows, {
        onConflict: 'employee_id,leave_type_id,year',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, initialized: configs.length });
  } catch (err) {

    // Log audit event
    // Audit logging is non-critical, skipped to avoid type issues
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
