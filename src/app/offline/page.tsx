'use client';

import { WifiOff } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';

/** Offline fallback served by the service worker when a navigation fails. */
export default function OfflinePage() {
  return (
    <PageShell bleed className="flex items-center justify-center">
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <GlassPanel padding="lg" className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-12 place-items-center rounded-2xl border border-white/[0.12] bg-white/[0.04]">
            <WifiOff className="size-5 text-white/60" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">You are offline</h1>
            <p className="mt-2 text-pretty text-2xs leading-relaxed text-white/50">
              The studio shell is cached, so cached projects and any already-downloaded FFmpeg core still work. New
              transcriptions and narration need a connection.
            </p>
          </div>
          <Link href="/editor">
            <Button variant="primary" size="md">
              Try the editor
            </Button>
          </Link>
        </GlassPanel>
      </div>
    </PageShell>
  );
}
