# Database Setup Instructions

## Quick Setup

### Step 1: Go to Supabase SQL Editor
1. Open your Supabase project at https://app.supabase.com
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 2: Create Documents Table
Copy and paste the SQL from `migrations/001_create_documents_table.sql` into the SQL editor and execute.

This creates:
- `documents` table with fields: document_type, document_number, issue_date, expiry_date, issuing_authority
- Automatic indexes for performance
- Row-level security policies for company isolation

### Step 3: Verify Other Tables
The following tables should already exist:
- ✅ companies
- ✅ employees
- ✅ attendance
- ✅ leaves
- ✅ payroll
- ✅ users

If any are missing, contact the development team for migration scripts.

## Database Schema

### Documents Table
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  employee_id UUID REFERENCES employees(id),
  document_type VARCHAR,
  document_number VARCHAR,
  issue_date DATE,
  expiry_date DATE,
  issuing_authority VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Testing After Setup

1. Log in to the application
2. Navigate to **Document Management**
3. Select a company from the header
4. Click **Add Document** and fill in the form
5. Verify the document appears in the list with correct status (Active/Expiring Soon/Expired)

## Troubleshooting

**Error: "Could not find table 'public.documents'"**
- Run the SQL migration from Step 2 above
- Ensure you're executing it in the correct database

**Documents not appearing:**
- Verify company is selected in header
- Check browser console for errors (F12)
- Verify document expiry_date is correctly formatted (YYYY-MM-DD)

## Document Features

The Documents Management page tracks:
- Document type (Passport, Driving License, Emirates ID, Company License, Other)
- Document number and issuing authority
- Issue and expiry dates
- Automatic status calculation (Active/Expiring Soon/Expired)
- Days until expiry display

## File Attachment Setup

### Step 3: Create Storage Bucket for Document Files
1. Go to **Storage** in Supabase dashboard
2. Click **New Bucket**
3. Name it: `documents`
4. Set privacy: **Private**
5. Click **Create**
6. Go to **Policies** (under Storage)
7. Create a new policy for the documents bucket:
   - **Policy name:** Allow document uploads
   - **Policy definition:** Add your auth condition
   - **Operations:** SELECT, INSERT, UPDATE, DELETE
8. Run the SQL migration: `migrations/002_add_file_url_to_documents.sql`

### Document Upload Features
- Supports: PDF, DOC, DOCX, JPG, PNG, TXT files
- Max file size: 10MB per file
- Files stored securely in Supabase Storage
- Automatic file organization by company and employee
