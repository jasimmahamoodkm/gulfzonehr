'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Lock,
  Shield,
  CheckCircle,
  GraduationCap,
  Building2,
  Clock,
  Calendar,
} from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';

// Admin/HR menu items - shown to Super Admin, Company Admin, HR Manager
const ADMIN_MAIN_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/leave', label: 'Leaves', icon: Calendar },
  { href: '/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

// Employee menu items - shown to regular employees
const EMPLOYEE_MENU_ITEMS = [
  { href: '/employee-dashboard', label: 'My Dashboard', icon: LayoutDashboard },
  { href: '/attendance', label: 'My Attendance', icon: Clock },
  { href: '/leave', label: 'My Leave', icon: Calendar },
  { href: '/payroll', label: 'My Payroll', icon: DollarSign },
  { href: '/documents', label: 'My Documents', icon: FileText },
];

// Manager menu items - shown to Managers
const MANAGER_MENU_ITEMS = [
  { href: '/manager-dashboard', label: 'Team Dashboard', icon: BarChart3 },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/attendance', label: 'Attendance', icon: Clock },
  { href: '/leave', label: 'Leave Management', icon: Calendar },
  { href: '/payroll', label: 'My Payroll', icon: DollarSign },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

const ADMIN_MENU_ITEMS = [
  { href: '/admin/rbac', label: 'RBAC Management', icon: Lock, requiredRole: 'Company Admin', requiresCompany: false },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: Shield, requiredRole: 'Company Admin', requiresCompany: false },
  { href: '/admin/leave-approvals', label: 'Leave Approvals', icon: CheckCircle, requiredRole: 'HR Manager', requiresCompany: true },
  { href: '/admin/grades', label: 'Grade Configuration', icon: GraduationCap, requiredRole: 'HR Manager', requiresCompany: true },
];

const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { selectedCompany } = useCompany();
  const { user } = useAuth();

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const handleLogout = () => {
    router.push('/logout');
  };

  // Determine user role type
  const isSuperAdmin = user?.roles?.some(r => r.role_name === 'Super Admin') ?? false;
  const isCompanyAdmin = user?.roles?.some(r => r.role_name === 'Company Admin') ?? false;
  const isHRManager = user?.roles?.some(r => r.role_name === 'HR Manager') ?? false;
  const isDeptManager = user?.roles?.some(r => r.role_name === 'Manager') ?? false;
  const isAdmin = isSuperAdmin || isCompanyAdmin || isHRManager;

  // Companies module: Super Admin and Company Admin only (not HR Manager)
  const canSeeCompanies = isSuperAdmin || isCompanyAdmin;

  // Choose which menu items to show based on role, filtering restricted items
  const baseAdminItems = canSeeCompanies
    ? ADMIN_MAIN_ITEMS
    : ADMIN_MAIN_ITEMS.filter(item => item.href !== '/companies');

  const mainMenuItems = isAdmin
    ? baseAdminItems
    : isDeptManager
    ? MANAGER_MENU_ITEMS
    : EMPLOYEE_MENU_ITEMS;

  // Filter admin section items based on role and company requirements
  const visibleAdminItems = ADMIN_MENU_ITEMS.filter((item) => {
    // Check if user has required role
    let hasRequiredRole = false;
    if (item.requiredRole === 'Company Admin') {
      hasRequiredRole = isSuperAdmin || isCompanyAdmin;
    } else if (item.requiredRole === 'HR Manager') {
      hasRequiredRole = isSuperAdmin || isCompanyAdmin || isHRManager;
    } else {
      hasRequiredRole = isAdmin;
    }

    // Check if company is required and selected
    const requiresCompany = item.requiresCompany ?? false;
    if (requiresCompany && !selectedCompany) {
      return false;
    }

    if (!hasRequiredRole) {
    }

    return hasRequiredRole;
  });

  const renderNavItem = (item: { href: string; label: string; icon: any }, size: number = 20, extraClass: string = '') => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          active
            ? 'bg-blue-100 text-blue-600 font-medium'
            : `text-gray-700 hover:bg-gray-100 ${extraClass}`
        }`}
      >
        <Icon size={size} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-20 right-4 z-40 p-2 bg-white rounded-lg shadow-md"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 fixed md:relative left-0 top-0 h-screen md:h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 z-30 md:z-0 pt-20 md:pt-0`}
      >
        {/* Scrollable nav area — grows to fill space, leaving the footer pinned */}
        <div className="flex-1 overflow-y-auto">
        {/* Company Indicator */}
        {selectedCompany && (
          <div className="px-4 py-3 m-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Current Company</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{selectedCompany.name}</p>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="p-4 space-y-1">
          {mainMenuItems.map(item => renderNavItem(item))}
        </nav>

        {/* Admin Section */}
        {isAdmin && visibleAdminItems.length > 0 && (
          <div className="px-4 mx-4 my-2 border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Administration</p>
            <div className="space-y-1">
              {visibleAdminItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-purple-100 text-purple-600 font-medium'
                        : 'text-gray-600 hover:bg-purple-50'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        </div>
        {/* Bottom Section — pinned to the bottom via flex (mt-auto), never overlaps the menu */}
        <div className="mt-auto p-4 border-t border-gray-200 bg-gray-50 space-y-2">
          <Link
            href="/settings"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors text-left"
          >
            <Settings size={20} />
            <span>Profile Settings</span>
          </Link>
          <button
            onClick={() => { handleLogout(); setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20 pt-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
