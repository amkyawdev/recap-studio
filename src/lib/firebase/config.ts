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
  };
})();

export const isFirebaseConfigured = firebaseConfig !== null;

/** Recaptcha container id used by the phone-OTP flow. */
export const RECAPTCHA_CONTAINER_ID = 'recap-recaptcha';
