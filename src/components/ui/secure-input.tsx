'use client';

import { Eye, EyeOff, Lock, type LucideIcon } from 'lucide-react';
import { forwardRef, useId, useState } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * API-key field with a show/hide toggle. The value is never rendered in a
 * visible-by-default state, and the wrapper carries the "locked" affordance so
 * it reads as a credential field at a glance.
 */

export interface SecureInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Rendered on the right of the label row (status pills etc.). */
  trailing?: React.ReactNode;
  /** Shown as a muted chip under the field, e.g. a masked fingerprint. */
  fingerprint?: string;
  error?: string;
}

export const SecureInput = forwardRef<HTMLInputElement, SecureInputProps>(function SecureInput(
  { className, label, hint, icon: Icon = Lock, trailing, fingerprint, error, id, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="space-y-1.5">
      {(label || trailing) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={inputId} className="kicker flex items-center gap-1.5 text-white/45">
              {label}
            </label>
          )}
          {trailing}
        </div>
      )}

      <div
        className={cn(
          'group relative flex items-center rounded-xl border bg-black/40 transition-colors',
          'focus-within:border-violet-500/50 focus-within:bg-black/60 focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.10)]',
          error ? 'border-signal-red/40' : 'border-white/[0.09] hover:border-white/[0.16]',
        )}
      >
        <span className="pointer-events-none absolute left-3 flex text-white/30">
          <Icon className="size-3.5" />
        </span>

        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          className={cn(
            'h-10 w-full rounded-xl bg-transparent pl-9 pr-11 font-mono text-[13px] tracking-tight',
            'text-white placeholder:text-white/25 focus:outline-none',
            className,
          )}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide key' : 'Show key'}
          className="pill absolute right-1.5 h-7 w-7 text-white/35 hover:bg-white/[0.06] hover:text-white/80 active:scale-90"
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>

      <div className="flex items-start justify-between gap-3">
        {hint ? <p className="text-2xs leading-relaxed text-white/40">{hint}</p> : <span />}
        {fingerprint && (
          <span className="mono-num shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-2xs text-white/35">
            {fingerprint}
          </span>
        )}
      </div>

      {error && <p className="text-2xs text-signal-red">{error}</p>}
    </div>
  );
});
