'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Small badge that advertises a newer build. Collapses to a dot on the dock,
 * expands inline on the download page.
 */

export interface UpdateBadgeProps {
  version?: string;
  label?: string;
  /** `dot` for the dock, `inline` for headers, `block` for release cards. */
  variant?: 'dot' | 'inline' | 'block';
  onClick?: () => void;
  className?: string;
}

export function UpdateBadge({
  version = 'v1.0.0',
  label = 'Update available',
  variant = 'inline',
  onClick,
  className,
}: UpdateBadgeProps) {
  if (variant === 'dot') {
    return (
      <span className={cn('relative inline-flex', className)} aria-label={label}>
        <span className="absolute inline-flex size-2.5 rounded-full bg-gold-400/70 animate-pulse-ring" />
        <span className="relative inline-flex size-2.5 rounded-full bg-gold-300 shadow-[0_0_10px_2px_rgba(212,160,23,0.6)]" />
      </span>
    );
  }

  if (variant === 'block') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'pill h-auto w-full flex-col items-start gap-1 rounded-2xl border border-gold-500/25 bg-gold-500/[0.07] px-4 py-3 text-left',
          'hover:border-gold-500/40 hover:bg-gold-500/[0.11] active:scale-[0.99]',
          className,
        )}
      >
        <span className="flex w-full items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-gold-200">
            <Sparkles className="size-3.5" />
            {label}
          </span>
          <span className="mono-num text-2xs text-gold-300/70">{version}</span>
        </span>
        <span className="text-2xs font-normal leading-relaxed text-white/45">
          A newer studio build is published. Review the release notes before upgrading.
        </span>
      </button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.96 }}
      className={cn(
        'pill h-6 gap-1 border border-gold-500/30 bg-gold-500/10 px-2 text-2xs font-medium text-gold-200',
        'hover:bg-gold-500/20',
        className,
      )}
    >
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-1.5 animate-ping rounded-full bg-gold-300/80" />
        <span className="relative inline-flex size-1.5 rounded-full bg-gold-300" />
      </span>
      {label}
      <span className="mono-num text-gold-300/70">{version}</span>
    </motion.button>
  );
}
