'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Schedule timeouts that are always cleared when the component unmounts.
 * Use this instead of bare setTimeout for toasts, redirects, and copy-feedback.
 */
export function useTimeouts() {
  const ids = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = ids.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.length = 0;
    };
  }, []);

  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    ids.current.push(id);
    return id;
  }, []);
}
