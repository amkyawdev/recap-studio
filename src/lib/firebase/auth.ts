/**
 * Firebase Auth wrapper — Google popup and mobile SMS OTP.
 *
 * Every Firebase import is dynamic so the SDK stays out of the initial bundle
 * and nothing touches `window` during prerender. When Firebase is not
 * configured, `localMode` is true and the login page offers a device-local
 * profile instead of an account.
 */

import { firebaseConfig, isFirebaseConfigured, RECAPTCHA_CONTAINER_ID } from './config';

export interface RecapUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  provider: 'google' | 'phone' | 'local';
}

export const localMode = !isFirebaseConfigured;

export function toRecapUser(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  providerData?: Array<{ providerId: string }>;
}): RecapUser {
  const providerId = user.providerData?.[0]?.providerId ?? '';
  const provider: RecapUser['provider'] = providerId.includes('google')
    ? 'google'
    : providerId.includes('phone')
      ? 'phone'
      : 'local';
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    photoURL: user.photoURL,
    provider,
  };
}

async function getAuthModule() {
  const [{ getApps, getApp, initializeApp }, auth] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig!);
  return { app, auth: auth.getAuth(app), authSdk: auth };
}

/** Subscribe to auth state. Returns an unsubscribe function. */
export async function observeAuth(callback: (user: RecapUser | null) => void): Promise<() => void> {
  if (localMode) {
    callback(null);
    return () => {};
  }
  const { auth, authSdk } = await getAuthModule();
  return authSdk.onAuthStateChanged(auth, (user) => callback(user ? toRecapUser(user) : null));
}

export async function signInWithGoogle(): Promise<RecapUser> {
  if (localMode) throw new Error('Firebase is not configured on this deployment.');
  const { auth, authSdk } = await getAuthModule();
  const provider = new authSdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await authSdk.signInWithPopup(auth, provider);
  return toRecapUser(credential.user);
}

// The ConfirmationResult object is not serialisable; keep it in module scope
// between the two login steps so the UI can stay a plain function call.
let cachedConfirmation: { confirm: (code: string) => Promise<{ user: unknown }> } | null = null;

/** Step 1 of phone auth: send the SMS via an invisible reCAPTCHA challenge. */
export async function beginPhoneLogin(phoneNumber: string): Promise<void> {
  if (localMode) throw new Error('Firebase is not configured on this deployment.');
  const { auth, authSdk } = await getAuthModule();

  let container = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = RECAPTCHA_CONTAINER_ID;
    document.body.appendChild(container);
  }
  const verifier = new authSdk.RecaptchaVerifier(auth, container, { size: 'invisible' });
  cachedConfirmation = (await authSdk.signInWithPhoneNumber(auth, phoneNumber, verifier)) as unknown as {
    confirm: (code: string) => Promise<{ user: unknown }>;
  };
}

async function resolveConfirmation(phoneNumber: string) {
  if (!cachedConfirmation) {
    // Page was reloaded between steps — restart the flow transparently.
    await beginPhoneLogin(phoneNumber);
  }
  return cachedConfirmation!;
}

export async function completePhoneLogin(code: string, phoneNumber: string): Promise<RecapUser> {
  const confirmation = await resolveConfirmation(phoneNumber);
  const credential = await confirmation.confirm(code);
  cachedConfirmation = null;
  return toRecapUser(credential.user as Parameters<typeof toRecapUser>[0]);
}

export async function signOut(): Promise<void> {
  if (localMode) return;
  const { auth, authSdk } = await getAuthModule();
  await authSdk.signOut(auth);
}

/** Normalise a loose phone entry into E.164. Assumes +1 when no country code. */
export function normalisePhone(input: string, defaultCountry = '1'): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  return `+${digits}`;
}

/** Human-readable message for a Firebase auth error code. */
export function explainAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-phone-number': 'That phone number looks wrong. Include the country code.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute, then try again.',
    'auth/invalid-verification-code': 'That code is incorrect. Check the SMS and retry.',
    'auth/code-expired': 'The code expired. Request a fresh one.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
    'auth/popup-blocked': 'The browser blocked the Google popup. Allow popups and retry.',
    'auth/network-request-failed': 'Network error reaching Firebase. Check your connection.',
    'auth/unauthorized-domain': 'This domain is not authorised in the Firebase console.',
  };
  if (map[code]) return map[code];
  return (error as Error)?.message ?? 'Sign-in failed. Try again.';
}
