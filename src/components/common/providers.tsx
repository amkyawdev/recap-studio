'use client';

import { MotionConfig } from 'framer-motion';
import { useEffect } from 'react';
import { useEditorStore } from '@/store/use-editor-store';
import { useApiKeysStore } from '@/store/use-api-keys-store';
import { initAnalytics } from '@/lib/firebase/config';

/**
 * Client-side app shell providers.
 *
 * Registers the service worker (PWA install + offline shell) and configures
 * Framer Motion to respect the OS reduced-motion setting.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Opt-in, browser-only: no-ops unless a measurement id is configured.
    void initAnalytics();
  }, []);

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

  // Development-only console bridge so the stores can be driven from devtools
  // and from browser automation. Never attached in a production bundle.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const bridge = { editor: useEditorStore, apiKeys: useApiKeysStore };
    (window as unknown as { __recapStore?: typeof bridge }).__recapStore = bridge;
    return () => {
      delete (window as unknown as { __recapStore?: typeof bridge }).__recapStore;
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 34 }}>
      {children}
    </MotionConfig>
  );
}
