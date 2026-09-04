import React from 'react';
import { BRANDING } from '@/config/branding';

export const metadata = {
  title: `Change Password - ${BRANDING.shortName}`,
  description: 'Change your temporary password',
};

export default function ChangePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent flex items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
