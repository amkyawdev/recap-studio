'use client';

import { motion } from 'framer-motion';
import { Maximize2, Pause, Play, RectangleHorizontal, RectangleVertical, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '@/store/use-editor-store';
import { ASPECT_PRESETS } from '@/lib/ffmpeg/render-engine';
import { cueAt } from '@/lib/utils/srt-parser';
import { formatClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * Central preview stage.
 *
 * Renders the "phone screen" — a framed 9:16 or 16:9 viewport with the source
 * video, live subtitle burn-in, and the watermark overlay positioned exactly
 * where the render engine will place it. Playback drives the shared playhead so
 * the timeline and preview never disagree.
 */

export function PreviewStage() {
  const source = useEditorStore((s) => s.source);
  const cues = useEditorStore((s) => s.cues);
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const watermark = useEditorStore((s) => s.watermark);
  const subtitleStyle = useEditorStore((s) => s.subtitleStyle);
  const voice = useEditorStore((s) => s.voice);
  const playing = useEditorStore((s) => s.playing);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const playhead = useEditorStore((s) => s.playhead);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  const preset = ASPECT_PRESETS[aspect];
  const vertical = aspect === '9:16';

  const activeCue = useMemo(() => cueAt(cues, playhead), [cues, playhead]);

  // Keep the media element in step with the shared playhead/playing state.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing, setPlaying]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (Math.abs(el.currentTime - playhead) > 0.35) el.currentTime = playhead;
  }, [playhead]);

  const scrub = (value: number) => {
    setPlayhead(value);
    if (videoRef.current) videoRef.current.currentTime = value;
  };

  const totalDuration = Math.max(duration, cues.reduce((m, c) => Math.max(m, c.end), 0), 1);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Ratio switch */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-black/50 p-0.5">
          <RatioButton
            active={vertical}
            onClick={() => setAspect('9:16')}
            icon={RectangleVertical}
            label="9:16"
          />
          <RatioButton
            active={!vertical}
            onClick={() => setAspect('16:9')}
            icon={RectangleHorizontal}
            label="16:9"
          />
        </div>
        <span className="mono-num flex items-center gap-1 text-2xs text-white/40">
          <Maximize2 className="size-3" />
          {preset.width}×{preset.height}
        </span>
      </div>

      {/* Screen container */}
      <div className="flex flex-1 items-center justify-center">
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className={cn(
            'relative overflow-hidden rounded-[26px] border border-white/[0.12] bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,1),0_0_0_1px_rgba(255,255,255,0.04)]',
            vertical ? 'aspect-[9/16] h-full max-h-[560px]' : 'aspect-[16/9] w-full',
          )}
        >
          {/* Device notch */}
          {vertical && (
            <span className="absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/15" />
          )}

          {source.objectUrl ? (
            <video
              ref={videoRef}
              src={source.objectUrl}
              playsInline
              muted={!voice.audioUrl}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <PlaceholderFrame title={source.title} />
          )}

          {/* Subtitle burn-in preview */}
          {activeCue && (
            <motion.div
              key={activeCue.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute inset-x-3 z-10 flex justify-center"
              style={{ bottom: `${(subtitleStyle.marginV / preset.height) * 100}%` }}
            >
              <span
                className={cn(
                  'max-w-full rounded-md px-2 py-1 text-center leading-tight',
                  subtitleStyle.borderStyle === 3 && 'bg-black/75',
                )}
                style={{
                  color: `#${subtitleStyle.primaryColour}`,
                  fontSize: `${Math.max(11, (subtitleStyle.fontSize / preset.width) * 100 * 3.4)}px`,
                  fontWeight: subtitleStyle.bold ? 700 : 400,
                  textTransform: subtitleStyle.uppercase ? 'uppercase' : 'none',
                  WebkitTextStroke:
                    subtitleStyle.borderStyle === 1 ? `0.5px rgba(0,0,0,0.9)` : undefined,
                  textShadow:
                    subtitleStyle.borderStyle === 1
                      ? '0 1px 2px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)'
                      : undefined,
                }}
              >
                {activeCue.text}
              </span>
            </motion.div>
          )}

          {/* Watermark layer */}
          {watermark.enabled && watermark.text.trim() && (
            <span
              className={cn(
                'pointer-events-none absolute z-10 font-mono',
                watermark.position === 'top-left' && 'left-3 top-3',
                watermark.position === 'top-right' && 'right-3 top-3',
                watermark.position === 'bottom-left' && 'bottom-3 left-3',
                watermark.position === 'bottom-right' && 'bottom-3 right-3',
              )}
              style={{
                opacity: watermark.opacity,
                fontSize: `${Math.max(8, (watermark.size / preset.width) * 100 * 3.4)}px`,
                textShadow: '0 1px 2px rgba(0,0,0,0.9)',
              }}
            >
              {watermark.text}
            </span>
          )}

          {/* Scanline sheen */}
          <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 animate-scan bg-gradient-to-b from-white/[0.05] to-transparent" />
        </motion.div>
      </div>

      {/* Transport */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="range"
            min={0}
            max={Math.max(totalDuration, 0.1)}
            step={0.05}
            value={Math.min(playhead, totalDuration)}
            onChange={(e) => scrub(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="mono-num text-2xs text-white/45">
            {formatClock(playhead)} / {formatClock(totalDuration)}
          </span>

          <div className="flex items-center gap-1">
            <TransportButton icon={SkipBack} onClick={() => scrub(Math.max(0, playhead - 5))} label="Back 5s" />
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? 'Pause' : 'Play'}
              className="pill size-10 border border-white/[0.12] bg-white/[0.06] text-white hover:bg-white/[0.1] active:scale-95"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-[1px]" />}
            </button>
            <TransportButton icon={SkipForward} onClick={() => scrub(Math.min(totalDuration, playhead + 5))} label="Forward 5s" />
          </div>

          <span className="mono-num flex items-center gap-1 text-2xs text-white/45">
            <Volume2 className="size-3" />
            {voice.audioUrl ? 'narration' : 'source'}
          </span>
        </div>
      </div>
    </div>
  );
}

function RatioButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'pill h-7 gap-1 px-2.5 text-2xs',
        active ? 'bg-white/[0.1] text-white' : 'text-white/45 hover:text-white/80',
      )}
    >
      <Icon className="size-3" />
      {label}
    </button>
  );
}

function TransportButton({
  icon: Icon,
  onClick,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pill size-8 text-white/50 hover:bg-white/[0.06] hover:text-white active:scale-90"
    >
      <Icon className="size-4" />
    </button>
  );
}

function PlaceholderFrame({ title }: { title: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-ink-800 via-black to-ink-900">
      <div className="absolute inset-0 grid-lines opacity-40" />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border border-white/[0.1] bg-white/[0.03]">
          <Play className="size-5 text-white/40" />
        </span>
        <p className="max-w-[80%] text-xs text-white/45">{title}</p>
        <p className="mono-num text-2xs text-white/25">no preview source</p>
      </div>
    </div>
  );
}
