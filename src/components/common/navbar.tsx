'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Download,
  Film,
  Info,
  KeyRound,
  Menu,
  Settings2,
  Upload,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { UpdateBadge } from '@/components/ui/update-badge';

/** Primary navigation. Horizontal on desktop, drawer on mobile. */

export const NAV_LINKS = [
  { href: '/editor', label: 'Editor', icon: Film },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/api-settings', label: 'API Keys', icon: KeyRound },
  { href: '/download', label: 'Download', icon: Download },
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/about', label: 'About', icon: Info },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="border-b border-white/[0.07] bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="Recap Studio home">
            <span className="relative grid size-7 place-items-center rounded-lg border border-white/[0.12] bg-gradient-to-br from-violet-600/40 to-gold-500/20">
              <Film className="size-3.5 text-white" />
              <span className="absolute inset-0 rounded-lg shadow-[0_0_20px_-4px_rgba(139,92,246,0.8)]" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-semibold tracking-tight text-white">Recap Studio</span>
              <span className="mono-num text-[10px] tracking-wide text-white/35">v1.0.0</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'relative rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    active ? 'text-white' : 'text-white/50 hover:text-white/85',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full border border-white/[0.10] bg-white/[0.06]"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    />
                  )}
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <UpdateBadge variant="inline" className="hidden sm:inline-flex" />
            <Link href="/editor" className="hidden md:block">
              <Button size="sm" variant="primary" icon={Settings2}>
                Open Studio
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={open}
              className="pill size-9 text-white/70 hover:bg-white/[0.06] hover:text-white md:hidden"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-white/[0.07] bg-black/85 backdrop-blur-xl md:hidden"
          >
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-1.5 px-4 py-3">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] transition-colors',
                      active
                        ? 'border-violet-500/30 bg-violet-500/10 text-white'
                        : 'border-white/[0.07] bg-white/[0.02] text-white/65 hover:text-white',
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
