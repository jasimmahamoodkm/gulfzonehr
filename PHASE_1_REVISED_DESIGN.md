# Phase 1 Revised Design - Multi-Company & Auto-Selection

## Updated Requirements Summary

### 1. Company Selection Logic
- **Single Company User** (HR Manager, Employee, Department Manager):
  - Auto-select on login (skip selection UI)
  - No company switching
  
- **Multiple Companies User** (Admins only):
  - Show company selection on login (auto-populate if 1)
  - Can switch companies via header dropdown
  - Primary company marked for reference

### 2. Company Assignment Restrictions
- **Admins Only**: Can be assigned to multiple companies
  - Super Admin: All companies (system-wide)
  - Company Admin: Assigned to specific companies
  
- **Non-Admins**: Single company only
  - HR Manager: 1 company
  - Department Manager: 1 company
  - Employee: 1 company

### 3. Data Visibility
- **Display**: ALL companies' data at once
- **Filtering**: 
  - Users with 1 company: Filtered by default (no filter UI)
  - Users with multiple companies: 
    - Show data from all companies
    - Company filter dropdown to view single company
    - "All Companies" option in filter

### 4. Multi-Role Support
- Same user can have multiple roles in the SAME company
  - Example: User can be "Employee" + "HR Manager" in Company A
  - Roles are global, not per-company
  - Role-based permissions apply across all assigned companies

---

## Database Schema Changes

### Current Structure (To Be Changed)
```sql
users table:
  - id (UUID)
  - email
  - first_name
  - last_name
  - company_id (FK) ← Single company only
  - created_at
```

### New Structure (Recommended)
```sql
-- Users table (no company_id)
users table:
  - id (UUID)
  - email
  - first_name
  - last_name
  - created_at
  - updated_at

-- NEW: User to Company mapping (many-to-many)
user_companies table:
  - id (UUID)
  - user_id (FK to users)
  - company_id (FK to companies)
  - is_primary (boolean, default: false)
  - assigned_at (timestamp)
  - created_at (timestamp)
  
  UNIQUE: (user_id, company_id)
  INDEX: (user_id) - for fast lookup
  INDEX: (company_id) - for admin lookups
```

### Migration SQL
```sql
-- Create user_companies table
CREATE TABLE user_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, company_id)
);

-- Create indexes
CREATE INDEX idx_user_companies_user_id ON user_companies(user_id);
CREATE INDEX idx_user_companies_company_id ON user_companies(company_id);

-- Copy existing data (backfill from users.company_id)
INSERT INTO user_companies (user_id, company_id, is_primary)
SELECT id, company_id, true FROM users 
WHERE company_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Optional: Drop company_id from users after verification
-- ALTER TABLE users DROP COLUMN company_id;
```

### RLS Policies Update
```sql
-- Users can see their assigned companies
CREATE POLICY user_companies_select ON user_companies
FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Super Admin', 'Company Admin'))
    )
  )
);

-- Admins can manage user_companies
CREATE POLICY user_companies_admin ON user_companies
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('Super Admin', 'Company Admin')
  )
);
```

---

## Architecture Changes

### 1. AuthContext Enhancement
```typescript
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: UserRole[];
  companies: UserCompany[]; // NEW: all assigned companies
  selectedCompanyId: string; // NEW: currently selected company
}

interface UserCompany {
  company_id: string;
  company_name: string;
  is_primary: boolean;
  assigned_at: string;
}

// AuthContext should:
// 1. Load user + roles + all assigned companies
// 2. Auto-select company based on role and assignment count
// 3. Handle company switching
// 4. Persist selected company to localStorage
```

### 2. Login Flow (New)
```
User submits email/password
  ↓
Supabase authenticates user
  ↓
AuthContext loads:
  - User profile
  - User roles
  - User companies (from user_companies table)
  ↓
Is user admin? (Super Admin or Company Admin)
  ├─ YES: User has multiple companies?
  │   ├─ 1 company: Auto-select → Redirect to dashboard
  │   └─ 2+ companies: Show selection UI
  │
  └─ NO: Single company user
      └─ Auto-select company (no UI) → Redirect to dashboard
  ↓
Set CompanyContext with selected company
  ↓
Redirect to appropriate dashboard
```

