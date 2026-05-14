# Password Change Flow Debugging Guide

## Overview
This guide helps debug the password change flow when a user logs in with a temporary password and needs to change it.

## Expected Flow

```
1. User logs in with temp password
   ↓
2. AuthContext checks is_temporary_password flag
   ↓
3. LoginPage detects flag and redirects to /change-password-required
   ↓
4. User fills password form and submits
   ↓
5. completePasswordChange() is called:
   a. Updates password in Supabase Auth
   b. Gets current session and access token
   c. Calls /api/auth/clear-temporary-password with token
   d. Clears is_temporary_password flag in user metadata
   e. Updates local user state
   f. Refreshes session
   g. Verifies flag was cleared
   ↓
6. Page shows success message
   ↓
7. Auto-redirect to /employee-dashboard after 2 seconds
```

## Step-by-Step Debug Instructions

### 1. Open Browser Developer Console
- Press `Ctrl+Shift+I` (Windows) or `Cmd+Shift+I` (Mac)
- Go to **Console** tab
- Keep this open throughout testing

### 2. Create Test Employee
Go to `/employees` page:
- Click "Create Employee" button
- Fill in:
  - Email: `testuser@example.com`
  - First Name: `Test`
  - Last Name: `User`
- Click "Create Employee"
- Copy the temporary password shown
- Note the employee ID and password

### 3. Logout and Test Login
- Click Logout button
- You should see "Logging out..." message
- Should redirect to /login page after redirect

### 4. Login with Temporary Password
Go to `/login`:
- Enter email: `testuser@example.com`
- Enter password: (the temporary password you copied)
- Click Sign In

### 5. Monitor Console for These Log Messages

**After Login (in LoginPage):**
```
🔑 User has temporary password, redirecting to change password page
```

**Expected Redirect:**
- Should redirect to `/change-password-required`

**On Change Password Page:**
```
🔐 Starting password change...
📍 User ID: [uuid]
📍 Current is_temporary_password: true
```

### 6. Change Password
- Fill in:
  - New Password: `NewPassword123!`
  - Confirm Password: `NewPassword123!`
- Click "Update Password"

### 7. Monitor Console During Password Change

**Expected logs in order:**

```
🔐 completePasswordChange called
📍 Step 1: Updating password in Supabase Auth...
✅ Password updated successfully in Supabase Auth
📍 Step 2: Clearing temporary password flag via API...
📍 Session data: { hasSession: true, hasAccessToken: true, tokenLength: [number] }
📍 Making API call to clear-temporary-password...
📍 API response status: 200
📍 Temporary password flag cleared: { success: true, message: '...', user_email: 'testuser@example.com' }
📍 Step 3: Updating local user state...
✅ Local user state updated
📍 Step 4: Refreshing session...
✅ Session refreshed successfully
📍 Refreshed user metadata: { is_temporary_password: false, ... }
📍 Step 5: Verifying flag was cleared...
✅ Flag verification: { isFlagCleared: true, currentMetadata: { is_temporary_password: false, ... } }
✅ Password changed successfully
🔄 Redirecting to employee dashboard...
```

## Troubleshooting

### Scenario 1: No logs appear after clicking "Update Password"
**Problem**: Form submission not being called
**Solution**:
- Check browser console for form validation errors
- Click "Update Password" again
- Look for red error messages in the form

### Scenario 2: Logs stop at "Step 1"
**Problem**: Password update in Supabase Auth failed
**Console**: `❌ Password update error: [error details]`
**Solution**:
- Password may not meet Supabase requirements
- Try a stronger password with numbers and symbols
- Check Supabase logs for more details

### Scenario 3: Logs stop at "Making API call"
**Problem**: API endpoint call is hanging
**Solution**:
- Check if `/api/auth/clear-temporary-password` endpoint is responding
- Use curl to test:
```bash
curl -X POST http://localhost:3000/api/auth/clear-temporary-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]"
```

### Scenario 4: Logs stop at "API response status"
**Problem**: API endpoint returned an error
**Console**:
```
❌ API error response (JSON): { error: 'specific error message' }
```

**Common errors:**
- `Unauthorized: No user in token` → Token extraction failed
- `Failed to clear temporary password flag: [message]` → Database update failed

**Solution**:
- Check endpoint logs: `tail -f /tmp/dev-server.log | grep clear-temporary`
- Verify token is being passed correctly
- Check Supabase user metadata structure

### Scenario 5: Success logs appear but no redirect
**Problem**: Password changed but page not redirecting
**Console**: Check for:
```
✅ Password changed successfully! Redirecting...
```

**Solution**:
- Manual redirect: Type in address bar: `/employee-dashboard`
- If that works, issue is with router.push()
- If that doesn't work, you may not have proper Employee role

### Scenario 6: Redirect to /change-password-required loop
**Problem**: After changing password, clicking a link redirects back to change-password-required
**Console**: Check if `is_temporary_password` is still true

**Solution**:
- Hard refresh page: `Ctrl+Shift+R` or `Cmd+Shift+R`
- Clear browser cache
- Sign out completely and log in again

## API Endpoint Testing

### Test the clear-temporary-password endpoint directly

1. Get a valid access token:
```bash
# In browser console:
const session = await supabase.auth.getSession();
const token = session.data?.session?.access_token;
console.log(token);
```

2. Copy the token and test:
```bash
curl -X POST http://localhost:3000/api/auth/clear-temporary-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [paste-token-here]"
```

3. Expected response:
```json
{
  "success": true,
  "message": "Temporary password flag cleared",
  "user_email": "testuser@example.com"
}
```

## Key Logs to Watch

| Log | Meaning |
|-----|---------|
| `🔐 completePasswordChange called` | Password change flow started |
| `✅ Password updated successfully` | Supabase auth password was updated |
| `📍 Session data: { hasSession: true... }` | Session exists and has token |
| `📍 API response status: 200` | API endpoint returned success |
| `✅ Flag verification: { isFlagCleared: true }` | Metadata flag was actually cleared |
| `✅ Password changed successfully!` | All steps completed, ready to redirect |

## If All Else Fails

1. Check the full error in console:
   - Look for `❌` prefixed messages
   - Copy the full error stack trace
   - Share in debugging discussion

2. Check server logs:
```bash
tail -50 /tmp/dev-server.log
```

3. Test database directly:
```sql
-- Check user metadata
SELECT id, email, user_metadata 
FROM auth.users 
WHERE email = 'testuser@example.com';
```

4. Restart dev server:
```bash
kill $(lsof -t -i :3000)
npm run dev
```
