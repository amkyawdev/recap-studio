'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  AudioLines,
  Cpu,
  Crop,
  Download,
  Film,
  Github,
  Layers,
  Lock,
  Play,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { UpdateBadge } from '@/components/ui/update-badge';
import { cn } from '@/lib/utils/cn';

const FEATURES = [
  {
    icon: Layers,
    title: 'Precision SRT timeline',
    body: 'Word-accurate timecodes, typewriter read-through, auto-sync that redistributes cues to the 3-minute budget.',
  },
  {
    icon: AudioLines,
    title: 'Multi-provider narration',
    body: 'ElevenLabs or Gemini TTS with a live waveform, stability and speed control, and instant MP3/WAV export.',
  },
  {
    icon: Crop,
    title: 'Proportion & overlay',
    body: '9:16, 16:9, 1:1 and 4:5 with a draggable watermark layer and ASS-styled burned-in subtitles.',
  },
  {
    icon: Cpu,
    title: 'On-device FFmpeg',
    body: 'The whole render runs in a wasm worker. Your footage and keys never leave the browser.',
  },
  {
    icon: Lock,
    title: 'BYOK, encrypted',
    body: 'Provider keys sit in an AES-GCM vault behind a passphrase. No proxy, no server-side copy.',
  },
  {
    icon: Timer,
    title: 'Three-minute discipline',
    body: 'A hard ceiling that warns before it fails — pacing budget, limit meter and trim guardrails.',
  },
] as const;

