// Shared authorization for the per-grade admin API routes.
//
// A grade is managed in the context of ITS OWN company — not the caller's
// primary company. The old per-route checks compared against users.company_id,
// which broke multi-company admins: a Super Admin working in another selected
// company could create a grade there but every configure call answered
// "Grade not found". The rule here:
//   - Super Admin            → any grade
//   - everyone else          → grades of companies they belong to
//     (users.company_id or a user_companies row)
// Unauthorized callers get the same 404 as a missing grade (no existence leak).
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface AuthorizedGrade {
  id: string;
  company_id: string;
  name: string;
}

export async function authorizeGrade(
  request: NextRequest,
  gradeId: string,
): Promise<{ grade: AuthorizedGrade | null; userId: string | null; error: NextResponse | null }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { grade: null, userId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.substring(7));
  if (userError || !user) {
    return { grade: null, userId: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: grade } = await supabaseAdmin
    .from('employee_grades')
    .select('id, company_id, name')
    .eq('id', gradeId)
    .single();
  if (!grade) {
    return { grade: null, userId: user.id, error: NextResponse.json({ error: 'Grade not found' }, { status: 404 }) };
  }

  const [{ data: roleRows }, { data: userRow }, { data: ucRow }] = await Promise.all([
    supabaseAdmin.from('user_roles').select('roles(name)').eq('user_id', user.id),
    supabaseAdmin.from('users').select('company_id').eq('id', user.id).single(),
    supabaseAdmin.from('user_companies').select('company_id')
      .eq('user_id', user.id).eq('company_id', grade.company_id).maybeSingle(),
  ]);

  const isSuperAdmin = (roleRows || []).some((r: any) => r.roles?.name === 'Super Admin');
  const hasAccess = isSuperAdmin || userRow?.company_id === grade.company_id || !!ucRow;
  if (!hasAccess) {
    return { grade: null, userId: user.id, error: NextResponse.json({ error: 'Grade not found' }, { status: 404 }) };
  }

  return { grade: grade as AuthorizedGrade, userId: user.id, error: null };
}
