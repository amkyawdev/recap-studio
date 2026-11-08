'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Film, Home, KeyRound, Sparkles, Upload } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Mobile-first floating bottom dock.
 *
 * A frosted capsule that floats above the content, with a raised centre action
 * for the one thing the user is most likely to want next. Hidden on desktop
 * where the navbar carries navigation.
 */

const ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
}> = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/editor', label: 'Studio', icon: Film, primary: true },
  { href: '/api-settings', label: 'Keys', icon: KeyRound },
  { href: '/download', label: 'Get App', icon: Sparkles },
];

export function FloatingDock() {
  const pathname = usePathname();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden">
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.15 }}
        aria-label="Primary"
        className="pointer-events-auto relative flex w-full max-w-sm items-end justify-between gap-1 rounded-[26px] border border-white/[0.10] bg-ink-700/70 px-2 py-1.5 backdrop-blur-2xl shadow-[0_-4px_40px_-8px_rgba(0,0,0,0.9),0_12px_40px_-12px_rgba(139,92,246,0.25)]"
      >
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className="relative -mt-6 flex flex-col items-center gap-0.5"
              >
                <motion.span
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    'grid size-12 place-items-center rounded-2xl border transition-all duration-200',
                    active
                      ? 'border-violet-400/40 bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-[0_8px_30px_-6px_rgba(139,92,246,0.9)]'
                      : 'border-white/[0.12] bg-gradient-to-br from-ink-500 to-ink-700 text-white/80 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)]',
                  )}
                >
                  <Icon className="size-5" />
                </motion.span>
                <span className={cn('text-[10px] font-medium', active ? 'text-white' : 'text-white/45')}>
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2"
            >
              {active && (
                <motion.span
                  layoutId="dock-active"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  className="absolute inset-x-1 inset-y-0.5 rounded-2xl border border-white/[0.10] bg-white/[0.07]"
                />
              )}
              <Icon
                className={cn(
                  'relative size-4 transition-colors',
                  active ? 'text-white' : 'text-white/45',
                )}
              />
              <span
                className={cn(
                  'relative text-[10px] font-medium transition-colors',
                  active ? 'text-white' : 'text-white/40',
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </motion.nav>
    </div>
  );
}

/** Spacer so docked pages do not hide their last row under the dock. */
export function DockSpacer() {
  return <div aria-hidden className="h-24 md:hidden" />;
}
