'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
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
} from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const MENU_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee-dashboard', label: 'My Dashboard', icon: LayoutDashboard, requiredRole: 'Employee' },
  { href: '/manager-dashboard', label: 'Team Dashboard', icon: BarChart3, requiredRole: 'Department Manager' },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/attendance', label: 'Attendance', icon: Calendar },
  { href: '/leave', label: 'Leave Management', icon: Users },
  { href: '/leaves', label: 'Leaves', icon: Users },
  { href: '/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

const ADMIN_MENU_ITEMS = [
  { href: '/admin/rbac', label: 'RBAC Management', icon: Lock, requiredRole: 'Company Admin' },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: Shield, requiredRole: 'Company Admin' },
  { href: '/admin/leave-approvals', label: 'Leave Approvals', icon: CheckCircle, requiredRole: 'HR Manager' },
];

const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const [allowedModulePaths, setAllowedModulePaths] = useState<Set<string>>(new Set());

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  // Load allowed modules for user
  useEffect(() => {
    const loadAllowedModules = async () => {
      if (!user?.roles || user.roles.length === 0) {
        console.log('🔐 No roles found, allowing basic dashboard');
        setAllowedModulePaths(new Set(['/dashboard']));
        return;
      }

      try {
        const roleIds = user.roles.map(r => r.role_id);
        console.log('📋 Loading allowed modules for roleIds:', roleIds);

        // Fetch modules to get paths
        const { data: modulesData, error: modulesError } = await supabase
          .from('modules')
          .select('id, path');

        // Get module IDs from role_modules for this user's roles
        const { data: rmData, error: rmError } = await supabase
          .from('role_modules')
          .select('module_id')
          .in('role_id', roleIds);

        if (!modulesError && !rmError && modulesData && rmData) {
          // Create a set of allowed module IDs
          const allowedModuleIds = new Set<string>();
          rmData.forEach(rm => allowedModuleIds.add(rm.module_id));

          console.log('📦 Allowed module IDs:', Array.from(allowedModuleIds));

          // Map module IDs to paths
          const allowedPaths = new Set<string>();
          modulesData.forEach(module => {
            if (allowedModuleIds.has(module.id)) {
              allowedPaths.add(module.path);
            }
          });

          console.log('✅ Allowed module paths:', Array.from(allowedPaths));
          setAllowedModulePaths(allowedPaths);
        } else {
          console.log('⚠️ Error loading modules:', { modulesError, rmError });
          console.log('⚠️ Allowing only dashboard');
          setAllowedModulePaths(new Set(['/dashboard']));
        }
      } catch (err) {
        console.error('❌ Error loading allowed modules:', err);
        setAllowedModulePaths(new Set(['/dashboard']));
      }
    };

    loadAllowedModules();
  }, [user]);

  const handleLogout = () => {
    console.log('🚪 Logout button clicked from sidebar, navigating to /logout page');
    router.push('/logout');
  };

  // Check if user is admin
  console.log('🔐 Sidebar checking user:', user);
  console.log('🔐 User roles from context:', user?.roles);
  const isAdmin = user?.roles?.some(role =>
    role.role_name === 'Super Admin' ||
    role.role_name === 'Company Admin' ||
    role.role_name === 'HR Manager'
  );
  console.log('🔐 isAdmin result:', isAdmin);
  console.log('🔐 Checking for role_name:', user?.roles?.map(r => ({ id: r.id, role_name: r.role_name })));

  // Filter admin items based on user's actual permissions and allowed modules
  const visibleAdminItems = ADMIN_MENU_ITEMS.filter(item => {
    // First check if module is allowed
    if (!allowedModulePaths.has(item.href)) {
      return false;
    }

    // Then check role requirement
    if (item.requiredRole === 'Company Admin') {
      return user?.roles?.some(r => r.role_name === 'Super Admin' || r.role_name === 'Company Admin');
    }
    if (item.requiredRole === 'HR Manager') {
      return user?.roles?.some(r =>
        r.role_name === 'Super Admin' ||
        r.role_name === 'Company Admin' ||
        r.role_name === 'HR Manager'
      );
    }
    return true;
  });

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
        } md:translate-x-0 fixed md:relative left-0 top-0 h-screen md:h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 overflow-y-auto transition-transform duration-300 z-30 md:z-0 pt-20 md:pt-0`}
      >
        {/* Company Indicator */}
        {selectedCompany && (
          <div className="px-4 py-3 m-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Current Company</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{selectedCompany.name}</p>
          </div>
        )}

        <nav className="p-4 space-y-2">
          {MENU_ITEMS.map((item) => {
            // Check if module is allowed for user
            const isModuleAllowed = allowedModulePaths.has(item.href);

            if (!isModuleAllowed) {
              console.log(`🚫 Module not allowed: ${item.href}`);
              return null;
            }

            // Filter menu items based on required role
            const hasRequiredRole = !('requiredRole' in item) ||
              user?.roles?.some(role =>
                role.role_name === (item as any).requiredRole ||
                role.role_name === 'Super Admin' ||
                role.role_name === 'Company Admin'
              );

            if (!hasRequiredRole) return null;

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
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Admin Section */}
        {isAdmin && visibleAdminItems.length > 0 && (
          <>
            <div className="px-4 py-3 mx-4 my-4 border-t border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Administration</p>
              <div className="space-y-2">
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
          </>
        )}

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50 space-y-2">
          <Link href="/settings" className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors text-left">
            <Settings size={20} />
            <span>Profile Settings</span>
          </Link>
          <button
            onClick={() => {
              handleLogout();
              setSidebarOpen(false);
            }}
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
