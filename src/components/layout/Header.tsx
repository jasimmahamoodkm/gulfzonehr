'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/hooks/useAuth';
import { BRANDING, brandLogo, companyBranding } from '@/config/branding';

interface HeaderProps {
  userName?: string;
}

// Custom logo image from branding.config.json, or null → initials tile.
const logoUrl = brandLogo();

const Header: React.FC<HeaderProps> = ({
  userName = 'User',
}) => {
  const { selectedCompany, setSelectedCompany, companies } = useCompany();
  const companyBrand = companyBranding(selectedCompany?.name);
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const companyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyMenuOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (companyMenuRef.current && !companyMenuRef.current.contains(event.target as Node)) {
        setCompanyMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCompanyMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [companyMenuOpen]);

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
    <header className="bg-card shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo — the selected company's configured logo/colour takes
              priority (branding.config.json → companyBranding); falls back to
              the per-build app logo, then the initials tile. */}
          <Link href="/" className="flex items-center gap-3">
            {(companyBrand.logo || logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={companyBrand.logo || logoUrl!} alt={selectedCompany?.name || BRANDING.shortName} className="h-10 w-auto max-w-[140px] object-contain" />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary"
                style={companyBrand.color ? { backgroundColor: companyBrand.color } : undefined}
              >
                <span className="text-primary-foreground font-bold text-lg">
                  {selectedCompany?.name ? selectedCompany.name.slice(0, 2).toUpperCase() : BRANDING.initials}
                </span>
              </div>
            )}
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground">{BRANDING.shortName}</h1>
              <p className="text-xs text-muted-foreground">{selectedCompany?.name || 'Select Company'}</p>
            </div>
          </Link>

          {/* Desktop Navigation - Company Selector only (nav items are in sidebar) */}
          {isAdmin && (
            <nav className="hidden md:flex items-center gap-4">
              {/* Company Selector */}
              <div className="relative" ref={companyMenuRef}>
                <button
                  type="button"
                  aria-expanded={companyMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => setCompanyMenuOpen(!companyMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition text-sm font-medium"
                >
                  {selectedCompany?.name || 'Select Company'}
                  <ChevronDown size={16} />
                </button>
                {companyMenuOpen && (
                  <div className="absolute top-full mt-2 w-48 bg-card rounded-lg shadow-lg border border-border z-50">
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => {
                          setSelectedCompany(company);
                          setCompanyMenuOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 text-sm hover:bg-muted transition ${
                          selectedCompany?.id === company.id
                            ? 'bg-accent text-primary font-medium'
                            : 'text-foreground'
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
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.roles?.[0]?.role_name || user?.role || 'User'}
                  </p>
                </div>
                <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                  <span className="text-primary font-semibold text-sm">
                    {userInitials}
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile User Avatar Only */}
            <div className="md:hidden w-10 h-10 bg-accent rounded-full flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">
                {userInitials}
              </span>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation - Only Admin Links for Admins */}
        {menuOpen && (
          <nav className="md:hidden pb-4 space-y-2 border-t border-border pt-4">
            {isAdmin && (
              <>
                <div className="px-4 py-2">
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Company</label>
                  <select
                    value={selectedCompany?.id || ''}
                    onChange={(e) => {
                      const company = companies.find(c => c.id === e.target.value);
                      if (company) setSelectedCompany(company);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 border border-input rounded-lg text-sm"
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
