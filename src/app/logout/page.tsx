'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LogoutPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Logging out...');

  useEffect(() => {
    let cancelled = false;

    const performLogout = async () => {
      try {
        setStatus('Clearing session...');

        await supabase.auth.signOut();

        if (!cancelled) {
          setStatus('Session cleared. Redirecting to login...');
          router.push('/login');
        }
      } catch (error) {
        console.error('❌ /logout page: Exception during logout:', error);
        if (!cancelled) {
          setStatus('Redirecting to login...');
          router.push('/login');
        }
      }
    };

    performLogout();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">{status}</p>
        <p className="text-sm text-gray-400 mt-4">If you are not redirected, <a href="/login" className="text-blue-600 hover:underline">click here</a></p>
      </div>
    </div>
  );
}
