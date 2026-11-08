'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Segmented control with a sliding highlight. Used for aspect ratio, TTS
 * provider and panel switching — anywhere a radio group would otherwise eat
 * vertical space on a phone.
 */

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** Equal-width columns instead of content-sized pills. */
  fluid?: boolean;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  fluid,
}: SegmentedProps<T>) {
  const layoutId = useId();

  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex w-full gap-0.5 rounded-full border border-white/[0.08] bg-black/50 p-0.5 backdrop-blur',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 rounded-full font-medium transition-colors',
              'disabled:pointer-events-none disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2.5 text-2xs' : 'h-8 px-3 text-xs',
              selected ? 'text-white' : 'text-white/45 hover:text-white/75',
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                className="absolute inset-0 rounded-full border border-white/[0.12] bg-white/[0.09] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10)]"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
              {Icon && <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
