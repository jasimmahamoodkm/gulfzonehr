import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { generateTemporaryPassword } from '@/lib/employeeCreation';

// Server-side Supabase client with service role key (for admin operations)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

interface CreateEmployeeRequest {
  email: string;
  first_name: string;
  last_name: string;
  company_id: string;
  phone?: string;
  position?: string;
  department?: string;
  date_of_joining?: string;
  grade_id?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization (you can enhance this)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = (await request.json()) as CreateEmployeeRequest;

    // Validate required fields
    if (!payload.email || !payload.first_name || !payload.last_name || !payload.company_id) {
      return NextResponse.json(
        { error: 'Missing required fields: email, first_name, last_name, company_id' },
        { status: 400 }
      );
    }

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Step 1: Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: payload.first_name,
        last_name: payload.last_name,
        is_temporary_password: true, // Flag to prompt password change on first login
      },
    });

    if (authError) {
      console.error('Auth error:', authError);

      // Check for duplicate email error
      const errorMessage = authError.message || '';
      if (errorMessage.includes('already exists') || errorMessage.includes('User already registered')) {
        return NextResponse.json(
          { error: `User with email ${payload.email} already exists` },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: `Failed to create auth user: ${authError.message}` },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Step 2: Create users table record
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: payload.email,
        first_name: payload.first_name,
        last_name: payload.last_name,
        company_id: payload.company_id,
      })
      .select()
      .single();

    if (userError) {
      console.error('User record error:', userError);
      // Delete the auth user if we can't create the db record
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: `Failed to create user record: ${userError.message}` },
        { status: 400 }
      );
    }

    // Step 3: Create employee record
    const { data: employeeData, error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert({
        user_id: userId, // Store the auth user ID so we can look it up later
        company_id: payload.company_id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone,
        position: payload.position,
        department: payload.department,
        date_of_joining: payload.date_of_joining || new Date().toISOString().split('T')[0],
        status: 'Active',
        grade_id: payload.grade_id || null,
      })
      .select()
      .single();

    if (employeeError) {
      console.error('Employee record error:', employeeError);
      return NextResponse.json(
        { error: `Failed to create employee record: ${employeeError.message}` },
        { status: 400 }
      );
    }

    // Step 4: Get Employee role and assign it
    const { data: roleData, error: roleQueryError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'Employee')
      .single();

    if (roleQueryError) {
      console.error('Error fetching Employee role:', roleQueryError);
      return NextResponse.json(
        { error: `Failed to find Employee role: ${roleQueryError.message}` },
        { status: 400 }
      );
    }

    if (!roleData) {
      return NextResponse.json(
        { error: 'Employee role not found in the system' },
        { status: 400 }
      );
    }

    // Assign Employee role to user
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleData.id,
        company_id: payload.company_id,
      });

    if (roleError) {
      console.error('Error assigning Employee role:', roleError);
      return NextResponse.json(
        { error: `Failed to assign Employee role: ${roleError.message}` },
        { status: 400 }
      );
    }

    console.log('✅ Employee role assigned successfully to user:', userId);

    // Step 5: Assign company
    const { error: companyError } = await supabaseAdmin
      .from('user_companies')
      .insert({
        user_id: userId,
        company_id: payload.company_id,
        is_primary: true,
      });

    if (companyError) {
      console.warn('Warning: Failed to assign company:', companyError.message);
    }

    // Step 6: Send welcome email (non-blocking - don't fail if email fails)
    let emailSent = false; // tracked in response
    try {
      const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/email/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: payload.email,
          first_name: payload.first_name,
          last_name: payload.last_name,
          temporary_password: temporaryPassword,
        }),
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        emailSent = emailData.email_sent ?? false;
        console.log(`✅ Welcome email sent to ${payload.email}`);
      } else {
        console.warn(`⚠️ Failed to send welcome email to ${payload.email}:`, emailResponse.statusText);
        emailSent = false;
      }
    } catch (emailError) {
      console.warn(`⚠️ Email sending error: ${(emailError as Error).message}`);
      emailSent = false;
      // Don't fail employee creation if email fails
    }

    return NextResponse.json( 
      {
        success: true,
        data: {
          userId,
          employeeId: employeeData.id,
          email: payload.email,
          temporaryPassword,
          first_name: payload.first_name,
          last_name: payload.last_name,
          message: 'Employee created successfully. Share the temporary password with the employee.',
          emailSent,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
