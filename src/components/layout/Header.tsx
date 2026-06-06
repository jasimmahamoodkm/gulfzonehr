'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  userName?: string;
}

const Header: React.FC<HeaderProps> = ({
  userName = 'User',
}) => {
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);

  const displayName = useMemo(() => {
    if (user) {
      const first = user.first_name || '';
      const last = user.last_name || '';
      return `${first} ${last}`.trim() || user.email || 'User';
    }
    return userName;
  }, [user, userName]);

  const userInitials = useMemo(() => {
    if (user) {
      const first = user.first_name?.[0] || '';
      const last = user.last_name?.[0] || '';
      return (first + last).toUpperCase() || (user.email?.[0] || 'U').toUpperCase();
    }
    return userName.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  }, [user, userName]);

  // Check if user is admin (Super Admin, Company Admin, or HR Manager)
  const isAdmin = useMemo(
    () => user?.roles?.some(role =>
      role.role_name === 'Super Admin' ||
      role.role_name === 'Company Admin' ||
      role.role_name === 'HR Manager'
    ) || false,
    [user?.roles]
  );

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

          {/* Desktop Navigation - Company Selector only (nav items are in sidebar) */}
          {isAdmin && (
            <nav className="hidden md:flex items-center gap-4">
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
            </nav>
          )}

          {/* User Profile Display */}
          <div className="flex items-center gap-4">
            {/* Desktop User Profile (Display Only) */}
            <div className="hidden md:block">
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{displayName}</p>
                  <p className="text-xs text-gray-500">
                    {user?.roles?.[0]?.role_name || user?.role || 'User'}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">
                    {userInitials}
                  </span>
                </div>
              </div>
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
                {/* Nav items removed — available in sidebar */}
              </>
            )}
            {/* Settings and Logout links removed — available in sidebar */}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
