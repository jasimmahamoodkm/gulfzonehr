# Phase 1.1 Implementation Checklist

## Status: ✅ Code Implementation Complete

All Phase 1.1 code changes have been implemented. Ready for testing and migration application.

---

## 📋 Implementation Summary

### What Was Done

#### 1. ✅ Migration Created
**File:** `migrations/011_create_user_companies.sql`
- Creates `user_companies` junction table
- Many-to-many relationship between users and companies
- Includes `is_primary` flag to mark default company
- RLS policies for data access control
- Backfill logic for existing data
- Indexes for performance

#### 2. ✅ AuthContext Enhanced
**File:** `src/context/AuthContext.tsx`
- Added `UserCompany` interface
- Added `userCompanies` state to track all companies for user
- Added `selectedCompanyId` state to track currently selected company
- Implemented `loadUserCompanies()` method that:
  - Fetches all companies from `user_companies` table
  - Gets company details from `companies` table
  - Auto-selects company:
    - If 1 company: Auto-select it (no UI)
    - If 2+ companies: Requires selection (show UI)
    - If primary company marked: Select primary by default
- Updated `login()` to auto-select company
- Updated `initializeAuth()` to auto-select on app load
- Updated auth state change listener to handle companies
- Added `switchCompany(companyId)` method for Phase 1.2
- Updated context value to expose new properties

#### 3. ✅ Type Definitions Updated
**File:** `src/types/auth.ts`
- Added `UserCompany` interface with:
  - `company_id`: UUID of company
  - `company_name`: Name for display
  - `is_primary`: Boolean flag for primary company
  - `assigned_at`: Timestamp of assignment
- Updated `AuthContextType` interface with:
  - `userCompanies`: Array of all user's companies
  - `selectedCompanyId`: Currently selected company ID
  - `switchCompany()`: Method to switch between companies

#### 4. ✅ Login Page Simplified
**File:** `src/app/login/page.tsx`
- Removed complex company selection logic
- Now uses auto-selection from AuthContext
- Shows company selection ONLY if user has 2+ companies
- Company selection displays:
  - All user's companies as selectable buttons
  - Primary company highlighted
  - Clear indication of primary vs additional companies
- Automatic redirect after:
  - Company selection (if multiple companies)
  - Login (if single company)
- Redirect logic:
  - Employees → `/employee-dashboard`
  - Others → `/dashboard` or redirect param

---

## 🔍 Key Features

### Auto-Selection Logic

**Single Company Users (HR Manager, Employee, Department Manager):**
```
Login → Auto-select company → Redirect to dashboard
(No company selection UI shown)
```

**Multi-Company Admins (Company Admin, Super Admin):**
```
Login → Show company selection UI → Select company → Redirect to dashboard
(UI only shown if 2+ companies)
```

### Database Structure

```
user_companies table:
├─ id (UUID, primary key)
├─ user_id (FK to users)
├─ company_id (FK to companies)
├─ is_primary (boolean) ← Default company flag
├─ assigned_at (timestamp)
└─ Unique constraint: (user_id, company_id)
```

### Context Exposure

AuthContext now exposes:
- `userCompanies: UserCompany[]` - All assigned companies
- `selectedCompanyId: string | null` - Currently selected
- `switchCompany(companyId)` - For switching (Phase 1.2)

---

## 📊 Testing Preparation

### Before Testing

1. **Apply Migration:** Run `migrations/011_create_user_companies.sql` in Supabase
2. **Backfill Data:** Migration automatically moves existing company_id to user_companies
3. **Restart Server:** `npm run dev`

### Test Scenarios Prepared

#### Scenario 1: Single Company User
- Employee with 1 company assigned
- Login → Auto-select → No UI shown → Redirect to dashboard
- **Expected:** Seamless login without company selection

#### Scenario 2: Multi-Company Admin
- Company Admin with 3 companies assigned
- Login → Show selection UI → Pick company → Redirect to dashboard
- **Expected:** Selection UI appears with all companies

#### Scenario 3: Primary Company
- Admin with 3 companies, 1 marked primary
- Login → Auto-select primary by default → Show selection UI if clicked
- **Expected:** Primary company highlighted and pre-selected

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `src/context/AuthContext.tsx` | Added company loading, auto-selection, company switching |
| `src/types/auth.ts` | Added UserCompany interface, updated AuthContextType |
| `src/app/login/page.tsx` | Simplified to use auto-selection, conditional UI |
| `migrations/011_create_user_companies.sql` | NEW: user_companies table creation |

**No Breaking Changes:** All existing functionality preserved, only enhanced.

---

## 🔄 Data Flow Diagram

```
User Login
  │
  ├─→ AuthContext.login()
  │     │
  │     ├─→ Supabase Auth (email/password)
  │     │
  │     └─→ Load user_companies
  │           │
  │           ├─→ Fetch from user_companies table
  │           ├─→ Get company names from companies table
  │           └─→ Auto-select:
  │                 ├─ 1 company: Select it
  │                 └─ 2+ companies: Show UI
  │
  ├─→ Set userCompanies in state
  ├─→ Set selectedCompanyId in state
  │
  └─→ Redirect:
      ├─ If no selection needed: Direct redirect
      └─ If selection needed: Show UI then redirect
```

