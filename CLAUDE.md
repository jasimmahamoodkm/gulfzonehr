# GulfZone HR Management System - Project Documentation

## Project Overview

This is a comprehensive HR Management System built for GulfZone Group. It's a full-stack web application designed to manage multiple companies and their employees with features including attendance tracking, leave management, payroll processing, and reporting.

## Architecture

### Frontend
- **Framework**: Next.js 16+ with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Pattern**: Component-based with custom UI library
- **State Management**: React Context API + Local State
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js (via Next.js API routes)
- **Database**: Supabase (PostgreSQL)
- **ORM**: Direct SQL queries with Supabase client

### Design System
- **Theme**: Light professional theme
- **Colors**: Blue primary, Teal secondary, with supporting colors
- **Components**: Reusable, composable UI components
- **Icons**: Lucide React

## Project Structure

```
src/
├── app/                    # Next.js 15 app router
│   ├── layout.tsx         # Root layout wrapper
│   ├── page.tsx           # Home/landing page
│   ├── dashboard/         # Dashboard with analytics
│   ├── employees/         # Employee CRUD
│   ├── companies/         # Company management
│   ├── attendance/        # Attendance tracking
│   ├── leave/            # Leave requests & approvals
│   ├── payroll/          # Salary & payroll
│   ├── reports/          # Reports generation
│   └── settings/         # User & app settings
├── components/
│   ├── ui/               # Reusable UI components
│   │   ├── Button.tsx    # Styled button with variants
│   │   ├── Input.tsx     # Form input with validation
│   │   ├── Card.tsx      # Card container component
│   │   ├── Modal.tsx     # Dialog/modal component
│   │   └── Table.tsx     # Data table component
│   └── layout/           # Layout components
│       ├── Header.tsx    # Top navigation bar
│       ├── Sidebar.tsx   # Side navigation menu
│       └── Layout.tsx    # Main layout wrapper
├── types/
│   └── index.ts          # TypeScript interfaces & types
├── styles/
│   └── globals.css       # Global Tailwind styles
├── lib/                  # Utility functions
├── hooks/                # Custom React hooks
└── utils/                # Helper functions
```

## Key Features Implemented

### 1. Dashboard (`/dashboard`)
- Key metrics cards (employees, companies, projects, leaves)
- Employee growth trend chart
- Recent hires list
- Department productivity metrics
- Upcoming events timeline

### 2. Employee Management (`/employees`)
- List all employees with filtering & search
- Search by name, email, department
- Filter by department and status
- Add new employee modal
- Edit & delete functionality
- Status badges (Active, On Leave, Inactive)

### 3. Company Management (`/companies`)
- Company cards with key information
- Company table with sortable columns
- Add new company functionality
- Location and contact information display
- Employee count per company

### 4. Attendance Management (`/attendance`)
- Daily attendance overview
- Check-in/check-out tracking
- Attendance statistics (present, late, absent, on leave)
- Manual attendance entry
- Date selector for historical data
- Work hours calculation

### 5. Leave Management (`/leave`)
- Leave request submission
- Leave type categorization (vacation, sick, personal, maternity)
- Leave balance tracking
- Approval workflow (pending, approved, rejected)
- Company-wide leave overview
- Leave statistics

### 6. Payroll Processing (`/payroll`)
- Monthly payroll processing
- Salary calculations with components:
  - Basic salary
  - Allowances
  - Deductions
- Payment status tracking (draft, processed, paid)
- Payroll summaries
- Export payroll reports
- Generate pay slips

### 7. Reports (`/reports`)
- Multiple report types:
  - Employee summary
  - Attendance analysis
  - Payroll reports
  - Leave utilization
  - Turnover analysis
  - Department performance
- Report generation with filters
- Export functionality
- Recent reports history

### 8. Settings (`/settings`)
- Profile management
- Organization settings
- Password management
- Two-factor authentication
- Session management
- Email & SMS notification preferences

## Development Guidelines

### Component Development
1. **UI Components** (`src/components/ui/`):
   - Keep components small and focused
   - Use React.forwardRef for components accepting refs
   - Accept className prop for customization
   - Include proper TypeScript types

2. **Layout Components** (`src/components/layout/`):
   - Header: Navigation and user menu
   - Sidebar: Main navigation menu
   - Layout: Wrapper component for pages

