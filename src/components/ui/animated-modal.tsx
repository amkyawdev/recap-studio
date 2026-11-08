'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Modal that scales up on desktop and slides in as a bottom sheet on mobile.
 * Escape and backdrop click both dismiss; focus is trapped to the panel.
 */

export interface AnimatedModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** `sheet` pins to the bottom edge on small screens. */
  variant?: 'center' | 'sheet';
  size?: 'sm' | 'md' | 'lg';
  hideClose?: boolean;
}

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const;

export function AnimatedModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'sheet',
  size = 'md',
  hideClose,
}: AnimatedModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={
              variant === 'sheet'
                ? { y: '6%', opacity: 0, scale: 0.99 }
                : { opacity: 0, scale: 0.94, y: 12 }
            }
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={
              variant === 'sheet'
                ? { y: '10%', opacity: 0, scale: 0.99 }
                : { opacity: 0, scale: 0.96, y: 8 }
            }
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
            drag={variant === 'sheet' ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 800) onClose();
            }}
            className={cn(
              'relative z-10 w-full overflow-hidden border border-white/[0.10] bg-ink-700/90 backdrop-blur-2xl',
              'shadow-[0_-8px_60px_-12px_rgba(0,0,0,0.9),0_24px_80px_-20px_rgba(139,92,246,0.18)]',
              variant === 'sheet'
                ? 'max-h-[92dvh] rounded-t-3xl pb-[max(env(safe-area-inset-bottom),0px)] sm:rounded-3xl sm:pb-0'
                : 'mx-4 rounded-3xl',
              SIZES[size],
            )}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />

            {variant === 'sheet' && (
              <div className="flex justify-center pt-3 sm:hidden">
                <span className="h-1 w-10 rounded-full bg-white/20" />
              </div>
            )}

            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 px-5 pt-4">
                <div className="min-w-0">
                  {title && <h2 className="text-base font-semibold tracking-tight text-white">{title}</h2>}
                  {description && <p className="mt-1 text-xs leading-relaxed text-white/50">{description}</p>}
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="pill -mr-1 h-8 w-8 shrink-0 text-white/50 hover:bg-white/[0.06] hover:text-white active:scale-90"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[70dvh] overflow-y-auto px-5 py-4">{children}</div>

            {footer && <div className="hairline-t bg-black/20 px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
