# Password Change Flow - Complete Testing Guide

## Summary of Fixes Applied

The password change flow had two issues: (1) the `completePasswordChange` method was missing, and (2) `userCompanies` weren't being loaded, causing errors. Both have been fixed:

### 1. AuthContext.tsx - Method Implementation
✅ **ADDED**: `completePasswordChange(newPassword: string)` method with 6 steps:
1. Update password in Supabase Auth
2. Get session and extract bearer token
3. Call `/api/auth/clear-temporary-password` API with Bearer token
4. Update local user state
5. Refresh session to ensure metadata is up-to-date
6. Verify flag was actually cleared

✅ **ADDED**: `userCompanies` and `selectedCompanyId` state management
✅ **ADDED**: `switchCompany()` method
✅ **ADDED**: All missing properties to context value object

### 2. API Route - Type Safety
✅ **FIXED**: TypeScript error in `/api/auth/clear-temporary-password/route.ts` (line 70)
- Changed from accessing `updateData?.user_metadata` directly
- Now properly accesses `(updateData as any)?.user?.user_metadata`

### 3. Error Handling Improvements
✅ **IMPROVED**: Better error messages in `loadUserRolesAndPermissions()`
- Now logs actual error messages instead of empty objects
- Provides detailed error context for debugging
- Gracefully handles missing data

### 4. User Companies Loading
✅ **ADDED**: New `loadUserCompanies(userId)` function
- Fetches user's companies from database
- Sets primary company as selected
- Populates `userCompanies` state for login page
- Called during login and session initialization

### 5. Login Page
✅ **VERIFIED**: Temporary password redirect check exists in two places:
- After successful login (useEffect)
- In company selection handler (handleCompanySelect)
- Redirects to `/change-password-required` when flag is true

### 4. Change Password Page
✅ **VERIFIED**: Page exists and properly:
- Calls `completePasswordChange()` on form submission
- Shows success message before redirect
- Auto-redirects to dashboard after 2 seconds
- Has proper error handling

---

## Testing Instructions

