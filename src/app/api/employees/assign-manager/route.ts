import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED_ROLES = ['Super Admin', 'Company Admin', 'HR Manager'];

export async function POST(request: NextRequest) {
  try {
    // Authenticate caller
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify caller has an allowed role
    const { data: rolesData } = await supabaseAdmin
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id);

    const callerRoles: string[] = rolesData?.map((r: any) => r.roles?.name).filter(Boolean) || [];
    const hasAccess = callerRoles.some(r => ALLOWED_ROLES.includes(r));

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: only Super Admin, Company Admin, or HR Manager can assign managers' },
        { status: 403 }
      );
    }

    const { employee_id, manager_id } = await request.json();

    if (!employee_id) {
      return NextResponse.json({ error: 'Missing required field: employee_id' }, { status: 400 });
    }

    // Fetch employee to verify company access
    const { data: employee } = await supabaseAdmin
      .from('employees')
      .select('id, company_id')
      .eq('id', employee_id)
      .single();

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Verify caller has access to this employee's company
    const { data: companyAccess } = await supabaseAdmin
      .from('user_companies')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('company_id', employee.company_id)
      .maybeSingle();

    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    const isSuperAdmin = callerRoles.includes('Super Admin');
    const hasCompanyAccess =
      isSuperAdmin ||
      companyAccess !== null ||
      userRow?.company_id === employee.company_id;

    if (!hasCompanyAccess) {
      return NextResponse.json({ error: 'Forbidden: no access to this company' }, { status: 403 });
    }

    // If a manager_id is provided, verify the manager belongs to the same company
    if (manager_id) {
      const { data: managerEmployee } = await supabaseAdmin
        .from('employees')
        .select('id, company_id, user_id')
        .eq('id', manager_id)
        .single();

      if (!managerEmployee) {
        return NextResponse.json({ error: 'Manager employee record not found' }, { status: 404 });
      }

      if (managerEmployee.company_id !== employee.company_id) {
        return NextResponse.json({ error: 'Manager must belong to the same company' }, { status: 400 });
      }

      // Verify the assigned manager actually has the Manager role
      if (managerEmployee.user_id) {
        const { data: managerRoles } = await supabaseAdmin
          .from('user_roles')
          .select('roles(name)')
          .eq('user_id', managerEmployee.user_id);

        const hasManagerRole = managerRoles?.some((r: any) => r.roles?.name === 'Manager');
        if (!hasManagerRole) {
          return NextResponse.json(
            { error: 'The selected employee does not have the Manager role' },
            { status: 400 }
          );
        }
      }
    }

    // Perform the assignment
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ manager_id: manager_id || null })
      .eq('id', employee_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Audit log (non-blocking)
    try {
      const { logAuditEvent, getIpAddress, getUserAgent } = await import('@/lib/audit');
      const hdrs = Object.fromEntries(request.headers.entries());
      // Fetch employee name for a readable log
      const { data: empRow } = await supabaseAdmin
        .from('employees')
        .select('first_name, last_name')
        .eq('id', employee_id)
        .single();
      const empName = empRow ? `${empRow.first_name} ${empRow.last_name}` : employee_id;
      await logAuditEvent({
        user_id: user.id,
        company_id: employee.company_id,
        action: manager_id ? 'assign_manager' : 'unassign_manager',
        resource_type: 'employees',
        resource_id: employee_id,
        resource_name: manager_id ? `Manager assigned to ${empName}` : `Manager removed from ${empName}`,
        status: 'success',
        ip_address: getIpAddress(hdrs),
        user_agent: getUserAgent(hdrs),
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: manager_id ? 'Manager assigned successfully' : 'Manager removed successfully',
    });
  } catch (err) {
    console.error('Assign manager error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
