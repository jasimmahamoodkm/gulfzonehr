# GulfZone HR Management System

A comprehensive, modern HR management solution for GulfZone Group to manage multiple companies and employees with a clean, light-themed interface.

## Features

### Core HR Management
- **Multi-Company Support**: Manage multiple companies under GulfZone Group
- **Employee Management**: Complete employee records with personal and professional information
- **Attendance Tracking**: Real-time attendance monitoring with check-in/check-out functionality
- **Leave Management**: Request, approve, and track employee leaves with balance management
- **Payroll Processing**: Automated salary calculation with allowances and deductions
- **Reports & Analytics**: Comprehensive reports on employees, attendance, payroll, and more

### User Interface
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Light Theme**: Professional, easy-on-the-eyes light color scheme
- **Intuitive Navigation**: Clear sidebar and header navigation
- **Dashboard**: Real-time overview of key HR metrics
- **Data Visualization**: Charts and graphs for better insights

## Tech Stack

- **Frontend**: Next.js 16+ with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4+
- **UI Components**: Custom components with Lucide React icons
- **Form Handling**: React Hook Form + Zod validation
- **Database**: Supabase (PostgreSQL)
- **State Management**: React Context API (built-in Next.js)

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
# Create a .env.local file with:
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home/Landing page
│   ├── dashboard/         # Dashboard page
│   ├── employees/         # Employee management
│   ├── companies/         # Company management
│   ├── attendance/        # Attendance tracking
│   ├── leave/            # Leave management
│   ├── payroll/          # Payroll processing
│   ├── reports/          # Reports & analytics
│   └── settings/         # Settings page
├── components/
│   ├── ui/               # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   └── Table.tsx
│   └── layout/           # Layout components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Layout.tsx
├── types/                # TypeScript type definitions
│   └── index.ts
├── styles/               # Global styles
│   └── globals.css
├── lib/                  # Utility functions
├── hooks/                # Custom React hooks
└── utils/                # Helper functions
```

## Pages Overview

### Dashboard (`/dashboard`)
- Key statistics and metrics
- Employee growth trends
- Recent hires overview
- Upcoming events and tasks
- Department performance

### Employees (`/employees`)
- View all employees across companies
- Search and filter employees
- Add new employees
- Edit employee information
- View employee details
- Sort by department, status, etc.

### Companies (`/companies`)
- Manage all companies in the group
- Company information cards
- Company location and contact details
- Employee count by company
- Add/edit company details

### Attendance (`/attendance`)
- Daily attendance tracking
- Check-in/check-out times
- Attendance statistics
- Manual entry for missed records
- Date-based filtering

### Leave Management (`/leave`)
- Leave requests and approvals
- Leave balance tracking by type
- Filter by status (pending, approved, rejected)
- Company-wide leave overview
- Leave types: Vacation, Sick, Personal, Maternity

### Payroll (`/payroll`)
- Monthly payroll processing
- Salary calculations
- Allowances and deductions
- Payment status tracking
- Payroll summaries and reports

### Reports (`/reports`)
- Multiple predefined reports
- Employee summary reports
- Attendance analysis
- Leave utilization
- Turnover analysis
- Department performance
- Report generation and export

### Settings (`/settings`)
- Profile management
- Security settings (password, 2FA)
- Notification preferences
- Email and SMS alerts
- Active session management

## Color Scheme

The application uses a professional light theme with the following color palette:

- **Primary**: Blue (#0F3460) - Main actions and highlights
- **Secondary**: Teal (#16A085) - Secondary actions
- **Accent**: Orange (#F39C12) - Important alerts
- **Danger**: Red (#E74C3C) - Destructive actions
- **Success**: Green (#27AE60) - Positive feedback
- **Light**: Light Gray (#ECF0F1) - Backgrounds
- **Dark**: Dark Gray (#34495E) - Text

## UI Components

### Button
```tsx
<Button variant="primary" size="md">
  Click Me
</Button>
```

### Input
```tsx
<Input label="Email" type="email" placeholder="Enter email" error={error} />
```

### Card
```tsx
<Card header={<h2>Title</h2>} footer={<Button>Save</Button>}>
  Content here
</Card>
```

### Modal
```tsx
<Modal isOpen={open} onClose={() => setOpen(false)} title="Modal Title">
  Modal content
</Modal>
```

### Table
```tsx
<Table columns={columns} data={data} loading={false} />
```

## Database Schema (Supabase)

The application uses PostgreSQL with the following main tables:

### companies
- id, name, email, phone, address, city, country, industry, founded_year, employee_count

### employees
- id, company_id, first_name, last_name, email, phone, position, department, salary, employment_type, status, date_of_joining

### leaves
- id, employee_id, leave_type, start_date, end_date, days, reason, status

### attendance
- id, employee_id, date, check_in, check_out, status, notes

### payroll
- id, employee_id, month, salary, bonus, deductions, net_pay, status

### users
- id, email, first_name, last_name, role, company_id

## Development Tips

### Adding New Pages
1. Create a new folder in `src/app/`
2. Add `page.tsx` file
3. Import and use `Layout` component
4. Export as default React component

### Creating New Components
1. Add component to `src/components/`
2. Use TypeScript interfaces for props
3. Export as named export
4. Use in pages and other components

### Type Safety
All components use TypeScript for type safety. Make sure to:
- Define interfaces for props
- Use proper type annotations
- Run `npm run type-check` before deployment

## Customization

### Theme Colors
Edit `tailwind.config.js` to customize colors:

```js
colors: {
  primary: '#0F3460',
  secondary: '#16A085',
  // ... more colors
}
```

### Icons
All icons from Lucide React. Visit https://lucide.dev for more options.

### Fonts
Default uses system fonts. To add custom fonts, update `globals.css` with Google Fonts or local fonts.

## Security Notes

- All sensitive data should be validated and sanitized
- Use environment variables for API keys and secrets
- Implement proper authentication with Supabase Auth
- Use Row Level Security (RLS) in Supabase
- Regular security audits recommended

## Future Enhancements

- Employee self-service portal
- Mobile app (React Native)
- Advanced analytics and dashboards
- Integration with payroll systems
- Email notifications system
- Document management
- Performance reviews
- Training and development tracking
- Org chart visualization
- API for third-party integrations

## License

MIT License - See LICENSE file for details

## Support

For issues and feature requests, please contact the GulfZone HR team.

## Version

Current Version: 1.0.0
Last Updated: May 2026
