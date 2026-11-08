'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock, Loader2, ShieldAlert } from 'lucide-react';
import type { ProbeState } from '@/lib/api/client-router';
import { STATE_LABEL } from '@/lib/api/client-router';
import { cn } from '@/lib/utils/cn';

/**
 * Connection / quota health pill. One component covers every provider state so
 * the status row reads as a single visual language.
 */

export interface StatusPillProps {
  state: ProbeState;
  latencyMs?: number;
  message?: string;
  /** Quota bar 0..100 when the provider reports usage. */
  quotaPercent?: number;
  busy?: boolean;
  className?: string;
}

const TONE: Record<ProbeState, { dot: string; text: string; ring: string; Icon: typeof CheckCircle2 }> = {
  active: { dot: 'bg-signal-green', text: 'text-signal-green', ring: 'border-signal-green/25 bg-signal-green/[0.08]', Icon: CheckCircle2 },
  degraded: { dot: 'bg-signal-amber', text: 'text-signal-amber', ring: 'border-signal-amber/25 bg-signal-amber/[0.08]', Icon: Clock },
  exhausted: { dot: 'bg-signal-red', text: 'text-signal-red', ring: 'border-signal-red/25 bg-signal-red/[0.08]', Icon: Ban },
  invalid: { dot: 'bg-signal-red', text: 'text-signal-red', ring: 'border-signal-red/25 bg-signal-red/[0.08]', Icon: ShieldAlert },
  missing: { dot: 'bg-white/25', text: 'text-white/45', ring: 'border-white/[0.10] bg-white/[0.03]', Icon: CircleDashed },
  offline: { dot: 'bg-signal-red', text: 'text-signal-red', ring: 'border-signal-red/20 bg-signal-red/[0.06]', Icon: AlertTriangle },
  unknown: { dot: 'bg-white/25', text: 'text-white/45', ring: 'border-white/[0.10] bg-white/[0.03]', Icon: CircleDashed },
};

export function StatusPill({ state, latencyMs, message, quotaPercent, busy, className }: StatusPillProps) {
  const tone = TONE[state];
  return (
    <motion.span
      layout
      className={cn(
        'pill h-6 gap-1.5 border px-2 text-2xs font-medium',
        tone.ring,
        tone.text,
        className,
      )}
      title={message}
    >
      {busy ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className="relative flex size-1.5">
          {state === 'active' && (
            <span className={cn('absolute inline-flex size-1.5 animate-ping rounded-full opacity-75', tone.dot)} />
          )}
          <span className={cn('relative inline-flex size-1.5 rounded-full', tone.dot)} />
        </span>
      )}
      <span>{busy ? 'Checking' : STATE_LABEL[state]}</span>
      {typeof latencyMs === 'number' && latencyMs > 0 && state === 'active' && (
        <span className="mono-num text-white/35">{latencyMs}ms</span>
      )}
      {typeof quotaPercent === 'number' && (
        <span className="ml-0.5 h-1 w-8 overflow-hidden rounded-full bg-white/10">
          <span
            className={cn('block h-full rounded-full', quotaPercent > 85 ? 'bg-signal-red' : 'bg-current')}
            style={{ width: `${Math.min(100, quotaPercent)}%` }}
          />
        </span>
      )}
    </motion.span>
  );
}
