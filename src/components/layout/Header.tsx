'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LogOut, Settings } from 'lucide-react';

interface HeaderProps {
  userName?: string;
  companyName?: string;
}

const Header: React.FC<HeaderProps> = ({
  userName = 'User',
  companyName = 'GulfZone',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

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
              <p className="text-xs text-gray-500">{companyName}</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
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

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500">Administrator</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {userName.split(' ').map(n => n[0]).join('')}
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

        {/* Mobile Navigation */}
        {menuOpen && (
          <nav className="md:hidden pb-4 space-y-2 border-t border-gray-200 pt-4">
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
            <div className="px-4 py-2 border-t border-gray-200 mt-4 pt-4 flex gap-2">
              <Settings size={18} className="text-gray-600" />
              <span className="text-gray-700">Settings</span>
            </div>
            <div className="px-4 py-2 flex gap-2 text-red-600">
              <LogOut size={18} />
              <span>Logout</span>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