### 3. User Creation/Management (New)
```
Admin creates user:
  ↓
Select Role:
  - Super Admin/Company Admin/HR Manager → Show company selection
  - Employee/Department Manager → Show company selection (single)
  ↓
Select Company/Companies:
  - If Admin role: Allow multiple checkboxes
  - If Non-Admin role: Single radio button
  ↓
Mark Primary Company:
  - If multiple: Radio button for primary
  - If single: Auto-marked as primary
  ↓
Save: Insert into users + user_companies
```

---

## File Changes Required

### New Files
1. **`migrations/011_create_user_companies.sql`**
   - Create user_companies table
   - Backfill existing data
   - Set RLS policies

2. **`src/hooks/useCompanies.ts`** (NEW)
   - Hook to get all user's companies
   - Hook to switch selected company
   - Hook to check if user can access company

### Modified Files

1. **`src/context/AuthContext.tsx`**
   - Load all companies on login (from user_companies)
   - Auto-select company based on count and role
   - Handle company switching
   - Store selected company in localStorage
   - Methods:
     - `login()` - load companies + auto-select
     - `switchCompany(companyId)` - change selected company
     - `getCompanies()` - return all assigned companies

2. **`src/app/login/page.tsx`**
   - Remove current company selection UI
   - Add new auto-select logic:
     ```typescript
     // If user has 1 company → Auto-select, redirect
     // If user has 2+ companies → Show selection UI
     // Show company selection only if multiple companies
     ```
   - Keep error handling and validation

3. **`src/components/layout/Header.tsx`**
   - Add "Switch Company" dropdown (if user has multiple companies)
   - Show current company name
   - Dropdown triggers `switchCompany()` on AuthContext
   - Only visible if user has 2+ companies
   - Format: `"Company: [Name] ▼"`

4. **`src/components/layout/Sidebar.tsx`**
   - No major changes
   - Company context still used for display
   - Module filtering remains same

5. **`src/context/CompanyContext.tsx`**
   - No changes needed
   - Still tracks selected company
   - AuthContext feeds into it

6. **`src/app/admin/users/page.tsx` (if exists) or new admin user management**
   - When creating/editing user:
     - Show company selection (single or multiple based on role)
     - Set is_primary company
     - Allow bulk assignment if multiple companies
   - Display validation:
     - Admin: Can select multiple companies
     - Non-Admin: Can only select 1 company
     - Show error if violates rules

7. **`src/app/employee-dashboard/page.tsx`**
   - Add company filter dropdown (if user has multiple companies)
   - Default: Show all companies' data
   - Filter options: "All Companies", "Company A", "Company B", etc.
   - Filter persists in localStorage

8. **`src/app/manager-dashboard/page.tsx`**
   - Add company filter dropdown
   - Show team data from:
     - Selected company (if filtering)
     - OR all assigned companies (if showing all)
   - Filter options same as employee dashboard

9. **`src/app/dashboard/page.tsx`**
   - Add company filter dropdown
   - Aggregate metrics across all assigned companies
   - Or show single company if filtered
   - Summary cards show selected/filtered data

10. **`src/app/employees/page.tsx`**
    - Add company filter dropdown
    - Show employees from all assigned companies
    - Or filter to single company
    - Filter persists in state

11. **All other pages** (attendance, leave, payroll, reports, etc.)
    - Add company filter dropdown
    - Update queries to handle multiple companies
    - Filter options: "All Companies" + individual companies

12. **`.env.local`** / **`migrations/` folder**
    - No changes, migration will be added to sequence

---

## Query Pattern Changes

### Current Query Pattern (Single Company)
```typescript
// Get employee data for logged-in user
const { data } = await supabase
  .from('employees')
  .select('*')
  .eq('company_id', user.company_id);
```

### New Query Pattern (Multiple Companies)
```typescript
// Get all companies for user
const { data: userCompanies } = await supabase
  .from('user_companies')
  .select('company_id')
  .eq('user_id', user.id);

const companyIds = userCompanies.map(uc => uc.company_id);

// Get employees from all user's companies (or selected)
const { data } = await supabase
  .from('employees')
  .select('*')
  .in('company_id', companyIds); // All companies
  
// OR with filtering
const { data } = await supabase
  .from('employees')
  .select('*')
  .eq('company_id', selectedCompanyId); // Single company
```

