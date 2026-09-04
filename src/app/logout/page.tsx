'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BRANDING } from '@/config/branding';

export default function LogoutPage() {
  useEffect(() => {
    // Wipe the local session immediately so the user is logged out
    // without waiting for a network round-trip. Keep gulfzone theme
    // cookies/localStorage so the palette returns on the next login.
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('sb-'))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // localStorage may not be available in some environments
    }

    supabase.auth.signOut().catch(() => {});

    window.location.replace(`${BRANDING.basePath}/login`);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-accent">
      <div className="bg-card rounded-lg shadow-lg p-10 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium">Logging out…</p>
      </div>
    </div>
  );
}
