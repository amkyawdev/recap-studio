'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileAudio,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';
import { PageShell, PageHeader } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { PROVIDERS, PROVIDER_ORDER } from '@/lib/api/client-router';
import { ELEVEN_VOICES } from '@/lib/api/elevenlabs';
import { GEMINI_TEXT_MODELS, GEMINI_VOICES } from '@/lib/api/gemini';

const FLOW = [
  {
    icon: KeyRound,
    title: '1 · Get a key',
    body: 'Create a key in the provider console. Where the provider supports it, scope the key and set a spend cap.',
  },
  {
    icon: Lock,
    title: '2 · Store it in the vault',
    body: 'Paste it into API Settings behind your vault passphrase. It is encrypted with AES-GCM-256 before it touches storage.',
  },
  {
    icon: ShieldCheck,
    title: '3 · Test the connection',
    body: 'The Test button issues a lightweight probe and reports latency plus any quota headers the provider sends back.',
  },
  {
    icon: Sparkles,
    title: '4 · Use it in the studio',
    body: 'The router reads the key at call time. Requests go straight to the provider, or through your relay when one is configured.',
  },
];

export default function ApiUsagePage() {
  return (
    <PageShell>
      <PageHeader
        kicker="Documentation · API usage"
        title="API setup guide"
        description="Recap Studio is bring-your-own-key. Nothing is billed through us, and no key is ever transmitted to our infrastructure."
        actions={
          <Link href="/api-settings">
            <Button size="sm" variant="primary" icon={KeyRound}>
              Open API Settings
            </Button>
          </Link>
        }
      />

      <div className="space-y-4">
        {/* Flow */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <GlassPanel padding="md" className="h-full">
                <span className="mb-3 grid size-8 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.03]">
                  <step.icon className="size-4 text-violet-300" />
                </span>
                <h3 className="text-2xs font-semibold uppercase tracking-wide text-white/80">{step.title}</h3>
                <p className="mt-1.5 text-2xs leading-relaxed text-white/45">{step.body}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </div>

        {/* Providers */}
        <GlassPanel padding="lg" className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound className="size-4 text-violet-400" />
            Provider keys
          </h2>

          <div className="space-y-2.5">
            {PROVIDER_ORDER.map((id) => {
              const spec = PROVIDERS[id];
              return (
                <div
                  key={id}
                  className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-medium text-white">{spec.label}</h3>
                      <span className="mono-num rounded-md bg-white/[0.05] px-1.5 py-0.5 text-2xs text-white/40">
                        slot: {spec.slot}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs leading-relaxed text-white/45">{spec.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="mono-num hidden rounded-md border border-white/[0.08] bg-black/40 px-2 py-1 text-2xs text-white/50 sm:block">
                      {spec.placeholder}
                    </code>
                    <a
                      href={spec.docs}
                      target="_blank"
                      rel="noreferrer"
                      className="pill h-8 gap-1.5 border border-white/[0.14] px-3 text-2xs text-white/80 hover:border-white/25 hover:text-white"
                    >
                      Get a key
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>

        {/* Models & voices */}
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassPanel padding="lg" className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <AudioLines className="size-4 text-gold-400" />
              Voice models
            </h2>
            <div>
              <p className="kicker mb-2">ElevenLabs · {ELEVEN_VOICES.length} preset voices</p>
              <div className="flex flex-wrap gap-1.5">
                {ELEVEN_VOICES.map((voice) => (
                  <span
                    key={voice.id}
                    className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-2xs text-white/60"
                    title={voice.character}
                  >
                    {voice.label}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="kicker mb-2">Gemini TTS · {GEMINI_VOICES.length} voices</p>
              <div className="flex flex-wrap gap-1.5">
                {GEMINI_VOICES.map((voice) => (
                  <span
                    key={voice.id}
                    className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-2xs text-white/60"
                    title={voice.character}
                  >
                    {voice.label}
                  </span>
                ))}
              </div>
            </div>
          </GlassPanel>

          <GlassPanel padding="lg" className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="size-4 text-violet-400" />
              Script models
            </h2>
            <div className="space-y-2">
              {GEMINI_TEXT_MODELS.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5"
                >
                  <div>
                    <p className="text-2xs font-medium text-white/80">{model.label}</p>
                    <p className="mono-num text-2xs text-white/35">{model.id}</p>
                  </div>
                  <span className="text-2xs text-white/40">{model.blurb}</span>
                </div>
              ))}
            </div>
            <p className="text-2xs leading-relaxed text-white/40">
              Gemini is asked for strict JSON (<code className="mono-num">{'{ hook, script }'}</code>). If the model
              ignores the contract, the router falls back to treating the whole reply as the script.
            </p>
          </GlassPanel>
        </div>

        {/* Relay */}
        <GlassPanel padding="lg" className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Terminal className="size-4 text-violet-400" />
            Optional edge relay
          </h2>
          <p className="text-[13px] leading-relaxed text-white/55">
            By default the browser talks to providers directly. If you want central rate limiting, request logging
            or a place to hold keys server-side, deploy the bundled Cloudflare Worker and point the app at it.
          </p>
          <div className="rounded-xl border border-white/[0.07] bg-black/50 p-3">
            <pre className="mono-num overflow-x-auto text-2xs leading-relaxed text-white/70">
{`# deploy
cd cloudflare-worker
wrangler deploy

# point the studio at it
NEXT_PUBLIC_RELAY_URL=https://recap-relay.<account>.workers.dev`}
            </pre>
          </div>
          <p className="text-2xs leading-relaxed text-white/45">
            The worker allow-lists provider hosts, injects an origin check, applies a per-IP token bucket and strips
            hop-by-hop headers. It never logs request bodies.
          </p>
        </GlassPanel>

        {/* Troubleshooting */}
        <GlassPanel padding="lg" className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen className="size-4 text-white/70" />
            Troubleshooting
          </h2>
          <div className="space-y-2">
            {[
              ['401 / 403 on probe', 'The key is invalid, revoked, or lacks the required scope for that endpoint.'],
              ['429 on probe', 'You are rate limited. The pill shows "Quota out" until the window resets.'],
              ['CORS errors', 'Route through the edge relay — some providers do not send permissive CORS headers.'],
              ['No audio from Gemini', 'Gemini TTS is preview-gated; confirm the key has access to the TTS model.'],
              ['Render takes forever', 'Lower the CRF target or shorten the timeline; wasm encoding is CPU-bound.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-white/40" />
                <div>
                  <p className="mono-num text-2xs text-white/75">{title}</p>
                  <p className="mt-0.5 text-2xs leading-relaxed text-white/45">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="flex items-center gap-2 text-2xs text-white/50">
            <FileAudio className="size-3.5" />
            Ready to try it? Add a key, then head to the editor.
          </p>
          <div className="flex gap-2">
            <Link href="/api-settings">
              <Button size="sm" variant="glass" icon={KeyRound}>
                API Settings
              </Button>
            </Link>
            <Link href="/editor">
              <Button size="sm" variant="primary" icon={ArrowRight}>
                Open editor
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