### Prerequisites
1. Dev server running: `npm run dev` (currently running on http://localhost:3000)
2. Browser access to http://localhost:3000
3. Open DevTools Console (Ctrl+Shift+I or Cmd+Shift+I)

### Test Flow

#### Step 1: Create Test Employee
```
1. Go to http://localhost:3000/employees
2. Click "Create Employee" button
3. Fill in:
   - Email: temptest@example.com
   - First Name: Test
   - Last Name: User
4. Click "Create Employee"
5. Copy the temporary password shown in modal
6. Close modal
```

#### Step 2: Logout
```
1. Click Logout button (top right)
2. Wait for redirect to /login
3. Console should show: "Logging out..."
```

#### Step 3: Login with Temporary Password
```
1. Go to http://localhost:3000/login
2. Enter:
   - Email: temptest@example.com
   - Password: [temporary password from Step 1]
3. Click "Sign In"

Expected in Console:
✅ "🔑 User has temporary password, redirecting to change password page"

Expected Page:
- Should redirect to http://localhost:3000/change-password-required
```

#### Step 4: Change Password
```
1. Fill in new password: TestPass123!
2. Confirm password: TestPass123!
3. Click "Update Password"

Expected Console Logs (in order):
🔐 completePasswordChange called
📍 Step 1: Updating password in Supabase Auth...
✅ Password updated successfully in Supabase Auth
📍 Step 2: Clearing temporary password flag via API...
📍 Session data: { hasSession: true, hasAccessToken: true, tokenLength: [number] }
📍 Making API call to clear-temporary-password...
📍 API response status: 200
✅ Temporary password flag cleared: { success: true, message: '...', user_email: '...' }
📍 Step 3: Updating local user state...
✅ Local user state updated
📍 Step 4: Refreshing session...
✅ Session refreshed successfully
📍 Refreshed user metadata: { is_temporary_password: false, ... }
📍 Step 5: Verifying flag was cleared...
✅ Flag verification: { isFlagCleared: true, currentMetadata: { is_temporary_password: false, ... } }
✅ Password changed successfully!

Expected Page:
- Green success message: "Password changed successfully! Redirecting..."
- Should auto-redirect to /employee-dashboard after 2 seconds
```

#### Step 5: Verify New Password Works
```
1. After redirect to dashboard, click Logout
2. Go to http://localhost:3000/login
3. Enter:
   - Email: temptest@example.com
   - Password: TestPass123! (the new password)
4. Click "Sign In"

Expected:
✅ Should log in successfully
✅ Should redirect to /employee-dashboard
❌ Should NOT redirect to /change-password-required
```

---

## Troubleshooting

### Issue: Console shows "Error loading roles and permissions: {}"
**Cause**: Error messages not being properly logged (empty error object)

**FIXED**: Now logs detailed error messages with actual error text

**What to check:**
- Open DevTools Console (Ctrl+Shift+I)
- Look for messages starting with `❌ Error loading roles and permissions:`
- These should now show the actual error message instead of empty object
- Common cause: User doesn't have roles assigned in database

### Issue: Form shows "Updating Password..." and hangs
**Possible Causes:**
1. `completePasswordChange` method doesn't exist (FIXED in this update)
2. Token extraction failed
3. API endpoint not responding

**Solution:**
1. Check console for detailed error logs with emoji prefixes
2. Look for any errors with `❌` prefix
3. Check that `/api/auth/clear-temporary-password` is accessible
4. Restart dev server: `kill 3643` then `npm run dev`

### Issue: "❌ No access token available" error
**Cause:** Session not loaded properly after password update

**Solution:**
1. Hard refresh page (Ctrl+Shift+R)
2. Logout completely
3. Log back in with new password
4. If persists, check Supabase session status in DevTools

### Issue: Password change succeeds but redirect doesn't happen
**Cause:** Router not navigating properly

**Solution:**
1. Check browser console for navigation errors
2. Manually navigate to `/employee-dashboard`
3. Verify user role is set to "Employee"

### Issue: "❌ API error: 401" or "❌ Unauthorized"
**Cause:** Bearer token not being passed or is invalid

**Solution:**
1. Check that Authorization header is being sent
2. Verify token is not expired
3. Check API endpoint logs: `/api/auth/clear-temporary-password`
4. Ensure Supabase credentials are correct in `.env.local`

### Issue: Success logs appear but metadata still shows `is_temporary_password: true`
**Cause:** Session refresh didn't pick up the change or Supabase RLS policy issue

**Solution:**
1. Check Supabase RLS policies allow updates to user metadata
2. Verify service role key is correct in `.env`
3. Try: Hard refresh (Ctrl+Shift+R) then logout/login again

---

## Expected Console Output - Full Flow

### After Login with Temp Password:
```
🔑 User has temporary password, redirecting to change password page
```

### On Change Password Page - After Clicking "Update Password":
```
🔐 Starting password change...
📍 User ID: [uuid]
📍 Current is_temporary_password: true
🔐 completePasswordChange called
📍 Step 1: Updating password in Supabase Auth...
✅ Password updated successfully in Supabase Auth
📍 Step 2: Clearing temporary password flag via API...
📍 Session data: { hasSession: true, hasAccessToken: true, tokenLength: 800+ }
📍 Making API call to clear-temporary-password...
📍 API response status: 200
📍 API response headers: { contentType: 'application/json' }
✅ Temporary password flag cleared: { success: true, message: 'Temporary password flag cleared', user_email: 'temptest@example.com' }
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

---

## Success Criteria

- ✅ Form submission doesn't hang
- ✅ All 6 console log steps appear with correct emoji prefixes
- ✅ API returns status 200
- ✅ Success message appears (green box with redirect message)
- ✅ Auto-redirect to `/employee-dashboard` happens after 2 seconds
- ✅ New password works on next login
- ✅ No redirect loop back to `/change-password-required`

---

## Code Changes Summary

### Files Modified:
1. ✅ `src/context/AuthContext.tsx`
   - Added `completePasswordChange()` method with 6 steps and logging
   - Added `userCompanies`, `selectedCompanyId`, `switchCompany`
   - Updated value object to export all properties

2. ✅ `src/app/api/auth/clear-temporary-password/route.ts`
   - Fixed TypeScript error on metadata access

### Files Verified (No Changes Needed):
- `src/app/login/page.tsx` - Temporary password checks working
- `src/app/change-password-required/page.tsx` - Form and redirect logic correct
- `src/hooks/useAuth.ts` - Properly exports AuthContextType

---

## What Was The Problem?

The `completePasswordChange` method was **completely missing** from AuthContext.tsx. When users submitted the password change form, the code tried to call this non-existent function, which silently failed or threw an error that wasn't visible.

The form would show "Updating Password..." and hang indefinitely because:
1. The method didn't exist
2. Form submission couldn't complete
3. No error was displayed to the user
4. Page remained stuck in loading state

This is now fixed with a fully implemented method that includes comprehensive logging at each step.

---

## Next Steps After Testing

1. ✅ Complete the test flow above
2. ✅ Verify all console logs appear
3. ✅ Verify redirect happens automatically
4. ✅ Verify new password works on next login
5. 🔄 Test with multiple different passwords
6. 🔄 Test error scenarios (weak password, wrong company, etc.)
7. 🔄 Verify no regressions to other login/auth flows

---

**Status**: ✅ Ready for Testing
**Implementation**: Complete
**Compilation**: No errors related to password change flow
