'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  userName?: string;
}

const Header: React.FC<HeaderProps> = ({
  userName = 'User',
}) => {
  const router = useRouter();
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);

  const displayName = useMemo(
    () => user ? `${user.first_name} ${user.last_name}` : userName,
    [user, userName]
  );

  const userInitials = useMemo(
    () => user
      ? `${user.first_name[0]}${user.last_name[0]}`
      : userName.split(' ').map(n => n[0]).join(''),
    [user, userName]
  );

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Check if user is admin
  const isAdmin = useMemo(
    () => user?.roles?.some(role =>
      role.role_name === 'Super Admin' ||
      role.role_name === 'Company Admin'
    ) || false,
    [user?.roles]
  );

  const handleLogout = () => {
    console.log('🚪 Logout button clicked, navigating to /logout page');
    router.push('/logout');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">GZ</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900">GulfZone HR</h1>
              <p className="text-xs text-gray-500">{selectedCompany?.name || 'Select Company'}</p>
            </div>
          </Link>

          {/* Desktop Navigation - Only for Admins */}
          {isAdmin && (
            <nav className="hidden md:flex items-center gap-8">
              {/* Company Selector */}
              <div className="relative">
                <button
                  onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-700 text-sm font-medium"
                >
                  {selectedCompany?.name || 'Select Company'}
                  <ChevronDown size={16} />
                </button>
                {companyMenuOpen && (
                  <div className="absolute top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setSelectedCompany(company);
                          setCompanyMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-100 transition ${
                          selectedCompany?.id === company.id
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-gray-700'
                        }`}
                      >
                        {company.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 transition">
                Dashboard
              </Link>
              <Link href="/employees" className="text-gray-700 hover:text-blue-600 transition">
                Employees
              </Link>
              <Link href="/companies" className="text-gray-700 hover:text-blue-600 transition">
                Companies
              </Link>
              <Link href="/attendance" className="text-gray-700 hover:text-blue-600 transition">
                Attendance
              </Link>
            </nav>
          )}

          {/* User Menu */}
          <div className="flex items-center gap-4">
            {/* Desktop User Dropdown */}
            <div className="hidden md:block relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 hover:opacity-80 transition"
              >
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                  <p className="text-xs text-gray-500">{user?.role || 'User'}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">
                    {userInitials}
                  </span>
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <Link
                    href="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex gap-2 items-center w-full px-4 py-3 text-gray-700 hover:bg-gray-100 transition text-sm"
                  >
                    <Settings size={18} />
                    <span>Settings</span>
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setUserMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 flex gap-2 items-center text-red-600 hover:bg-red-50 rounded-b-lg transition text-sm"
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile User Avatar Only */}
            <div className="md:hidden w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {userInitials}
              </span>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation - Only Admin Links for Admins */}
        {menuOpen && (
          <nav className="md:hidden pb-4 space-y-2 border-t border-gray-200 pt-4">
            {isAdmin && (
              <>
                <div className="px-4 py-2">
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Select Company</label>
                  <select
                    value={selectedCompany?.id || ''}
                    onChange={(e) => {
                      const company = companies.find(c => c.id === e.target.value);
                      if (company) setSelectedCompany(company);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Link href="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                  Dashboard
                </Link>
                <Link href="/employees" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                  Employees
                </Link>
                <Link href="/companies" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                  Companies
                </Link>
                <Link href="/attendance" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">
                  Attendance
                </Link>
              </>
            )}
            <Link href="/settings" className={`px-4 py-2 flex gap-2 text-gray-700 hover:bg-gray-100 rounded ${isAdmin ? 'border-t border-gray-200 mt-4 pt-4' : ''}`}>
              <Settings size={18} />
              <span>Settings</span>
            </Link>
            <button
              onClick={() => {
                handleLogout();
                setMenuOpen(false);
              }}
              className="w-full px-4 py-2 flex gap-2 text-red-600 hover:bg-red-50 rounded"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
