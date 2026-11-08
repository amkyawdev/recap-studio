'use client';

import Link from 'next/link';
import { Github } from 'lucide-react';
import { Navbar } from './navbar';
import { DockSpacer, FloatingDock } from './floating-dock';
import { cn } from '@/lib/utils/cn';

/**
 * Shared chrome for every route: sticky navbar, ambient background, page
 * container, footer and the mobile floating dock.
 */

export interface PageShellProps {
  children: React.ReactNode;
  /** Hides the floating dock (used by the full-bleed editor). */
  hideDock?: boolean;
  /** Removes the max-width container — the editor manages its own grid. */
  bleed?: boolean;
  className?: string;
}

export function PageShell({ children, hideDock, bleed, className }: PageShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-void">
      <AmbientBackground />
      <Navbar />
      <main className={cn('relative z-10 flex-1', !bleed && 'mx-auto w-full max-w-6xl px-4 py-6 sm:py-10', className)}>
        {children}
      </main>
      <SiteFooter />
      {hideDock ? <DockSpacer /> : <FloatingDock />}
    </div>
  );
}

/** Layered gradient mesh + grid that gives the black canvas depth. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute inset-0 bg-void" />
      <div className="absolute inset-x-0 top-0 h-[520px] bg-radial-violet opacity-70" />
      <div className="absolute right-0 top-0 h-[420px] w-[520px] bg-radial-gold opacity-60" />
      <div className="absolute inset-0 grid-lines opacity-[0.35] [mask-image:radial-gradient(70%_50%_at_50%_0%,#000,transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-white/[0.07]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-2xs leading-relaxed text-white/35">
          Recap Studio — keys stay on your device, renders run in your browser.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="text-2xs text-white/40 transition-colors hover:text-white/80">
            Docs
          </Link>
          <Link href="/docs/api-usage" className="text-2xs text-white/40 transition-colors hover:text-white/80">
            API setup
          </Link>
          <a
            href="https://github.com/amkyawdev/recap-studio"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-2xs text-white/40 transition-colors hover:text-white/80"
          >
            <Github className="size-3" />
            Source
          </a>
        </div>
      </div>
    </footer>
  );
}

/** Consistent page header used across the dashboard routes. */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker && <p className="kicker mb-2">{kicker}</p>}
        <h1 className="text-balance text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-pretty text-[13px] leading-relaxed text-white/50">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