3. **Page Components** (`src/app/*/page.tsx`):
   - Use 'use client' directive for interactive pages
   - Import Layout wrapper component
   - Implement proper state management
   - Add error boundaries as needed

### Styling
- Use Tailwind CSS utility classes
- Custom colors defined in `tailwind.config.js`
- Consistent spacing using Tailwind scale
- Responsive design with `md:` and `lg:` breakpoints
- Light theme with appropriate contrast ratios

### Type Safety
- Define interfaces in `src/types/index.ts`
- Use TypeScript for all components
- Export types from interfaces, not implementations
- Avoid `any` type - be specific with types

## Database Setup

### Supabase Tables Required

```sql
-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  phone VARCHAR,
  address TEXT,
  city VARCHAR,
  country VARCHAR,
  industry VARCHAR,
  founded_year INTEGER,
  employee_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  phone VARCHAR,
  position VARCHAR,
  department VARCHAR,
  date_of_joining DATE,
  date_of_birth DATE,
  address TEXT,
  city VARCHAR,
  country VARCHAR,
  salary DECIMAL(12,2),
  employment_type VARCHAR,
  status VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  status VARCHAR,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leaves table
CREATE TABLE leaves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  leave_type VARCHAR,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER,
  reason TEXT,
  status VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payroll table
CREATE TABLE payroll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES employees(id),
  month VARCHAR,
  salary DECIMAL(12,2),
  bonus DECIMAL(12,2) DEFAULT 0,
  deductions DECIMAL(12,2) DEFAULT 0,
  net_pay DECIMAL(12,2),
  status VARCHAR,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table (for authentication)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR UNIQUE NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  role VARCHAR,
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   - Copy `.env.example` to `.env.local`
   - Add Supabase credentials

3. **Database Setup**:
   - Create Supabase project
   - Run SQL migrations from Database Setup section
   - Enable RLS on tables for security

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

## Coding Conventions

### File Naming
- Components: PascalCase (e.g., `Button.tsx`)
- Pages: lowercase (e.g., `page.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Types/Interfaces: PascalCase (e.g., `Employee.ts`)

### Variable & Function Naming
- Constants: UPPER_SNAKE_CASE
- Variables/Functions: camelCase
- React components: PascalCase

### Imports
- Import React first
- Then third-party libraries
- Then local components/utilities
- Then styles

### Comments
- Use for explaining 'why', not 'what'
- Single-line comments for small notes
- Avoid obvious comments

## Performance Considerations

1. **Code Splitting**: Next.js handles automatic route-based splitting
2. **Image Optimization**: Use next/image for images
3. **Client Components**: Use 'use client' only when necessary
4. **Database Queries**: Implement pagination for large datasets
5. **State Management**: Keep state as close to usage as possible

## Security Considerations

1. **Environment Variables**: Keep sensitive data in `.env.local`
2. **Authentication**: Implement Supabase Auth
3. **RLS Policies**: Enable Row Level Security in Supabase
4. **Input Validation**: Use Zod for form validation
5. **CSRF Protection**: Next.js handles this by default
6. **XSS Prevention**: React handles escaping by default

## Testing Strategy

- Unit tests for utilities and hooks
- Integration tests for components
- E2E tests for critical user flows
- Manual testing for UI/UX

## Deployment

### Recommended Platforms
- **Vercel** (optimal for Next.js)
- **Netlify**
- **AWS Amplify**

### Pre-deployment Checklist
- [ ] Run `npm run type-check`
- [ ] Run `npm run build` successfully
- [ ] Update `.env` with production values
- [ ] Test all features in production build
- [ ] Set up monitoring & logging
- [ ] Configure backups

## Future Enhancements

1. Employee self-service portal
2. Mobile app (React Native)
3. Advanced analytics dashboards
4. Email notification system
5. Document management
6. Performance reviews
7. Training modules
8. Organizational chart
9. API for third-party integrations
10. Audit logging

## Common Issues & Solutions

### Issue: Database connection fails
**Solution**: Verify Supabase credentials in `.env.local`

### Issue: Styles not applying
**Solution**: Ensure Tailwind CSS is processing files in `tailwind.config.js`

### Issue: Type errors
**Solution**: Run `npm run type-check` and fix TypeScript errors

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)

## Contact & Support

For issues, questions, or suggestions, contact the GulfZone HR development team.

---

**Last Updated**: May 2026
**Version**: 1.0.0
