'use client';

import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { RouteGuard } from '@/components/RouteGuard';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <RouteGuard>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          {/* min-w-0 lets this flex item shrink below its content's intrinsic
              width so wide children (tables) scroll internally instead of
              widening the whole page on mobile. */}
          <main className="flex-1 min-w-0 md:ml-0 pt-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </RouteGuard>
  );
};

export default Layout;
