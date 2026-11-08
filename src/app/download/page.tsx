'use client';

import { motion } from 'framer-motion';
import {
  Apple,
  Boxes,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  FileCode2,
  Github,
  HardDriveDownload,
  MonitorSmartphone,
  Package,
  RefreshCw,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
import { PageShell, PageHeader } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { UpdateBadge } from '@/components/ui/update-badge';
import { usePwaInstall } from '@/lib/utils/pwa';
import { cn } from '@/lib/utils/cn';

const REPO = 'amkyawdev/recap-studio';
const RELEASES = `https://github.com/${REPO}/releases`;

/**
 * Download & Releases hub — PWA install, FFmpeg core binaries, and the CI
 * release feed.
 */

export default function DownloadPage() {
  const { state, promptInstall } = usePwaInstall();
  const [notice, setNotice] = useState<string | null>(null);

  const installPwa = async () => {
    const outcome = await promptInstall();
    if (outcome === 'manual') {
      setNotice('Use your browser menu → "Install app" or "Add to Home Screen".');
    } else if (outcome === 'dismissed') {
      setNotice('Install dismissed. You can install any time from this page.');
    } else {
      setNotice('Installing — look for the Recap Studio icon on your home screen.');
    }
  };

  const installed = state === 'installed';

  return (
    <PageShell>
      <PageHeader
        kicker="Releases"
        title="Download &amp; Resources"
        description="Install Recap Studio as an offline-capable app, grab the FFmpeg core for self-hosting, or pull a build straight from CI."
        actions={<UpdateBadge variant="inline" />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* PWA install */}
        <GlassPanel glow="violet" padding="lg" className="flex flex-col">
          <span className="mb-3 grid size-10 place-items-center rounded-2xl border border-violet-500/25 bg-violet-500/10">
            <Smartphone className="size-5 text-violet-300" />
          </span>
          <h2 className="text-sm font-semibold text-white">Install the PWA</h2>
          <p className="mt-1.5 flex-1 text-2xs leading-relaxed text-white/45">
            Runs full-screen with an offline shell. Renders still require the FFmpeg core to be cached, which
            happens automatically on first export.
          </p>

          <ul className="my-4 space-y-1.5">
            {['Offline shell & cache', 'Home-screen icon', 'No store review'].map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-2xs text-white/55">
                <CheckCircle2 className="size-3 text-signal-green" />
                {item}
              </li>
            ))}
          </ul>

          <Button
            variant={installed ? 'glass' : 'primary'}
            size="md"
            icon={installed ? CheckCircle2 : MonitorSmartphone}
            onClick={() => void installPwa()}
            disabled={installed}
            className="w-full"
          >
            {installed ? 'Already installed' : 'Install app'}
          </Button>

          {notice && (
            <p className="mt-2.5 text-2xs leading-relaxed text-white/45">{notice}</p>
          )}

          {state === 'unsupported' && !notice && (
            <p className="mt-2.5 text-2xs leading-relaxed text-white/35">
              This browser has not offered an install prompt. Use the browser menu to install.
            </p>
          )}
        </GlassPanel>

        {/* FFmpeg core */}
        <GlassPanel glow="gold" padding="lg" className="flex flex-col">
          <span className="mb-3 grid size-10 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10">
            <Cpu className="size-5 text-gold-300" />
          </span>
          <h2 className="text-sm font-semibold text-white">FFmpeg core binaries</h2>
          <p className="mt-1.5 flex-1 text-2xs leading-relaxed text-white/45">
            The wasm core used by the render engine. Host these under <code className="mono-num">/public/ffmpeg</code>{' '}
            to render without touching a CDN.
          </p>

          <div className="my-4 space-y-1.5">
            {[
              { name: 'ffmpeg-core.js', size: '~110 KB' },
              { name: 'ffmpeg-core.wasm', size: '~32 MB' },
            ].map((file) => (
              <a
                key={file.name}
                href={`https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/${file.name}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-2xs text-white/65 transition-colors hover:border-gold-500/30 hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  <FileCode2 className="size-3" />
                  {file.name}
                </span>
                <span className="mono-num text-white/35">{file.size}</span>
              </a>
            ))}
          </div>

          <a
            href="https://www.npmjs.com/package/@ffmpeg/core"
            target="_blank"
            rel="noreferrer"
            className="pill h-9 w-full border border-white/[0.14] text-white/80 hover:border-white/25 hover:text-white"
          >
            <Package className="size-4" />
            npm package
          </a>
        </GlassPanel>

        {/* CI release */}
        <GlassPanel padding="lg" className="flex flex-col">
          <span className="mb-3 grid size-10 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.04]">
            <Boxes className="size-5 text-white/70" />
          </span>
          <h2 className="text-sm font-semibold text-white">Automated builds</h2>
          <p className="mt-1.5 flex-1 text-2xs leading-relaxed text-white/45">
            Every push to <code className="mono-num">main</code> bundles the standalone server and uploads it as a
            workflow artifact. Tagging <code className="mono-num">v*</code> publishes a GitHub release.
          </p>

          <div className="my-4 space-y-1.5 text-2xs">
            {[
              ['Bundle', 'recap-studio-standalone.tar.gz'],
              ['Runtime', 'Node 20 · standalone output'],
              ['Artifact', '30-day retention'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-white/40">{k}</span>
                <span className="mono-num text-white/65">{v}</span>
              </div>
            ))}
          </div>

          <a href={RELEASES} target="_blank" rel="noreferrer" className="pill h-9 w-full bg-gradient-to-b from-gold-300 to-gold-500 font-semibold text-black">
            <Github className="size-4" />
            Open releases
          </a>
        </GlassPanel>
      </div>

      {/* Platform cards */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <GlassPanel padding="md" className="space-y-3">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <Apple className="size-4 text-white/70" />
            iOS &amp; iPadOS
          </h3>
          <ol className="space-y-2 text-2xs leading-relaxed text-white/45">
            <li>1. Open this site in Safari.</li>
            <li>2. Tap the Share sheet, then “Add to Home Screen”.</li>
            <li>3. Launch from the new icon for the full-screen shell.</li>
          </ol>
          <p className="text-2xs text-white/35">
            Note: Safari’s wasm memory ceiling can be tighter than desktop — keep recaps short.
          </p>
        </GlassPanel>

        <GlassPanel padding="md" className="space-y-3">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-white">
            <HardDriveDownload className="size-4 text-white/70" />
            Self-host the standalone build
          </h3>
          <div className="rounded-xl border border-white/[0.07] bg-black/50 p-3">
            <pre className="mono-num overflow-x-auto text-2xs leading-relaxed text-white/70">
              {`tar -xzf recap-studio-standalone.tar.gz
cd recap-studio
node server.js   # :3000`}
            </pre>
          </div>
          <p className="text-2xs leading-relaxed text-white/45">
            The standalone bundle needs no <code className="mono-num">node_modules</code>. Point{' '}
            <code className="mono-num">NEXT_PUBLIC_RELAY_URL</code> at your Cloudflare Worker to route provider
            calls through the edge relay.
          </p>
        </GlassPanel>
      </div>

      {/* Release notes */}
      <div className="mt-4">
        <GlassPanel padding="md" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <Terminal className="size-4 text-violet-400" />
              Release notes
            </h3>
            <div className="flex items-center gap-2">
              <span className="mono-num rounded-md bg-white/[0.05] px-1.5 py-0.5 text-2xs text-white/45">v1.0.0</span>
              <a href={RELEASES} target="_blank" rel="noreferrer" className="pill h-7 gap-1 border border-white/[0.12] px-2.5 text-2xs text-white/70 hover:text-white">
                All releases
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>

          <ul className="space-y-2.5">
            {[
              ['Mobile-first editor', 'Panel switcher, floating dock, and a pinned 9:16 / 16:9 preview stage.'],
              ['Encrypted BYOK vault', 'AES-GCM-256 key store with session or device persistence.'],
              ['Client-side rendering', 'FFmpeg.wasm pipeline with an enforced three-minute ceiling.'],
              ['Live TTS waveform', 'ElevenLabs and Gemini narration with analyser-driven visualisation.'],
              ['Edge relay', 'Optional Cloudflare Worker for rate limiting and key isolation.'],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-signal-green" />
                <div>
                  <p className="text-2xs font-medium text-white/80">{title}</p>
                  <p className="text-2xs leading-relaxed text-white/40">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Download, label: 'Direct download', value: 'Standalone bundle', href: `${RELEASES}/latest` },
          { icon: RefreshCw, label: 'Auto-updates', value: 'Service worker', href: '/docs' },
          { icon: Github, label: 'Source', value: `github.com/${REPO}`, href: `https://github.com/${REPO}` },
        ].map((card) => (
          <a
            key={card.label}
            href={card.href}
            target={card.href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            className={cn(
              'group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition-colors',
              'hover:border-violet-500/25 hover:bg-violet-500/[0.05]',
            )}
          >
            <span className="grid size-8 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.03]">
              <card.icon className="size-4 text-white/60" />
            </span>
            <span className="min-w-0">
              <span className="block text-2xs text-white/40">{card.label}</span>
              <span className="mono-num block truncate text-2xs text-white/75">{card.value}</span>
            </span>
          </a>
        ))}
      </div>
    </PageShell>
  );
}
