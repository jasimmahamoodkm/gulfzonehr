# Employee Auto-Creation System Setup

## Overview

This system allows admins to create employee accounts with auto-generated temporary passwords. Employees can then login immediately with their email and temporary password, and the default role is "Employee".

## Setup Steps

### Step 1: Add Service Role Key to Environment

The API endpoint requires the Supabase service role key for admin operations.

1. **Get your Service Role Key:**
   - Go to Supabase Dashboard → Your Project
   - Settings → API
   - Copy the `service_role` (SECRET) key
   - ⚠️ IMPORTANT: This is a secret key - handle it carefully!

2. **Add to `.env.local`:**
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

3. **Do NOT commit this to git:**
   - Add to `.gitignore` if not already there
   - Only store in `.env.local` (local machine only)

### Step 2: Test the API

Use this curl command to test employee creation:

```bash
curl -X POST http://localhost:3000/api/admin/create-employee \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "company_id": "your-company-uuid-here",
    "phone": "+971501234567",
    "position": "Sales Executive",
    "department": "Sales",
    "date_of_joining": "2026-05-11"
  }'
```

**Expected Response (Success):**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "employeeId": "employee-uuid",
    "email": "john@example.com",
    "temporaryPassword": "A9#k2mL8@xQ1",
    "first_name": "John",
    "last_name": "Doe",
    "message": "Employee created successfully. Share the temporary password with the employee."
  }
}
```

### Step 3: Share Credentials with Employee

When you create an employee, you'll get:
1. **Email**: The login email
2. **Temporary Password**: A 12-character random password

Share these credentials with the employee:
```
Welcome to GulfZone HR System!

Your login credentials:
Email: john@example.com
Temporary Password: A9#k2mL8@xQ1

Please login at: http://localhost:3000/login

IMPORTANT: Change your password on first login for security!
```

### Step 4: Employee First Login

1. Employee visits `/login`
2. Enters email and temporary password
3. Logs in successfully → redirected to `/employee-dashboard`
4. Optionally: System can prompt to change password on first login

## How It Works

### Employee Creation Flow

```
Admin creates employee via API
        ↓
✅ Generate temporary password
✅ Create Supabase Auth user (email + password)
✅ Create users table record
✅ Create employees table record
✅ Assign "Employee" role
✅ Assign to company
        ↓
Employee data + temporary password returned
        ↓
Admin shares credentials with employee
        ↓
Employee logs in with email + temporary password
        ↓
Employee can access: My Dashboard, Leaves, Settings
```

### Generated Password Features

- **Length**: 12 characters
- **Format**: Mix of uppercase, lowercase, numbers, special characters
- **Example**: `A9#k2mL8@xQ1`
- **Security**: Random generation, not predictable

## API Endpoint Details

### Endpoint
```
POST /api/admin/create-employee
Authorization: Bearer <token>
```

### Request Body
```json
{
  "email": "required | string",
  "first_name": "required | string",
  "last_name": "required | string",
  "company_id": "required | UUID",
  "phone": "optional | string",
  "position": "optional | string",
  "department": "optional | string",
  "date_of_joining": "optional | YYYY-MM-DD"
}
```

### Success Response (201)
```json
{
  "success": true,
  "data": {
    "userId": "UUID",
    "employeeId": "UUID",
    "email": "string",
    "temporaryPassword": "string",
    "first_name": "string",
    "last_name": "string",
    "message": "string"
  }
}
```

### Error Responses

**400 - Missing fields:**
```json
{
  "error": "Missing required fields: email, first_name, last_name, company_id"
}
```

**400 - User exists:**
```json
{
  "error": "User with email example@test.com already exists"
}
```

**401 - Unauthorized:**
```json
{
  "error": "Unauthorized"
}
```

**500 - Server error:**
```json
{
  "error": "Error message"
}
```

## Optional: Force Password Change on First Login

To require employees to change their password on first login:

1. In the login page, check if user has `is_temporary_password` metadata flag
2. If true, redirect to `/change-password-required`
3. Force password change before accessing other pages

Example in login page:
```typescript
if (user?.user_metadata?.is_temporary_password) {
  router.push('/change-password-required');
}
```

## Temporary Password Policy

Current settings:
- ✅ Auto-generated: 12 random characters
- ✅ Mix of character types: Uppercase, lowercase, numbers, special chars
- ⚠️ No expiration: Password remains valid indefinitely (optional: add expiration logic)

To add expiration logic:
1. Add `created_at` timestamp to user metadata
2. Check password age during login
3. Redirect to change password if older than 30 days

## Security Notes

⚠️ **Important:**
1. **Service Role Key**: Never commit to git, only store in `.env.local`
2. **Temporary Passwords**: Secure channel to share with employees
3. **API Authentication**: Current implementation uses bearer token (upgrade to role-based auth)
4. **Email Confirmation**: Auto-confirmed by system (optional: require manual confirmation)

## Creating Multiple Employees

You can batch create employees. Example script:

```bash
#!/bin/bash

# Create multiple employees from CSV
while IFS=, read -r email first_name last_name company_id position; do
  curl -X POST http://localhost:3000/api/admin/create-employee \
    -H "Authorization: Bearer token" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"first_name\": \"$first_name\",
      \"last_name\": \"$last_name\",
      \"company_id\": \"$company_id\",
      \"position\": \"$position\"
    }"
done < employees.csv
```

## Troubleshooting

### Issue: "Service role key not found"
**Solution**: Check `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` set correctly

### Issue: "User already exists"
**Solution**: Use a different email address, or reset the user in Supabase

### Issue: "Failed to create employee record"
**Solution**: Check that the company_id exists in the companies table

### Issue: Temporary password not working
**Solution**: 
1. Verify the password was copied correctly
2. Check email matches exactly
3. Try resetting the password in Supabase

## Next Steps

1. ✅ Implement admin UI for employee creation (optional)
2. ✅ Add password change required flow (optional)
3. ✅ Add batch employee import from CSV (optional)
4. ✅ Add email notification when employee created (optional)
5. ✅ Upgrade API auth from bearer token to role-based (recommended)
