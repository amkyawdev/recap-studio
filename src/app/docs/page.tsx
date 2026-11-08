'use client';

import { motion } from 'framer-motion';
import {
  BookOpen,
  Code2,
  Cpu,
  ExternalLink,
  FileText,
  Film,
  Github,
  KeyRound,
  Layers,
  LifeBuoy,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { PageShell, PageHeader } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';

const SECTIONS = [
  {
    icon: Sparkles,
    title: 'Quick start',
    body: 'Add a provider key, load a source, tighten the timeline, then render on-device.',
    href: '/docs/api-usage',
    cta: 'API setup',
  },
  {
    icon: Layers,
    title: 'The timeline',
    body: 'Timecode editing, the typewriter read-through, auto-sync and the pacing budget.',
    href: '#timeline',
  },
  {
    icon: Cpu,
    title: 'Render engine',
    body: 'How the FFmpeg.wasm graph is built, why the three-minute ceiling exists, and what each stage means.',
    href: '#render',
  },
  {
    icon: ShieldCheck,
    title: 'Key security',
    body: 'Vault encryption, persistence scopes, and the relay path when you want rate limiting.',
    href: '#security',
  },
];

export default function DocsPage() {
  return (
    <PageShell>
      <PageHeader
        kicker="Documentation"
        title="Recap Studio docs"
        description="Everything you need to run the studio end-to-end: provider keys, the timeline model, the render pipeline and deployment."
        actions={
          <Link href="/docs/api-usage">
            <Button size="sm" variant="primary" icon={KeyRound}>
              API setup guide
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((section, i) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassPanel padding="md" className="group h-full">
                  <span className="mb-3 grid size-9 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.03]">
                    <section.icon className="size-4 text-white/70" />
                  </span>
                  <h3 className="text-[13px] font-semibold text-white">{section.title}</h3>
                  <p className="mt-1.5 text-2xs leading-relaxed text-white/45">{section.body}</p>
                  <Link
                    href={section.href}
                    className="mt-3 inline-flex items-center gap-1 text-2xs text-violet-300 transition-colors hover:text-violet-200"
                  >
                    {section.cta ?? 'Read more'}
                    <ExternalLink className="size-3" />
                  </Link>
                </GlassPanel>
              </motion.div>
            ))}
          </div>

          <GlassPanel padding="lg" id="timeline" className="scroll-mt-20 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="size-4 text-violet-400" />
              The timeline model
            </h2>
            <p className="text-[13px] leading-relaxed text-white/55">
              A recap is a list of cues: an id, a start, an end and a line of text. Everything else in the editor
              derives from that list — the pacing meter, the subtitle burn-in, the SRT export.
            </p>
            <div className="rounded-xl border border-white/[0.07] bg-black/50 p-3">
              <pre className="mono-num overflow-x-auto text-2xs leading-relaxed text-white/70">
{`interface Cue {
  id: string;
  index: number;
  start: number;   // seconds
  end: number;     // seconds
  text: string;
  locked?: boolean; // excluded from auto-sync
}`}
              </pre>
            </div>
            <p className="text-2xs leading-relaxed text-white/45">
              Auto-sync redistributes every unlocked cue so the track lands exactly on the target duration, while
              locked cues keep their windows. Use it when a draft script has the right words but the wrong pacing.
            </p>
          </GlassPanel>

          <GlassPanel padding="lg" id="render" className="scroll-mt-20 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Cpu className="size-4 text-violet-400" />
              The render pipeline
            </h2>
            <ol className="space-y-2 text-2xs leading-relaxed text-white/50">
              <li>
                <strong className="text-white/75">1. Load core.</strong> The wasm binary is fetched once and cached
                by the service worker.
              </li>
              <li>
                <strong className="text-white/75">2. Stage files.</strong> Source, narration, music and the
                generated ASS subtitle script are written into the virtual filesystem.
              </li>
              <li>
                <strong className="text-white/75">3. Encode.</strong> A single filter graph scales, pads, fades,
                burns subtitles, stamps the watermark and mixes audio.
              </li>
              <li>
                <strong className="text-white/75">4. Finalise.</strong> The MP4 is read back out and handed to a
                blob URL.
              </li>
            </ol>
            <p className="text-2xs leading-relaxed text-white/45">
              The three-minute ceiling is enforced twice — the plan is rejected before encoding, and the argument
              vector carries a hard <code className="mono-num">-t 180</code>. A wasm render that runs long enough
              to exhaust memory takes the tab with it, so the guard is deliberately strict.
            </p>
          </GlassPanel>

          <GlassPanel padding="lg" id="security" className="scroll-mt-20 space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="size-4 text-signal-green" />
              Key security
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['Cipher', 'AES-GCM-256'],
                ['Derivation', 'PBKDF2-SHA256, 210k iterations'],
                ['Scopes', 'sessionStorage or localStorage'],
                ['Transit', 'Direct to the provider, or via your relay'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-2xs text-white/40">{k}</p>
                  <p className="mono-num mt-0.5 text-2xs text-white/75">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-2xs leading-relaxed text-white/45">
              The passphrase is never persisted and cannot be recovered. Losing it means re-entering your keys.
            </p>
          </GlassPanel>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <GlassPanel padding="md" className="space-y-2">
            <h3 className="kicker flex items-center gap-1.5">
              <BookOpen className="size-3" />
              On this page
            </h3>
            <nav className="space-y-1">
              {[
                ['#timeline', 'Timeline model'],
                ['#render', 'Render pipeline'],
                ['#security', 'Key security'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="block rounded-lg px-2 py-1.5 text-2xs text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>
          </GlassPanel>

          <GlassPanel padding="md" className="space-y-2">
            <h3 className="kicker flex items-center gap-1.5">
              <Code2 className="size-3" />
              Stack
            </h3>
            <ul className="space-y-1.5 text-2xs text-white/50">
              {[
                ['Framework', 'Next.js 14 App Router'],
                ['State', 'Zustand'],
                ['Motion', 'Framer Motion'],
                ['Video', '@ffmpeg/ffmpeg 0.12'],
                ['Auth', 'Firebase (optional)'],
                ['Edge', 'Cloudflare Workers'],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span className="text-white/40">{k}</span>
                  <span className="mono-num text-white/65">{v}</span>
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel padding="md" className="space-y-2">
            <h3 className="kicker flex items-center gap-1.5">
              <LifeBuoy className="size-3" />
              Help
            </h3>
            <div className="space-y-1.5">
              <a
                href="https://github.com/amkyawdev/recap-studio/issues"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-2xs text-white/60 transition-colors hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  <Github className="size-3" />
                  Open an issue
                </span>
                <ExternalLink className="size-3" />
              </a>
              <Link
                href="/download"
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-2xs text-white/60 transition-colors hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  <Film className="size-3" />
                  Downloads
                </span>
                <ExternalLink className="size-3" />
              </Link>
              <Link
                href="/docs/api-usage"
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-2xs text-white/60 transition-colors hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="size-3" />
                  API usage
                </span>
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </GlassPanel>
        </aside>
      </div>
    </PageShell>
  );
}
