'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AudioLines,
  Cpu,
  Crop,
  Layers,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Upload,
  Volume2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { PageShell } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { PreviewStage } from '@/components/editor/preview-stage';
import { FfmpegExporter } from '@/components/editor/ffmpeg-exporter';
import { TtsVoiceEngine } from '@/components/editor/tts-voice-engine';
import { MediaOverlay } from '@/components/editor/media-overlay';
import { VideoTimeline, TimelineTransport } from '@/components/editor/video-timeline';
import { Inspector, ToolRail } from '@/components/editor/inspector';
import { useEditorStore } from '@/store/use-editor-store';
import { MAX_DURATION_SEC } from '@/lib/ffmpeg/render-engine';
import { formatClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * Recap Studio editor.
 *
 * Desktop is laid out like a desktop NLE: a tool rail on the left, the preview
 * stage in the middle, the context inspector on the right, and the multitrack
 * timeline docked across the full width beneath — the CapCut / Alight Motion
 * arrangement. Mobile collapses to a stage-over-timeline stack with the
 * inspector reachable as a sheet.
 *
 * Exactly one layout is mounted at a time. Rendering both and hiding one with
 * CSS would mount two timelines, and the timeline owns global key handlers —
 * pressing `S` would then split twice.
 */

/** Track a media query without a hydration mismatch. */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

type MobileSheetTab = 'tools' | 'voice' | 'overlay' | 'render';

export default function EditorPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [sheet, setSheet] = useState<MobileSheetTab | null>(null);

  return (
    <PageShell hideDock bleed className="pb-4">
      <div className="flex h-[calc(100dvh-56px)] flex-col">
        <TopBar />
        {isDesktop ? <DesktopLayout /> : <MobileLayout sheet={sheet} setSheet={setSheet} />}
      </div>
      <MobileSheet sheet={sheet} setSheet={setSheet} />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */

function TopBar() {
  const source = useEditorStore((s) => s.source);
  const overLimit = useEditorStore((s) => s.overLimit());
  const sequenceDuration = useEditorStore((s) => s.sequenceDuration());
  const clipCount = useEditorStore((s) => s.clips.length);

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-black/40 px-3 py-2 backdrop-blur-xl sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-white/[0.1] bg-gradient-to-br from-violet-600/30 to-gold-500/15">
          <SlidersHorizontal className="size-4 text-white" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-[13px] font-semibold tracking-tight text-white">
            {source.kind === 'none' ? 'Untitled project' : source.title.slice(0, 48)}
          </h1>
          <p className="mono-num flex items-center gap-1.5 text-2xs text-white/40">
            <span>
              {clipCount} clip{clipCount === 1 ? '' : 's'}
            </span>
            <span className="text-white/20">·</span>
            <span className={cn(overLimit && 'text-signal-red')}>
              {formatClock(sequenceDuration)} / {formatClock(MAX_DURATION_SEC)}
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="pill hidden h-7 gap-1.5 border border-signal-green/25 bg-signal-green/[0.07] px-2.5 text-2xs text-signal-green sm:inline-flex">
          <span className="size-1.5 rounded-full bg-signal-green" />
          on-device
        </span>
        <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => useEditorStore.getState().reset()}>
          <span className="hidden sm:inline">Reset</span>
        </Button>
        <Link href="/upload">
          <Button size="sm" variant="glass" icon={Upload}>
            <span className="hidden sm:inline">Import</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}

function DesktopLayout() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="shrink-0">
          <ToolRail />
        </div>

        <GlassPanel padding="md" className="flex min-w-0 flex-1 flex-col">
          <StageHeader />
          <div className="min-h-0 flex-1">
            <PreviewStage />
          </div>
        </GlassPanel>

        <div className="w-[336px] shrink-0">
          <Inspector />
        </div>
      </div>

      {/* Multitrack timeline docked across the bottom */}
      <div className="h-[304px] shrink-0 px-3 pb-3">
        <VideoTimeline />
      </div>
    </div>
  );
}

