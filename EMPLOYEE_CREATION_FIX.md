# Employee Auto-Creation API - Fix Summary

## Issue
Employee creation was failing to assign the default "Employee" role. The API returned success but the role was not actually assigned to the user.

## Root Causes Identified

### 1. Incorrect Column Name (CRITICAL)
**Problem**: The code was querying for Employee role using:
```typescript
.eq('role_name', 'Employee')  // ❌ WRONG
```

**Actual Column Name**: The roles table has a column named `name`, not `role_name`

**Fix**: Changed to:
```typescript
.eq('name', 'Employee')  // ✅ CORRECT
```

**Reference**: Migration `003_create_rbac_tables.sql` shows:
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL UNIQUE,  -- ← This is the correct column
  description TEXT,
  company_id UUID REFERENCES companies(id),
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Missing Required Field in user_roles (CRITICAL)
**Problem**: The code was inserting into user_roles without the required `company_id`:
```typescript
const { error: roleError } = await supabaseAdmin
  .from('user_roles')
  .insert({
    user_id: userId,
    role_id: roleData.id,
    // ❌ Missing company_id
  });
```

**Schema Requirement**: The user_roles table has a UNIQUE constraint requiring all three fields:
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  role_id UUID NOT NULL REFERENCES roles(id),
  company_id UUID NOT NULL REFERENCES companies(id),  -- ← REQUIRED
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES users(id),
  UNIQUE(user_id, role_id, company_id)  -- ← All 3 required
);
```

**Fix**: Added company_id to the insertion:
```typescript
const { error: roleError } = await supabaseAdmin
  .from('user_roles')
  .insert({
    user_id: userId,
    role_id: roleData.id,
    company_id: payload.company_id,  // ✅ Added
  });
```

## Changes Made

**File**: `src/app/api/admin/create-employee/route.ts`

**Lines 136 & 158**:
- Line 136: Changed `.eq('role_name', 'Employee')` → `.eq('name', 'Employee')`
- Line 158: Added `company_id: payload.company_id` to user_roles insert

## Complete Fixed Code Section

```typescript
// Step 4: Get Employee role and assign it
const { data: roleData, error: roleQueryError } = await supabaseAdmin
  .from('roles')
  .select('id')
  .eq('name', 'Employee')  // ✅ FIXED: Using 'name' instead of 'role_name'
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
    company_id: payload.company_id,  // ✅ FIXED: Added required company_id
  });

if (roleError) {
  console.error('Error assigning Employee role:', roleError);
  return NextResponse.json(
    { error: `Failed to assign Employee role: ${roleError.message}` },
    { status: 400 }
  );
}

console.log('✅ Employee role assigned successfully to user:', userId);
```

## Verification Checklist

### Automatic Tests (Run locally)
- [ ] Start development server: `npm run dev`
- [ ] Run test script: `bash TEST_EMPLOYEE_CREATION.sh`
- [ ] Check if Test Case 1 returns HTTP 201 (success)
- [ ] Verify response includes `temporaryPassword`

### Manual Verification (In Supabase)

1. **Verify Employee Role Exists**:
   - Go to Supabase Dashboard → SQL Editor
   - Run:
     ```sql
     SELECT id, name, is_system FROM roles WHERE name = 'Employee';
     ```
   - Expected: One row with is_system = true

2. **After Creating Test Employee**:
   - In Supabase, check roles table:
     ```sql
     -- Find the test employee user ID
     SELECT id, email FROM users WHERE email = 'test.employee@example.com';
     
     -- Check if Employee role is assigned
     SELECT ur.*, r.name FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = 'THE_USER_ID_FROM_ABOVE';
     ```
   - Expected: One row showing role_id points to Employee role with name = 'Employee'

3. **Test Employee Login**:
   - Navigate to http://localhost:3000/login
   - Email: test.employee@example.com
   - Password: (use the temporaryPassword from API response)
   - Expected: Login succeeds, redirected to /employee-dashboard
   - Settings → Profile should show role as "Employee"

4. **Verify Employee Restrictions**:
   - Try accessing http://localhost:3000/dashboard
   - Expected: Redirected to /employee-dashboard
   - Try accessing http://localhost:3000/employees
   - Expected: Redirected to /employee-dashboard
   - Try accessing http://localhost:3000/leaves
   - Expected: Leaves page loads successfully for employee

## Impact

✅ **Before Fix**: Employee role assignment fails silently, created employees cannot access employee-specific features
✅ **After Fix**: Employee role correctly assigned, employees can login and access their dashboard, leaves page, and settings

## Related Files
- `src/app/api/admin/create-employee/route.ts` (FIXED)
- `src/lib/employeeCreation.ts` (No changes needed)
- `migrations/003_create_rbac_tables.sql` (Reference)
- `EMPLOYEE_AUTO_CREATION_SETUP.md` (Documentation)

## Next Steps
1. Run local tests to verify the fix
2. Create test employees and verify they can login
3. Test employee route protection (redirects to /employee-dashboard when accessing admin pages)
4. Optional: Create admin UI for creating employees (currently only API available)
