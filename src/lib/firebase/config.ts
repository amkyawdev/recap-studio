/**
 * Firebase bootstrap.
 *
 * The app is usable entirely offline (BYOK + client-side rendering), so auth
 * is optional: when the `NEXT_PUBLIC_FIREBASE_*` variables are absent the
 * helpers degrade to a no-op "local mode" instead of throwing at import time.
 * That keeps `next build` green on a bare checkout.
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  /** Realtime Database URL — only needed if a feature reads from RTDB. */
  databaseURL?: string;
  /** Google Analytics measurement id; analytics stays off when absent. */
  measurementId?: string;
}

export const firebaseConfig: FirebaseConfig | null = (() => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!apiKey || !authDomain || !projectId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
})();

export const isFirebaseConfigured = firebaseConfig !== null;

/**
 * Analytics is opt-in and browser-only.
 *
 * `getAnalytics` touches `window`/`document`, so it must never run during
 * prerender, and it must be off by default — shipping telemetry without the
 * operator asking for it is not this app's call to make. Set
 * `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` to enable it.
 */
export async function initAnalytics(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!firebaseConfig?.measurementId) return;
  try {
    const [{ getApps, getApp, initializeApp }, { getAnalytics, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/analytics'),
    ]);
    if (!(await isSupported())) return;
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    getAnalytics(app);
  } catch {
    // Analytics is never worth breaking the studio for.
  }
}

/** Recaptcha container id used by the phone-OTP flow. */
export const RECAPTCHA_CONTAINER_ID = 'recap-recaptcha';
