'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Cpu,
  Download,
  Film,
  Gauge,
  HardDriveDownload,
  Play,
  RotateCcw,
  Terminal,
  Timer,
  XCircle,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/store/use-editor-store';
import {
  MAX_DURATION_SEC,
  RenderLimitError,
  assertWithinLimit,
  loadEngine,
  runRender,
  type EngineHandle,
  type RenderInputs,
  type RenderProgress,
} from '@/lib/ffmpeg/render-engine';
import { formatBytes, formatClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * FFmpeg.wasm Render Engine panel.
 *
 * The 3-minute ceiling is surfaced continuously — the timeline bar turns amber
 * as the cut approaches the limit and red once it is over, and the render
 * button is disabled with an explanation rather than failing mid-encode.
 */

export function FfmpegExporter() {
  const cues = useEditorStore((s) => s.cues);
  const source = useEditorStore((s) => s.source);
  const voice = useEditorStore((s) => s.voice);
  const music = useEditorStore((s) => s.music);
  const buildPlan = useEditorStore((s) => s.buildPlan);
  const render = useEditorStore((s) => s.render);
  const setRender = useEditorStore((s) => s.setRender);

  const [showLog, setShowLog] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const engineRef = useRef<EngineHandle | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const timelineDuration = useMemo(
    () => cues.reduce((max, c) => Math.max(max, c.end), 0),
    [cues],
  );

  const overLimit = timelineDuration > MAX_DURATION_SEC + 0.5;
  const nearLimit = !overLimit && timelineDuration > MAX_DURATION_SEC * 0.9;
  const limitRatio = Math.min(1, timelineDuration / MAX_DURATION_SEC);

  const sourceReady = Boolean(source.bytes) || source.kind !== 'none';
  const canRender = sourceReady && cues.length > 0 && !overLimit && !render.running;

  const start = useCallback(async () => {
    setRender({ running: true, error: undefined, outputUrl: undefined });
    setLogLines([]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const plan = buildPlan();
      assertWithinLimit(plan.durationSec);

      const inputs: RenderInputs = {
        source: source.bytes ?? new Uint8Array(0),
        sourceName: `source${guessExtension(source.ref || source.title)}`,
        voice: voice.audioBytes,
        voiceName: voice.audioBytes ? (voice.audioName ?? 'narration.mp3') : undefined,
        music: music.bytes,
        musicName: music.bytes ? (music.name ?? 'music.mp3') : undefined,
      };

      if (inputs.source.byteLength === 0) {
        throw new Error('No source video bytes available. Import a file in Upload first.');
      }

      const onProgress = (progress: RenderProgress) => setRender({ progress });

      if (!engineRef.current) {
        onProgress({ stage: 'loading-core', ratio: 0.02, message: 'Loading FFmpeg core', elapsedSec: 0, etaSec: null });
        engineRef.current = await loadEngine({ onLog: (line) => setLogLines((prev) => [...prev.slice(-299), line]) });
      }

      const result = await runRender(engineRef.current, plan, inputs, {
        onProgress,
        onLog: (line) => setLogLines((prev) => [...prev.slice(-299), line]),
        signal: controller.signal,
      });

      const url = URL.createObjectURL(result.blob);
      setRender({
        running: false,
        outputUrl: url,
        outputName: result.fileName,
        outputSize: result.sizeBytes,
        progress: {
          stage: 'done',
          ratio: 1,
          message: `Rendered in ${result.wallClockSec.toFixed(1)}s`,
          elapsedSec: result.wallClockSec,
          etaSec: 0,
        },
      });
    } catch (error) {
      const message =
        error instanceof RenderLimitError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Render failed.';
      setRender({
        running: false,
        error: message,
        progress: { stage: 'error', ratio: 0, message, elapsedSec: 0, etaSec: null },
      });
    }
  }, [buildPlan, music.bytes, music.name, setRender, source.bytes, source.ref, source.title, voice.audioBytes, voice.audioName]);

  const cancel = () => {
    abortRef.current?.abort();
    engineRef.current?.dispose();
    engineRef.current = null;
    setRender({ running: false, progress: { stage: 'idle', ratio: 0, message: 'Cancelled', elapsedSec: 0, etaSec: null } });
  };

  const download = () => {
    if (!render.outputUrl || !render.outputName) return;
    const anchor = document.createElement('a');
    anchor.href = render.outputUrl;
    anchor.download = render.outputName;
    anchor.click();
  };

  const progress = render.progress;

  return (
    <GlassPanel padding="none" glow={render.running ? 'violet' : 'none'} className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-violet-400" />
          <h2 className="text-[13px] font-semibold text-white">Render Engine</h2>
          <span className="mono-num rounded-md bg-white/[0.05] px-1.5 py-0.5 text-2xs text-white/40">
            ffmpeg.wasm
          </span>
        </div>
        <span className="mono-num flex items-center gap-1 text-2xs text-white/40">
          <Timer className="size-3" />
          {formatClock(timelineDuration)} / 3:00
        </span>
      </header>

      {/* Duration ceiling indicator */}
      <div className="hairline-t px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between text-2xs">
          <span className={cn('flex items-center gap-1.5', overLimit ? 'text-signal-red' : nearLimit ? 'text-signal-amber' : 'text-white/45')}>
            {overLimit ? <Ban className="size-3" /> : <Gauge className="size-3" />}
            {overLimit ? 'Over the 3-minute limit' : nearLimit ? 'Approaching the limit' : 'Within the limit'}
          </span>
          <span className="mono-num text-white/40">{Math.round(limitRatio * 100)}%</span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              overLimit ? 'bg-signal-red' : nearLimit ? 'bg-signal-amber' : 'signal-bar',
            )}
            animate={{ width: `${limitRatio * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          />
          <span className="absolute inset-y-0 left-[90%] w-px bg-white/25" />
        </div>
      </div>

      {/* Progress */}
      <div className="hairline-t space-y-2 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="kicker">{stageLabel(progress.stage)}</span>
          <span className="mono-num text-2xs text-white/45">{Math.round(progress.ratio * 100)}%</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full border border-white/[0.06] bg-black/50">
          <motion.div
            className="signal-bar absolute inset-y-0 left-0"
            animate={{ width: `${progress.ratio * 100}%` }}
            transition={{ type: 'tween', ease: 'linear', duration: 0.25 }}
          />
          {render.running && (
            <motion.span
              className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ['-64px', '260px'] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-2xs text-white/40">
          <span>{progress.message}</span>
          <span className="mono-num">
            {progress.elapsedSec.toFixed(1)}s
            {progress.etaSec !== null && progress.stage === 'encoding' ? ` · ETA ${progress.etaSec.toFixed(0)}s` : ''}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="hairline-t flex flex-wrap items-center gap-1.5 px-3 py-3">
        {render.running ? (
          <Button size="sm" variant="danger" icon={XCircle} onClick={cancel}>
            Cancel render
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            icon={Play}
            onClick={() => void start()}
            disabled={!canRender}
            title={!canRender ? disabledReason(sourceReady, cues.length, overLimit) : undefined}
          >
            Render recap
          </Button>
        )}

        {render.outputUrl && (
          <>
            <Button size="sm" variant="gold" icon={Download} onClick={download}>
              Download MP4
            </Button>
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setRender({ outputUrl: undefined, outputName: undefined, outputSize: undefined })}>
              Clear
            </Button>
            <span className="mono-num ml-auto text-2xs text-white/40">
              {render.outputSize ? formatBytes(render.outputSize) : ''}
            </span>
          </>
        )}

        <Button
          size="sm"
          variant="ghost"
          icon={Terminal}
          className={cn(!render.outputUrl && !render.running && 'ml-auto')}
          onClick={() => setShowLog((v) => !v)}
        >
          Log
        </Button>
      </div>

      <AnimatePresence>
        {render.error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="hairline-t flex items-start gap-2 bg-signal-red/[0.06] px-4 py-2.5"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-signal-red" />
            <p className="text-2xs leading-relaxed text-signal-red/90">{render.error}</p>
          </motion.div>
        )}

        {render.progress.stage === 'done' && !render.error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="hairline-t flex items-center gap-2 bg-signal-green/[0.06] px-4 py-2.5"
          >
            <CheckCircle2 className="size-3.5 shrink-0 text-signal-green" />
            <p className="text-2xs text-signal-green/90">
              Recap compiled on-device. Nothing was uploaded.
            </p>
          </motion.div>
        )}

        {showLog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="hairline-t"
          >
            <div className="max-h-40 overflow-y-auto bg-black/60 px-3 py-2">
              {logLines.length === 0 ? (
                <p className="mono-num text-2xs text-white/30">Encoder log will appear here.</p>
              ) : (
                logLines.slice(-60).map((line, i) => (
                  <p key={i} className="mono-num truncate text-2xs leading-relaxed text-white/45">
                    {line}
                  </p>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="hairline-t flex items-center gap-1.5 px-4 py-2.5">
        <HardDriveDownload className="size-3 text-white/30" />
        <p className="text-2xs leading-relaxed text-white/35">
          First render downloads the ~30&nbsp;MB wasm core, then caches it for offline use.
        </p>
      </footer>
    </GlassPanel>
  );
}

function stageLabel(stage: RenderProgress['stage']): string {
  switch (stage) {
    case 'loading-core':
      return 'Loading engine';
    case 'staging-files':
      return 'Staging files';
    case 'encoding':
      return 'Encoding';
    case 'finalising':
      return 'Finalising';
    case 'done':
      return 'Complete';
    case 'error':
      return 'Failed';
    default:
      return 'Ready';
  }
}

function disabledReason(sourceReady: boolean, cueCount: number, overLimit: boolean): string {
  if (!sourceReady) return 'Import a source video first.';
  if (cueCount === 0) return 'Add at least one subtitle cue.';
  if (overLimit) return 'Trim the timeline under 3 minutes to render.';
  return '';
}

function guessExtension(name: string): string {
  const match = /\.(mp4|mov|webm|mkv|avi|m4v)$/i.exec(name);
  return match ? match[0] : '.mp4';
}
