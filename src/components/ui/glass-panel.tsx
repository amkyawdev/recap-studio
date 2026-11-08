'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Frosted-glass surface. The `glow` prop adds the violet/gold rim used to
 * mark the panel the user is currently working in.
 */

export interface GlassPanelProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  glow?: 'none' | 'violet' | 'gold' | 'both';
  /** Adds the faint corner grid — used on empty/landing surfaces. */
  grid?: boolean;
  /** Inner highlight along the top edge, the "glass lip". */
  lip?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-7',
} as const;

const GLOW: Record<NonNullable<GlassPanelProps['glow']>, string> = {
  none: '',
  violet: 'shadow-glow-violet border-violet-500/25',
  gold: 'shadow-glow-gold border-gold-500/25',
  both: 'shadow-[0_0_0_1px_rgba(139,92,246,0.18),0_10px_50px_-14px_rgba(212,160,23,0.35)] border-white/[0.12]',
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { className, glow = 'none', grid, lip = true, padding = 'md', children, ...props },
  ref,
) {
  return (
    <motion.div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl',
        'shadow-panel',
        PADDING[padding],
        GLOW[glow],
        className,
      )}
      {...props}
    >
      {grid && (
        <div className="pointer-events-none absolute inset-0 grid-lines opacity-60 [mask-image:radial-gradient(80%_60%_at_50%_0%,#000,transparent)]" />
      )}
      {lip && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      )}
      <div className="relative">{children}</div>
    </motion.div>
  );
});
