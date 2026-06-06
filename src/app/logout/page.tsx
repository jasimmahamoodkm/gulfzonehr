'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Supabase localStorage key for this project
const SUPABASE_AUTH_KEY = 'sb-ebdoxleodzmvmfykakig-auth-token';

export default function LogoutPage() {
  useEffect(() => {
    // Step 1: Wipe the local session immediately so the user is logged out
    // instantly without waiting for a network round-trip.
    try {
      localStorage.removeItem(SUPABASE_AUTH_KEY);
      // Clear any other supabase-related keys
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
    } catch (_) {
      // localStorage may not be available in some environments
    }

    // Step 2: Tell Supabase server to invalidate the token in the background.
    // We do NOT await this — it's a best-effort server-side invalidation.
    // The local session is already cleared so the user is effectively logged out.
    supabase.auth.signOut().catch(() => {});

    // Step 3: Hard redirect to login — clears the JS heap (in-memory session)
    // and avoids any Next.js router / RouteGuard interference.
    window.location.replace('/HRportal/login');
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-10 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-600 font-medium">Logging out…</p>
      </div>
    </div>
  );
}
