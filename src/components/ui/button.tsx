'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Pill-shaped button. Every variant keeps the tactile press-down so the whole
 * console feels physical on touch.
 */

export type ButtonVariant = 'primary' | 'gold' | 'glass' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconRight?: React.ComponentType<{ className?: string }>;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-violet-600 text-white shadow-glow-violet hover:bg-violet-500 hover:shadow-[0_0_0_1px_rgba(139,92,246,0.35),0_12px_50px_-10px_rgba(139,92,246,0.65)]',
  gold: 'bg-gradient-to-b from-gold-300 to-gold-500 text-black font-semibold shadow-glow-gold hover:from-gold-200 hover:to-gold-400',
  glass:
    'glass text-white/85 hover:bg-white/[0.07] hover:text-white hover:border-white/[0.14]',
  ghost: 'text-white/60 hover:bg-white/[0.05] hover:text-white',
  outline: 'border border-white/[0.14] text-white/80 hover:border-white/25 hover:text-white hover:bg-white/[0.03]',
  danger: 'bg-signal-red/15 text-signal-red border border-signal-red/25 hover:bg-signal-red/25',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 gap-1 px-2 text-[11px] [&_svg]:size-3',
  sm: 'h-8 gap-1.5 px-3 text-xs [&_svg]:size-3.5',
  md: 'h-9 gap-2 px-4 text-[13px] [&_svg]:size-4',
  lg: 'h-11 gap-2 px-5 text-sm [&_svg]:size-4',
  icon: 'h-9 w-9 [&_svg]:size-4',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'glass', size = 'md', loading, icon: Icon, iconRight: IconRight, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn('pill', VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        Icon && <Icon aria-hidden />
      )}
      {children}
      {IconRight && !loading && <IconRight aria-hidden />}
    </button>
  );
});
