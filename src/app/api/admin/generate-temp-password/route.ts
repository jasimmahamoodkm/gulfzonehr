import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import _crypto from 'crypto';

interface GeneratePasswordRequest {
  employee_id: string;
  company_id?: string;
  send_email?: boolean;
}

/**
 * Generate temporary password: 12 characters with mixed case, numbers, and special chars
 */
function generateTemporaryPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export async function POST(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { employee_id, company_id, send_email } = body as GeneratePasswordRequest;

    console.log('📡 Received employee_id:', employee_id);
    console.log('📡 Received company_id:', company_id);
    console.log('📡 Employee ID type:', typeof employee_id);
    console.log('📡 Send email:', send_email);

    if (!employee_id) {
      console.error('❌ No employee_id provided');
      return NextResponse.json(
        { error: 'employee_id is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.substring(7);

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('Failed to get user from token:', userError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get employee details
    console.log('📍 Fetching employee with ID:', employee_id, 'Company ID:', company_id);

    // Step 1: Try to find ANY employee to verify table access
    console.log('📍 Step 0: Testing table access...');
    const { error: testError, count: testCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });

    console.log('📍 Table access test - Count:', testCount, 'Error:', testError?.message || 'none');

    // Step 1: Try to find the specific employee using wildcard select
    console.log('📍 Step 1: Searching for employee with ID:', employee_id);
    const { data: employeeList, error: listError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employee_id);

    if (listError) {
      console.error('❌ Step 1 Error:', listError.code, listError.message);
      return NextResponse.json(
        { error: `Database error: ${listError.message}` },
        { status: 500 }
      );
    }

    if (!employeeList || employeeList.length === 0) {
      console.error('❌ Employee not found in database with ID:', employee_id);
      console.error('❌ Searched in table: employees');
      return NextResponse.json(
        { error: `Employee with ID ${employee_id} does not exist in the database` },
        { status: 404 }
      );
    }

    const employeeAny = employeeList[0];
    console.log('✅ Step 1: Employee found');
    console.log('   Record keys:', Object.keys(employeeAny));
    console.log('   Full Record:', JSON.stringify(employeeAny, null, 2));

    // Use the employee found
    const employee = employeeAny;

    // If employee doesn't have user_id, try to get it from Supabase auth
    let userId = employee.user_id;

    if (!userId) {
      console.log('📍 User ID not in employee record, fetching from Supabase Auth...');

      // List all users and find the one with matching email
      const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

      if (listError) {
        console.error('❌ Failed to list auth users:', listError.message);
        return NextResponse.json(
          { error: `Failed to fetch user data: ${listError.message}` },
          { status: 500 }
        );
      }

      const authUser = authUsers?.users?.find(u => u.email === employee.email);

      if (!authUser) {
        // Auth user doesn't exist - create one (employee was in DB but not properly set up)
        console.log('📍 Auth user not found. Creating new auth user for', employee.email);

        const { data: createAuthData, error: createAuthError } = await supabase.auth.admin.createUser({
          email: employee.email,
          password: generateTemporaryPassword(), // Temporary password for the new account
          user_metadata: {
            first_name: employee.first_name,
            last_name: employee.last_name,
            is_temporary_password: true,
          },
          email_confirm: true,
        });

        if (createAuthError || !createAuthData.user) {
          console.error('❌ Failed to create auth user:', createAuthError);
          return NextResponse.json(
            { error: `Failed to create auth user: ${createAuthError?.message || 'Unknown error'}` },
            { status: 500 }
          );
        }

        userId = createAuthData.user.id;
        console.log('✅ Created new auth user:', userId);
      } else {
        userId = authUser.id;
        console.log('✅ Found user ID from Supabase Auth:', userId);
      }
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('❌ User ID is not a valid UUID:', userId);
      console.error('   Type:', typeof userId);
      console.error('   Value:', JSON.stringify(userId));
      return NextResponse.json(
        { error: `Employee user_id is invalid. Expected UUID format.` },
        { status: 400 }
      );
    }

    if (company_id && employee.company_id !== company_id) {
      console.warn('⚠️ Warning: Employee belongs to different company');
      console.warn('   Employee company:', employee.company_id);
      console.warn('   Selected company:', company_id);
    }

    console.log('✅ Employee confirmed:');
    console.log('   Email:', employee.email);
    console.log('   User ID:', userId);
    console.log('   Company:', employee.company_id);

    // Generate new temporary password
    const temporaryPassword = generateTemporaryPassword();
    console.log('🔑 Generated temporary password');

    // Update Supabase Auth user with new password
    console.log('📍 Updating auth user:', userId);
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      user_metadata: {
        first_name: employee.first_name,
        last_name: employee.last_name,
        is_temporary_password: true,
        password_reset_at: new Date().toISOString(),
      },
    });

    if (updateError) {
      console.error('❌ Failed to update password:', updateError);
      return NextResponse.json(
        { error: `Failed to update password: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ Auth user password updated');

    // Send welcome email if requested
    let emailSent = false;
    if (send_email) {
      try {
        const emailResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email/send-welcome`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: employee.email,
              first_name: employee.first_name,
              last_name: employee.last_name,
              temporary_password: temporaryPassword,
            }),
          }
        );

        if (emailResponse.ok) {
          emailSent = true;
          console.log(`✅ Welcome email resent to ${employee.email}`);
        } else {
          console.warn(`⚠️ Failed to send welcome email to ${employee.email}`);
        }
      } catch (emailError) {
        console.warn(`⚠️ Email sending error for ${employee.email}:`, emailError);
      }
    }

    console.log(`✅ Temporary password generated for employee: ${employee.email}`);
    return NextResponse.json({
      success: true,
      data: {
        employee_id: employee.id,
        employee_email: employee.email,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        temporaryPassword,
        emailSent,
        message: 'Temporary password generated successfully',
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Error in generate-temp-password endpoint:', errorMsg);
    console.error('❌ Full error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
