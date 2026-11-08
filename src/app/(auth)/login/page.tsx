'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageShell } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { SecureInput } from '@/components/ui/secure-input';
import {
  beginPhoneLogin,
  completePhoneLogin,
  explainAuthError,
  localMode,
  normalisePhone,
  signInWithGoogle,
  type RecapUser,
} from '@/lib/firebase/auth';
import { cn } from '@/lib/utils/cn';

/**
 * Sign-in: Google popup or mobile SMS OTP. When Firebase is not configured the
 * page falls back to a device-local profile so the studio stays usable.
 */

type Step = 'choose' | 'phone' | 'code';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<RecapUser | null>(null);

  const finish = (next: RecapUser) => {
    setUser(next);
    window.setTimeout(() => router.push('/editor'), 900);
  };

  const onGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      finish(await signInWithGoogle());
    } catch (err) {
      setError(explainAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const onSendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await beginPhoneLogin(normalisePhone(phone));
      setStep('code');
    } catch (err) {
      setError(explainAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    setError(null);
    setBusy(true);
    try {
      finish(await completePhoneLogin(code, normalisePhone(phone)));
    } catch (err) {
      setError(explainAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell bleed className="flex items-center justify-center">
      <div className="relative mx-auto flex w-full max-w-md flex-col items-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-2xs text-white/45 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-3" />
            Back to home
          </Link>

          <GlassPanel glow="violet" padding="lg" className="space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="grid size-12 place-items-center rounded-2xl border border-white/[0.12] bg-gradient-to-br from-violet-600/40 to-gold-500/20">
                <ShieldCheck className="size-5 text-white" />
              </span>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-white">Sign in to Recap Studio</h1>
                <p className="mt-1 text-xs leading-relaxed text-white/50">
                  {localMode
                    ? 'Auth is not configured on this deployment. Continue with a device-local profile.'
                    : 'Sync projects across devices. Your API keys never leave this browser.'}
                </p>
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {step === 'choose' && (
                <motion.div
                  key="choose"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-2.5"
                >
                  <Button
                    variant="glass"
                    size="lg"
                    className="w-full"
                    icon={GoogleGlyph}
                    loading={busy}
                    onClick={() => void onGoogle()}
                  >
                    Continue with Google
                  </Button>
                  <Button
                    variant="glass"
                    size="lg"
                    className="w-full"
                    icon={Phone}
                    disabled={busy}
                    onClick={() => setStep('phone')}
                  >
                    Continue with phone
                  </Button>
                  {localMode && (
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      icon={KeyRound}
                      onClick={() =>
                        finish({
                          uid: 'local',
                          displayName: 'Local studio',
                          email: null,
                          phoneNumber: null,
                          photoURL: null,
                          provider: 'local',
                        })
                      }
                    >
                      Continue offline
                    </Button>
                  )}
                </motion.div>
              )}

              {step === 'phone' && (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="space-y-3"
                >
                  <SecureInput
                    label="Mobile number"
                    icon={Phone}
                    value={phone}
                    placeholder="+1 555 000 1234"
                    onChange={(e) => setPhone(e.target.value)}
                    hint="Include the country code. Standard SMS rates apply."
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" size="lg" onClick={() => setStep('choose')} icon={ArrowLeft}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      className="flex-1"
                      icon={ArrowRight}
                      loading={busy}
                      disabled={phone.replace(/\D/g, '').length < 8}
                      onClick={() => void onSendCode()}
                    >
                      Send code
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 'code' && (
                <motion.div
                  key="code"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="space-y-3"
                >
                  <p className="text-xs text-white/55">
                    Enter the 6-digit code sent to <span className="mono-num text-white">{phone}</span>.
                  </p>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="••••••"
                    className="mono-num h-12 w-full rounded-xl border border-white/[0.09] bg-black/40 text-center text-lg tracking-[0.5em] text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <Button variant="ghost" size="lg" onClick={() => setStep('phone')} icon={ArrowLeft}>
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      className="flex-1"
                      icon={ShieldCheck}
                      loading={busy}
                      disabled={code.length !== 6}
                      onClick={() => void onConfirm()}
                    >
                      Verify
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-lg border border-signal-red/25 bg-signal-red/[0.08] px-3 py-2 text-2xs text-signal-red"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <p className="text-center text-2xs leading-relaxed text-white/35">
              By continuing you agree that recap renders happen on your device and that provider keys are stored
              only in this browser.
            </p>
          </GlassPanel>

          <div id="recap-recaptcha" />
        </motion.div>
      </div>

      <AnimatePresence>
        {user && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              'fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs md:bottom-6',
              'border-signal-green/30 bg-signal-green/[0.12] text-signal-green backdrop-blur-xl',
            )}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
            Signed in as {user.displayName ?? user.phoneNumber ?? 'local studio'}. Opening the editor…
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
