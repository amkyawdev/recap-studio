'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * PWA install prompt.
 *
 * Chromium fires `beforeinstallprompt` once, and the event must be captured and
 * held — calling `prompt()` later is only allowed on a stored event. Without
 * this the install button has nothing to call.
 *
 * `appinstalled` fires after a successful install, and `display-mode:
 * standalone` tells us the app is already running installed, so the button can
 * report the truth instead of offering an install that cannot happen.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export type InstallState = 'unsupported' | 'available' | 'installed' | 'dismissed';

export function usePwaInstall() {
  const [state, setState] = useState<InstallState>('unsupported');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setState('installed');
      return;
    }

    const onBeforeInstall = (event: Event) => {
      // Suppress the mini-infobar so the install stays a deliberate action.
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      setState('available');
    };
    const onInstalled = () => {
      deferredPrompt = null;
      setState('installed');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt; the manual Add-to-Home-Screen path
    // is the only option there, so report it as available with instructions.
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    if (isIos && !standalone) setState('available');

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    if (!deferredPrompt) return 'manual';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // The event is single-use; a second prompt() throws.
    deferredPrompt = null;
    setState(outcome === 'accepted' ? 'installed' : 'dismissed');
    return outcome;
  }, []);

  return { state, promptInstall };
}

/** True when the page is already running as an installed app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
