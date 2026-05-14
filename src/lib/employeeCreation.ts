import { supabase } from '@/lib/supabase';

/**
 * Generate a random temporary password
 * Format: 8 characters with mix of uppercase, lowercase, numbers, and special chars
 */
export const generateTemporaryPassword = (): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';

  const all = uppercase + lowercase + numbers + special;

  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

interface CreateEmployeeParams {
  email: string;
  first_name: string;
  last_name: string;
  company_id: string;
  phone?: string;
  position?: string;
  department?: string;
  date_of_joining?: string;
}

interface CreateEmployeeResult {
  success: boolean;
  data?: {
    userId: string;
    employeeId: string;
    email: string;
    temporaryPassword: string;
    first_name: string;
    last_name: string;
  };
  error?: string;
}

/**
 * Create a new employee with automatic user account
 * Returns the employee data and a temporary password for first login
 */
export const createEmployeeWithAuth = async (
  params: CreateEmployeeParams
): Promise<CreateEmployeeResult> => {
  try {
    // Step 1: Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Step 2: Create Supabase Auth user using admin API (must be called from server)
    // For now, we'll create the user through a server API endpoint
    // This will be handled by an API route

    // Step 3: Create users table record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        email: params.email,
        first_name: params.first_name,
        last_name: params.last_name,
        company_id: params.company_id,
        // We'll set the role through the user_roles table
      })
      .select()
      .single();

    if (userError) {
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    // Step 4: Create employee record
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .insert({
        company_id: params.company_id,
        first_name: params.first_name,
        last_name: params.last_name,
        email: params.email,
        phone: params.phone,
        position: params.position,
        department: params.department,
        date_of_joining: params.date_of_joining || new Date().toISOString().split('T')[0],
        status: 'Active',
      })
      .select()
      .single();

    if (employeeError) {
      throw new Error(`Failed to create employee record: ${employeeError.message}`);
    }

    // Step 5: Assign Employee role to the user
    const { data: roleData } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'Employee')
      .single();

    if (roleData) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userData.id,
          role_id: roleData.id,
        });

      if (roleError) {
        console.warn('Warning: Failed to assign Employee role:', roleError.message);
      }
    }

    // Step 6: Assign to company
    const { error: companyError } = await supabase
      .from('user_companies')
      .insert({
        user_id: userData.id,
        company_id: params.company_id,
        is_primary: true,
      });

    if (companyError) {
      console.warn('Warning: Failed to assign company:', companyError.message);
    }

    return {
      success: true,
      data: {
        userId: userData.id,
        employeeId: employeeData.id,
        email: params.email,
        temporaryPassword,
        first_name: params.first_name,
        last_name: params.last_name,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};