---

## UI/UX Changes

### Login Page
**Before:**
```
Email ————————
Password ————————
[Sign In]

(If no company) →
Company Selection:
○ Company A
○ Company B
[Select]
```

**After:**
```
Email ————————
Password ————————
[Sign In]

(If multiple companies) →
Select Your Company:
○ Company A (Primary)
○ Company B
○ Company C
[Select]

(If 1 company) →
Auto-redirects to dashboard
```

### Header
**Before:**
```
[Logo] Dashboard | Employees | Companies | Attendance | Leave | ...    [User ▼]
                                                                      Settings
                                                                      Logout
```

**After:**
```
[Logo] Company: Company A ▼ | Dashboard | Employees | ...    [User ▼]
       └─ Company A (selected)
       └─ Company B
       └─ Company C
```

### Dashboard/Tables
**Before:**
```
[Show all data for single company]
```

**After:**
```
Company Filter: [All Companies ▼]
                └─ All Companies
                └─ Company A
                └─ Company B
                └─ Company C

[Table shows data from all/selected companies]
```

### User Management
**Before:**
```
Create User:
  Email: ____
  Role: [Employee ▼]
  Company: [Company A ▼]
  [Create]
```

**After:**
```
Create User:
  Email: ____
  Role: [Company Admin ▼]
  
  (If Admin role selected)
  Companies: 
  ☐ Company A
  ☐ Company B
  ☐ Company C
  [Set Primary: Company A ▼]
  
  (If Non-Admin role)
  Company: [Company A ▼]
  
  [Create]
```

---

## Implementation Priority

### Phase 1.1 - Core Infrastructure
1. Create migration (user_companies table)
2. Update AuthContext to load all companies
3. Implement auto-selection logic
4. Update login page

### Phase 1.2 - UI Updates
1. Add company filter to dashboards
2. Add switch company dropdown to header
3. Update user creation flow

### Phase 1.3 - Data Queries
1. Update all page queries to handle multiple companies
2. Add filtering logic to dashboards
3. Test cross-company data isolation

### Phase 1.4 - Testing
1. Test single company users (auto-select)
2. Test admin with multiple companies (selection UI)
3. Test company switching from header
4. Test data filtering across companies
5. Test RLS policies

---

## Benefits of This Approach

✅ **Single Company Users**: Seamless auto-selection (simpler UX)  
✅ **Multi-Company Admins**: Full flexibility to manage multiple companies  
✅ **Company Switching**: Quick dropdown in header (no re-login)  
✅ **Data Aggregation**: See all companies OR filter by single company  
✅ **Role Simplicity**: Roles are global, not per-company  
✅ **Scalability**: Easy to add/remove companies per user  
✅ **RLS Compliance**: Database enforces access controls  

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Data leakage across companies | RLS policies on all tables |
| Complex queries | Parameterized queries with IN clause |
| Performance with many companies | Indexes on user_companies.user_id |
| User confusion about selected company | Clear company indicator in header |
| Accidental multi-company data mix | Add company_id WHERE clause to all queries |

---

## Testing Scenarios

1. **Single Company User (Employee)**
   - Login → Auto-select → Dashboard
   - No "Switch Company" option visible

2. **Multi-Company Admin (Company Admin)**
   - Login → Show selection UI → Select → Dashboard
   - Header shows "Company: X ▼"
   - Click to switch companies
   - Data updates based on selection

3. **Data Filtering**
   - Admin with Company A, B, C
   - Default: See all data
   - Filter to Company A: See only A's data
   - Filter to Company B: See only B's data
   - Filter to All: See all data again

4. **User Creation**
   - Create Employee with Company A
   - Create Admin with Companies A, B, C
   - Create Manager with Company A
   - Verify RLS allows correct access

---

## Summary

This revised design provides:
- ✅ Automatic company selection for simplicity
- ✅ Multi-company support for admins only
- ✅ Easy company switching for admins
- ✅ Aggregated data view with filtering
- ✅ Simple role model (global roles)
- ✅ Database-enforced security (RLS + user_companies)

Ready to implement? Proceed or have other questions?
