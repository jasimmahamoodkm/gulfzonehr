'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';

const MENU_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/attendance', label: 'Attendance', icon: Calendar },
  { href: '/leave', label: 'Leave Management', icon: Users },
  { href: '/payroll', label: 'Payroll', icon: DollarSign },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { selectedCompany } = useCompany();
  const { logout } = useAuth();

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
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

        {/* Bottom Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50 space-y-2">
          <Link href="/settings" className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors text-left">
            <Settings size={20} />
            <span>Profile Settings</span>
          </Link>
          <button
            onClick={handleLogout}
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