---

## 🛡️ Security Considerations

✅ **RLS Policies:** user_companies table has RLS enabled
- Users can only see their own company assignments
- Admins can manage company assignments

✅ **Backfill Logic:** Safe data migration
- Checks if company_id column exists before backfilling
- Uses `ON CONFLICT DO NOTHING` to prevent duplicates

✅ **Authorization:** Company selection validated
- switchCompany() verifies user has access to company
- No way to select unauthorized company

---

## ⏭️ What's Next

### Phase 1.1 → Phase 1.2
**Timeline:** After Phase 1.1 testing passes

**Phase 1.2 Tasks:**
1. Add "Switch Company" dropdown to Header component
2. Only visible if user has 2+ companies
3. Clicking triggers `switchCompany()` from AuthContext
4. Updates selected company and permissions

**Files to Modify:**
- `src/components/layout/Header.tsx`

---

## 🧪 Testing Checklist

### Pre-Testing
- [ ] Migration applied to Supabase
- [ ] Dev server restarted
- [ ] Check `user_companies` table created in Supabase
- [ ] Verify RLS policies are enabled
- [ ] Check backfill: existing data migrated to user_companies

### Single Company Flow
- [ ] Login as Employee with 1 company
- [ ] No company selection UI appears
- [ ] Auto-redirects to employee-dashboard
- [ ] Sidebar shows correct company name
- [ ] Check console: "✅ Auto-selected only company: [UUID]"

### Multi-Company Flow
- [ ] Login as Admin with 2+ companies
- [ ] Company selection UI appears
- [ ] All companies shown with selection buttons
- [ ] Primary company highlighted
- [ ] Click company → Redirect to dashboard
- [ ] Check console: "✅ Company selected: [name]"

### Edge Cases
- [ ] User with 0 companies (if possible) → Handle gracefully
- [ ] User with deleted company → Skip deleted in list
- [ ] Logout then login → Re-select company if multiple
- [ ] Page refresh → Company selection persists in context

### Browser Console Logs
Should see:
- `📍 Loading user companies for userId: [...]`
- `✅ user_companies fetched: [...]`
- `✅ Companies fetched: [...]`
- `✅ Merged companies: [...]`
- `✅ Auto-selected [only/from multiple] company: [UUID]`

---

## 🆘 Troubleshooting

### Migration Fails
**Check:**
1. All SQL syntax is correct
2. Tables users, companies exist
3. Foreign keys are valid
4. Service role has permission

**Fix:**
1. Review error message in Supabase
2. Check that users and companies tables exist
3. Try manual SQL queries first

### No Companies After Login
**Check:**
1. Is user_companies table created?
2. Does user have any company_id in users table?
3. Is backfill logic running?

**Fix:**
1. Manually insert test data:
   ```sql
   INSERT INTO user_companies (user_id, company_id, is_primary)
   VALUES ('user-id-here', 'company-id-here', true)
   ```
2. Restart server
3. Log out and log back in

### Company Selection UI Not Showing
**Check:**
1. User has 2+ companies assigned?
2. Are userCompanies loaded in AuthContext?
3. Are console logs showing the companies?

**Fix:**
1. Verify user_companies records exist for user
2. Check browser console for loadUserCompanies logs
3. Check that login response includes companies

### Wrong Company Selected
**Check:**
1. Is is_primary flag set correctly?
2. Are multiple companies with is_primary=true?

**Fix:**
1. In Supabase, set only ONE company as primary per user:
   ```sql
   UPDATE user_companies 
   SET is_primary = false 
   WHERE user_id = 'xxx' 
   AND company_id != 'yyy'
   ```

---

## 📞 Support Resources

- **Migration Reference:** `PHASE_1_REVISED_DESIGN.md` - Database schema section
- **Auth Flow:** `src/context/AuthContext.tsx` - loadUserCompanies() method
- **Login UI:** `src/app/login/page.tsx` - company selection logic

---

## ✨ Success Criteria

All of these must be TRUE for Phase 1.1 to be considered complete:

- [ ] Migration applied without errors
- [ ] user_companies table created with correct schema
- [ ] Single company users auto-select (no UI shown)
- [ ] Multi-company users see selection UI
- [ ] Company selection works correctly
- [ ] Redirect works (employee-dashboard for employees, dashboard for others)
- [ ] Sidebar shows selected company name
- [ ] No console errors during login
- [ ] Console logs show expected flow
- [ ] userCompanies exposed in AuthContext
- [ ] selectedCompanyId exposed in AuthContext
- [ ] switchCompany() method available (ready for Phase 1.2)

---

## 🎯 Summary

**Phase 1.1 is code-complete and ready for:**
1. Migration application in Supabase
2. Comprehensive testing
3. Bug fixes (if any)
4. Transition to Phase 1.2

**Next Step:** Apply migration and run through testing checklist.

---

*Last Updated: May 11, 2026*
*Phase: 1.1 (Auto-selection + user_companies table)*
*Status: ✅ Implementation Complete*
