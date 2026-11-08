'use client';

import { motion } from 'framer-motion';
import { Cpu, Github, Heart, Layers, Lock, Mail, Shield, Sparkles, Timer, Zap } from 'lucide-react';
import Link from 'next/link';
import { PageShell, PageHeader } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';

const PRINCIPLES = [
  {
    icon: Lock,
    title: 'Your keys stay yours',
    body: 'BYOK is not a footnote here — there is no server-side key store to leak, because keys never leave your device.',
  },
  {
    icon: Cpu,
    title: 'Render where the footage lives',
    body: 'FFmpeg runs in a wasm worker in your browser, so an unreleased cut never travels across a network.',
  },
  {
    icon: Timer,
    title: 'Constraint as a feature',
    body: 'The three-minute ceiling is the product. It forces the discipline that makes recaps watchable.',
  },
  {
    icon: Layers,
    title: 'Built phone-first',
    body: 'The dock, the panel switcher and the pinned stage exist because that is where the work actually happens.',
  },
];

const STATS = [
  { k: '4', v: 'aspect presets' },
  { k: '2', v: 'TTS providers' },
  { k: '0', v: 'uploads to us' },
  { k: '180s', v: 'render ceiling' },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHeader
        kicker="About"
        title="A studio that respects the footage"
        description="Recap Studio is a client-side video recap workstation: transcribe, script, narrate and render without surrendering your media or your API keys."
        actions={
          <Link href="https://github.com/amkyawdev/recap-studio" target="_blank">
            <Button size="sm" variant="glass" icon={Github}>
              View source
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        <GlassPanel glow="both" padding="lg" grid className="relative">
          <div className="max-w-2xl">
            <span className="mb-4 grid size-11 place-items-center rounded-2xl border border-white/[0.12] bg-gradient-to-br from-violet-600/40 to-gold-500/20">
              <Sparkles className="size-5 text-white" />
            </span>
            <h2 className="text-balance text-xl font-semibold tracking-tight text-white sm:text-2xl">
              Why this exists
            </h2>
            <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/55">
              Most recap tools want your footage on their servers and your API keys in their database. That is a
              reasonable business model and a poor fit for anyone working with embargoed material, client
              deliverables, or a free tier they would rather not exhaust through someone else&apos;s quota.
            </p>
            <p className="mt-3 text-pretty text-[13px] leading-relaxed text-white/55">
              Recap Studio inverts it. The browser does the work, your keys stay in an encrypted vault you control,
              and the only thing that ever crosses the network is the request you explicitly made.
            </p>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.k} className="rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5">
                <dt className="mono-num text-lg font-semibold text-white">{stat.k}</dt>
                <dd className="mt-0.5 text-2xs leading-tight text-white/40">{stat.v}</dd>
              </div>
            ))}
          </dl>
        </GlassPanel>

        <div className="grid gap-3 sm:grid-cols-2">
          {PRINCIPLES.map((principle, i) => (
            <motion.div
              key={principle.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
            >
              <GlassPanel padding="md" className="h-full">
                <span className="mb-3 grid size-9 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.03]">
                  <principle.icon className="size-4 text-violet-300" />
                </span>
                <h3 className="text-[13px] font-semibold text-white">{principle.title}</h3>
                <p className="mt-1.5 text-2xs leading-relaxed text-white/45">{principle.body}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassPanel padding="lg" className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Zap className="size-4 text-gold-400" />
              What is inside
            </h2>
            <ul className="space-y-2 text-2xs leading-relaxed text-white/50">
              {[
                'Next.js 14 App Router with a standalone output for container deploys.',
                'Zustand stores for the editor session and the encrypted key vault.',
                'Framer Motion for panel transitions, modals and press micro-interactions.',
                '@ffmpeg/ffmpeg 0.12 driving a single-graph encode with ASS subtitle burn-in.',
                'A Cloudflare Worker relay for optional rate limiting and key isolation.',
                'Firebase auth (Google and SMS OTP) that degrades to a local profile when unconfigured.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-violet-400" />
                  {item}
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel padding="lg" className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Shield className="size-4 text-signal-green" />
              Honest limitations
            </h2>
            <ul className="space-y-2 text-2xs leading-relaxed text-white/50">
              {[
                'Wasm encoding is CPU-bound: a three-minute 1080p export is minutes, not seconds.',
                'Mobile Safari caps wasm memory lower than desktop — long clips may fail there.',
                'The vault protects keys at rest, not against malware already running in your browser.',
                'YouTube intake registers the source; transcription needs the media file itself.',
                'Nothing here replaces a colour-graded NLE for the final master.',
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-gold-400" />
                  {item}
                </li>
              ))}
            </ul>
          </GlassPanel>
        </div>

        <GlassPanel padding="lg" className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-11 place-items-center rounded-2xl border border-white/[0.12] bg-gradient-to-br from-violet-600/40 to-gold-500/20">
            <Heart className="size-5 text-white" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">Built in the open</h2>
            <p className="mx-auto mt-2 max-w-md text-pretty text-2xs leading-relaxed text-white/50">
              Issues, ideas and pull requests are welcome. If you ship a recap made with this, we would love to see
              it.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link href="https://github.com/amkyawdev/recap-studio" target="_blank">
              <Button variant="primary" size="md" icon={Github}>
                Star on GitHub
              </Button>
            </Link>
            <Link href="https://github.com/amkyawdev/recap-studio/issues" target="_blank">
              <Button variant="glass" size="md" icon={Mail}>
                Report an issue
              </Button>
            </Link>
          </div>
        </GlassPanel>
      </div>
    </PageShell>
  );
}
