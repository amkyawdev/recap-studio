'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AudioLines, Cpu, Crop, Layers, SlidersHorizontal, Sparkles, Upload } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { PreviewStage } from '@/components/editor/preview-stage';
import { SubtitleTimeline } from '@/components/editor/subtitle-timeline';
import { TtsVoiceEngine } from '@/components/editor/tts-voice-engine';
import { MediaOverlay } from '@/components/editor/media-overlay';
import { FfmpegExporter } from '@/components/editor/ffmpeg-exporter';
import { useEditorStore, type EditorPanel } from '@/store/use-editor-store';
import { cn } from '@/lib/utils/cn';

/**
 * Full mobile-first Recap Studio.
 *
 * Desktop: three columns — tools / stage / export.
 * Mobile: the stage stays pinned and the tool panels swap in place beneath it,
 * driven by a dock-style segmented switcher, so nothing scrolls off-screen.
 */

const PANELS: { id: EditorPanel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'subtitle', label: 'Timeline', icon: Layers },
  { id: 'voice', label: 'Voice', icon: AudioLines },
  { id: 'overlay', label: 'Overlay', icon: Crop },
  { id: 'render', label: 'Render', icon: Cpu },
];

export default function EditorPage() {
  const panel = useEditorStore((s) => s.panel);
  const setPanel = useEditorStore((s) => s.setPanel);
  const source = useEditorStore((s) => s.source);

  return (
    <PageShell hideDock bleed className="pb-8">
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl border border-white/[0.1] bg-gradient-to-br from-violet-600/30 to-gold-500/15">
              <SlidersHorizontal className="size-4 text-white" />
            </span>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-white">Recap Studio</h1>
              <p className="mono-num text-2xs text-white/40">
                {source.kind === 'none' ? 'no source' : source.title.slice(0, 42)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="pill h-7 gap-1.5 border border-signal-green/25 bg-signal-green/[0.07] px-2.5 text-2xs text-signal-green">
              <span className="size-1.5 rounded-full bg-signal-green" />
              on-device render
            </span>
            <Link href="/upload">
              <Button size="sm" variant="glass" icon={Upload}>
                Source
              </Button>
            </Link>
          </div>
        </div>

        {/* Desktop grid */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex min-h-0 flex-col gap-4">
            <SubtitleTimeline />
          </div>

          <GlassPanel padding="md" className="flex min-h-[640px] flex-col">
            <PreviewStage />
          </GlassPanel>

          <div className="flex min-h-0 flex-col gap-4">
            <TtsVoiceEngine />
            <FfmpegExporter />
          </div>
        </div>

        {/* Mobile / tablet stacked layout */}
        <div className="flex flex-col gap-4 lg:hidden">
          <GlassPanel padding="md">
            <PreviewStage />
          </GlassPanel>

          <PanelSwitcher value={panel} onChange={setPanel} />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={panel}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="min-h-[420px]"
            >
              {panel === 'subtitle' && <SubtitleTimeline />}
              {panel === 'voice' && <TtsVoiceEngine />}
              {panel === 'overlay' && <MediaOverlay />}
              {panel === 'render' && <FfmpegExporter />}
            </motion.div>
          </AnimatePresence>

          <MobileTips />
        </div>
      </div>
    </PageShell>
  );
}

function PanelSwitcher({
  value,
  onChange,
}: {
  value: EditorPanel;
  onChange: (panel: EditorPanel) => void;
}) {
  return (
    <div className="sticky top-14 z-30 -mx-3 border-y border-white/[0.07] bg-black/70 px-3 py-2 backdrop-blur-xl sm:-mx-5 sm:px-5">
      <div className="flex gap-1 rounded-full border border-white/[0.08] bg-black/50 p-0.5">
        {PANELS.map(({ id, label, icon: Icon }) => {
          const active = id === value;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium transition-colors',
                active ? 'text-white' : 'text-white/45',
              )}
            >
              {active && (
                <motion.span
                  layoutId="panel-active"
                  transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  className="absolute inset-0 rounded-full border border-white/[0.12] bg-white/[0.09]"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileTips() {
  return (
    <GlassPanel padding="md" grid className="text-2xs leading-relaxed text-white/45">
      <p className="mb-2 flex items-center gap-1.5 kicker">
        <Sparkles className="size-3 text-gold-400" />
        Workflow
      </p>
      <ol className="space-y-1.5">
        <li>1. Import a source and transcribe it in Upload.</li>
        <li>2. Tighten the timeline to the 3-minute budget.</li>
        <li>3. Generate narration with your ElevenLabs or Gemini key.</li>
        <li>4. Set the aspect ratio and watermark, then render on-device.</li>
      </ol>
    </GlassPanel>
  );
}
