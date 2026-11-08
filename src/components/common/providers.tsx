'use client';

import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Client-side app shell providers.
 *
 * Registers the service worker (PWA install + offline shell) and configures
 * Framer Motion to respect the OS reduced-motion setting.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline shell is best-effort */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
      {children}
    </MotionConfig>
  );
}