function MobileLayout({
  sheet,
  setSheet,
}: {
  sheet: MobileSheetTab | null;
  setSheet: (tab: MobileSheetTab | null) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3 pt-3">
        <GlassPanel padding="sm" className="space-y-2">
          <StageHeader compact />
          <div className="h-[300px]">
            <PreviewStage />
          </div>
          <TimelineTransport />
        </GlassPanel>
      </div>

      <div className="min-h-0 flex-1 px-3 py-3">
        <VideoTimeline />
      </div>

      <div className="shrink-0 border-t border-white/[0.07] bg-black/50 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <MobileToolButton icon={Scissors} label="Edit" onClick={() => setSheet('tools')} />
          <MobileToolButton icon={AudioLines} label="Voice" onClick={() => setSheet('voice')} />
          <MobileToolButton icon={Crop} label="Frame" onClick={() => setSheet('overlay')} />
          <MobileToolButton icon={Cpu} label="Export" onClick={() => setSheet('render')} />
          <button
            type="button"
            onClick={() => setSheet(sheet ? null : 'tools')}
            className="pill ml-auto h-9 gap-1.5 bg-violet-600 px-3.5 text-xs text-white"
          >
            <Layers className="size-3.5" />
            Tools
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileSheet({
  sheet,
  setSheet,
}: {
  sheet: MobileSheetTab | null;
  setSheet: (tab: MobileSheetTab | null) => void;
}) {
  const close = () => setSheet(null);

  return (
    <AnimatePresence>
      {sheet && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end lg:hidden">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.div
            initial={{ y: '6%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '8%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) close();
            }}
            className="relative z-10 flex h-[84dvh] flex-col overflow-hidden rounded-t-3xl border-t border-white/[0.1] bg-ink-700/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl"
          >
            <div className="flex justify-center pt-3">
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-4 pb-2 pt-2">
              <h2 className="text-[13px] font-semibold text-white">
                {sheet === 'tools' ? 'Tools' : sheet === 'voice' ? 'Voice' : sheet === 'overlay' ? 'Frame' : 'Export'}
              </h2>
              <Button size="xs" variant="ghost" onClick={close}>
                Done
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3">
              {sheet === 'tools' && <Inspector />}
              {sheet === 'voice' && <TtsVoiceEngine />}
              {sheet === 'overlay' && <MediaOverlay />}
              {sheet === 'render' && <FfmpegExporter />}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */

/** Preview chrome with transport controls, mirroring a player header. */
function StageHeader({ compact }: { compact?: boolean }) {
  const playing = useEditorStore((s) => s.playing);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const playhead = useEditorStore((s) => s.playhead);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const sequenceDuration = useEditorStore((s) => s.sequenceDuration());
  const voice = useEditorStore((s) => s.voice);

  return (
    <div className={cn('flex items-center justify-between gap-2', compact ? 'pb-1' : 'mb-2')}>
      <div className="flex items-center gap-1.5">
        <MonitorPlay className="size-3.5 text-violet-400" />
        <span className="kicker">Preview</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPlayhead(Math.max(0, playhead - 5))}
          aria-label="Back 5 seconds"
          className="pill size-7 text-white/50 hover:bg-white/[0.06] hover:text-white active:scale-90"
        >
          <SkipBack className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? 'Pause' : 'Play'}
          className="pill size-8 border border-white/[0.12] bg-white/[0.06] text-white active:scale-95"
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-[1px]" />}
        </button>
        <button
          type="button"
          onClick={() => setPlayhead(Math.min(sequenceDuration, playhead + 5))}
          aria-label="Forward 5 seconds"
          className="pill size-7 text-white/50 hover:bg-white/[0.06] hover:text-white active:scale-90"
        >
          <SkipForward className="size-3.5" />
        </button>

        <span className="mono-num ml-1.5 hidden text-2xs text-white/45 sm:block">
          {formatClock(playhead)} / {formatClock(sequenceDuration)}
        </span>

        <span
          className={cn(
            'pill ml-1.5 h-6 gap-1 border px-2 text-2xs',
            voice.audioUrl
              ? 'border-signal-green/25 bg-signal-green/[0.07] text-signal-green'
              : 'border-white/[0.09] text-white/35',
          )}
          title={voice.audioUrl ? 'Narration loaded' : 'No narration yet'}
        >
          <Volume2 className="size-3" />
          <span className="hidden sm:inline">{voice.audioUrl ? 'narration' : 'silent'}</span>
        </span>
      </div>
    </div>
  );
}

function MobileToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pill h-9 gap-1.5 border border-white/[0.09] bg-white/[0.03] px-3 text-2xs text-white/70 hover:text-white active:scale-95"
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