export default function LandingPage() {
  return (
    <PageShell bleed>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pt-20">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]"
          >
            <div>
              <motion.div variants={fadeUp} className="mb-5 flex flex-wrap items-center gap-2">
                <span className="pill h-7 gap-1.5 border border-violet-500/30 bg-violet-500/[0.09] px-2.5 text-2xs text-violet-200">
                  <Sparkles className="size-3" />
                  BYOK AI recap pipeline
                </span>
                <UpdateBadge variant="inline" />
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-balance text-[34px] font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[56px]"
              >
                Cut a long video into a{' '}
                <span className="signal-text">three-minute recap</span>, entirely in your browser.
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-white/55"
              >
                Transcribe, script, narrate and render — with your own API keys, a client-side FFmpeg engine, and
                a studio console built for a phone first.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-7 flex flex-wrap items-center gap-2.5">
                <Link href="/editor">
                  <Button variant="primary" size="lg" icon={Play} iconRight={ArrowRight}>
                    Open the studio
                  </Button>
                </Link>
                <Link href="/download">
                  <Button variant="glass" size="lg" icon={Download}>
                    Install the app
                  </Button>
                </Link>
                <Link
                  href="https://github.com/amkyawdev/recap-studio"
                  target="_blank"
                  className="pill h-11 gap-2 px-4 text-sm text-white/50 hover:text-white"
                >
                  <Github className="size-4" />
                  Source
                </Link>
              </motion.div>

              <motion.dl variants={fadeUp} className="mt-9 grid max-w-lg grid-cols-3 gap-3">
                {[
                  { k: '180s', v: 'hard render ceiling' },
                  { k: '4', v: 'aspect presets' },
                  { k: '0', v: 'bytes uploaded' },
                ].map((stat) => (
                  <div key={stat.k} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                    <dt className="mono-num text-lg font-semibold text-white">{stat.k}</dt>
                    <dd className="mt-0.5 text-2xs leading-tight text-white/40">{stat.v}</dd>
                  </div>
                ))}
              </motion.dl>
            </div>

            <motion.div variants={fadeUp} className="relative">
              <StudioMock />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Marquee strip */}
      <section className="relative border-y border-white/[0.07] py-3">
        <div className="mask-fade-x flex overflow-hidden">
          <div className="flex shrink-0 animate-marquee gap-8 pr-8">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex shrink-0 items-center gap-8">
                {[
                  'Gemini · script + TTS',
                  'ElevenLabs · narration',
                  'AssemblyAI · word timings',
                  'FFmpeg.wasm · client render',
                  'Firebase · optional sync',
                ].map((item) => (
                  <span key={item} className="mono-num whitespace-nowrap text-2xs uppercase tracking-[0.2em] text-white/25">
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="mb-9 max-w-2xl">
          <p className="kicker mb-2">The console</p>
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Every tool a recap channel needs, in one dark surface.
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassPanel padding="md" className="group h-full">
                <span className="mb-3 grid size-9 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.03] transition-colors group-hover:border-violet-500/30 group-hover:bg-violet-500/[0.08]">
                  <feature.icon className="size-4 text-white/70 transition-colors group-hover:text-violet-300" />
                </span>
                <h3 className="text-[13px] font-semibold text-white">{feature.title}</h3>
                <p className="mt-1.5 text-2xs leading-relaxed text-white/45">{feature.body}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <GlassPanel glow="both" padding="lg" grid className="relative">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="kicker mb-2">Four moves</p>
              <h2 className="text-balance text-xl font-semibold tracking-tight text-white sm:text-2xl">
                From raw footage to a publishable recap.
              </h2>
              <ol className="mt-6 space-y-4">
                {[
                  ['Intake', 'Drop a file or paste a link and an SRT. Transcribe to word-level timings.'],
                  ['Script', 'Gemini compresses the transcript to a 450-word narration in your chosen tone.'],
                  ['Voice', 'ElevenLabs or Gemini TTS reads it back with a live waveform you can preview.'],
                  ['Render', 'Frame it, watermark it, burn the subtitles, then compile on-device.'],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="mono-num mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.03] text-2xs text-white/60">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-white">{title}</p>
                      <p className="mt-0.5 text-2xs leading-relaxed text-white/45">{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex items-center justify-center">
              <PhonePreview />
            </div>
          </div>
        </GlassPanel>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <GlassPanel glow="violet" padding="lg" className="flex flex-col items-center gap-5 text-center">
            <span className="grid size-12 place-items-center rounded-2xl border border-white/[0.12] bg-gradient-to-br from-violet-600/40 to-gold-500/20">
              <Zap className="size-5 text-white" />
            </span>
            <div>
              <h2 className="text-balance text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Ready to cut your first recap?
              </h2>
              <p className="mx-auto mt-2 max-w-md text-pretty text-[13px] leading-relaxed text-white/50">
                Add a key, load a source, and the studio does the rest — no sign-up wall, no upload queue.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              <Link href="/editor">
                <Button variant="primary" size="lg" icon={Film} iconRight={ArrowRight}>
                  Start in the editor
                </Button>
              </Link>
              <Link href="/api-settings">
                <Button variant="glass" size="lg" icon={Lock}>
                  Configure keys
                </Button>
              </Link>
            </div>
          </GlassPanel>
        </motion.div>
      </section>
    </PageShell>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
} as const;

/** Abstract mock of the studio UI for the hero column. */
function StudioMock() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[40px] bg-radial-violet opacity-70 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-ink-700/70 p-3 backdrop-blur-xl shadow-panel">
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="mono-num ml-2 text-2xs text-white/30">recap-studio / editor</span>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2.5">
          <div className="space-y-2">
            <div className="aspect-[16/10] overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-ink-800 to-black">
              <div className="flex h-full items-center justify-center">
                <span className="grid size-9 place-items-center rounded-full border border-white/[0.14] bg-white/[0.06]">
                  <Play className="size-4 text-white/70" />
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {[90, 72, 84, 60].map((w, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="mono-num text-[9px] text-white/25">00:0{i}</span>
                  <span
                    className={cn('h-1.5 rounded-full', i === 1 ? 'signal-bar' : 'bg-white/[0.09]')}
                    style={{ width: `${w}%` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="w-[92px] space-y-2">
            {[
              { label: 'Waveform', bars: true },
              { label: 'Aspect 9:16', bars: false },
              { label: 'Watermark', bars: false },
            ].map((panel) => (
              <div key={panel.label} className="rounded-xl border border-white/[0.07] bg-black/40 p-2">
                <p className="mb-1.5 text-[9px] text-white/35">{panel.label}</p>
                {panel.bars ? (
                  <div className="flex h-6 items-center gap-[2px]">
                    {[0.3, 0.7, 0.45, 0.9, 0.6, 0.35, 0.8, 0.5].map((h, i) => (
                      <span
                        key={i}
                        className="w-full rounded-full bg-gradient-to-t from-violet-600 to-gold-300"
                        style={{ height: `${h * 100}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="block h-1.5 w-full rounded-full bg-white/[0.09]" />
                    <span className="block h-1.5 w-2/3 rounded-full bg-white/[0.09]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/[0.07] bg-black/40 px-2.5 py-2">
          <span className="size-1.5 rounded-full bg-signal-green" />
          <span className="mono-num text-[9px] text-white/45">encoding · 62%</span>
          <span className="ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
            <span className="signal-bar block h-full w-[62%]" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Compact vertical-phone preview used in the workflow section. */
function PhonePreview() {
  return (
    <motion.div
      initial={{ opacity: 0, rotate: -4, y: 20 }}
      whileInView={{ opacity: 1, rotate: -3, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-[220px]"
    >
      <div className="absolute -inset-4 rounded-[44px] bg-radial-gold opacity-50 blur-2xl" />
      <div className="relative aspect-[9/16] overflow-hidden rounded-[32px] border border-white/[0.12] bg-black shadow-panel">
        <span className="absolute left-1/2 top-3 z-20 h-1.5 w-14 -translate-x-1/2 rounded-full bg-white/15" />
        <div className="absolute inset-0 bg-gradient-to-br from-ink-800 via-black to-ink-900" />
        <div className="absolute inset-0 grid-lines opacity-30" />

        <div className="absolute inset-x-3 bottom-24 text-center">
          <p className="text-[13px] font-semibold leading-snug text-white">
            “By dawn, everything we believed about the crash will be wrong.”
          </p>
        </div>

        <div className="absolute inset-x-3 bottom-12 flex items-center gap-2 rounded-xl border border-white/[0.1] bg-black/60 px-2.5 py-2 backdrop-blur">
          <span className="size-1.5 rounded-full bg-signal-green" />
          <span className="mono-num text-[9px] text-white/45">narration ready</span>
          <span className="ml-auto flex h-4 items-end gap-[2px]">
            {[0.4, 0.8, 0.5, 1, 0.6].map((h, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-gradient-to-t from-violet-600 to-gold-300"
                style={{ height: `${h * 100}%` }}
              />
            ))}
          </span>
        </div>

        <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-full border border-white/[0.1] bg-ink-700/80 px-2 py-1.5 backdrop-blur">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn('h-1.5 rounded-full', i === 2 ? 'w-6 bg-violet-400' : 'w-1.5 bg-white/20')}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
