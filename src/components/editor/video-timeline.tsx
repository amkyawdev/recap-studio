'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AudioLines,
  Captions,
  Film,
  Layers2,
  Lock,
  Magnet,
  Music4,
  Plus,
  Scissors,
  SquareSplitHorizontal,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore, clipEnd, clipDuration, type Clip } from '@/store/use-editor-store';
import { cn } from '@/lib/utils/cn';
import { formatClock } from '@/lib/utils/format';

/**
 * Multitrack editing timeline — the CapCut / Alight Motion surface.
 *
 * Lanes: video, subtitles, audio, overlays. The ruler and every block share one
 * pixel-per-second scale (`timelineZoom`), so a block's left edge and the
 * playhead line up by construction rather than by parallel arithmetic.
 *
 * Interactions
 *  - Drag anywhere on the ruler or an empty lane to scrub the playhead.
 *  - Drag a clip body to move it; drag its edge handles to trim in/out.
 *  - Everything snaps to neighbouring edges and the playhead while `snapping`.
 */

const LANE_HEIGHT = 56;
const RULER_HEIGHT = 26;

type LaneId = 'video' | 'subtitle' | 'audio' | 'overlay';

const LANES: {
  id: LaneId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  fill: string;
}[] = [
  { id: 'video', label: 'Video', icon: Film, tone: 'text-violet-300', fill: 'from-violet-600/80 to-violet-800/70' },
  { id: 'subtitle', label: 'Subtitles', icon: Captions, tone: 'text-gold-300', fill: 'from-gold-500/70 to-gold-600/60' },
  { id: 'audio', label: 'Audio', icon: Music4, tone: 'text-signal-green', fill: 'from-signal-green/60 to-signal-green/30' },
  { id: 'overlay', label: 'Overlay', icon: Layers2, tone: 'text-sky-300', fill: 'from-sky-500/60 to-sky-600/40' },
];

export function VideoTimeline() {
  const clips = useEditorStore((s) => s.clips);
  const cues = useEditorStore((s) => s.cues);
  const music = useEditorStore((s) => s.music);
  const voice = useEditorStore((s) => s.voice);
  const watermark = useEditorStore((s) => s.watermark);
  const zoom = useEditorStore((s) => s.timelineZoom);
  const setZoom = useEditorStore((s) => s.setTimelineZoom);
  const snapping = useEditorStore((s) => s.snapping);
  const toggleSnapping = useEditorStore((s) => s.toggleSnapping);
  const playhead = useEditorStore((s) => s.playhead);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectClip = useEditorStore((s) => s.selectClip);
  const moveClip = useEditorStore((s) => s.moveClip);
  const trimClip = useEditorStore((s) => s.trimClip);
  const splitClipAtPlayhead = useEditorStore((s) => s.splitClipAtPlayhead);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const addClipFromSource = useEditorStore((s) => s.addClipFromSource);
  const source = useEditorStore((s) => s.source);
  const selectCue = useEditorStore((s) => s.selectCue);
  const removeCue = useEditorStore((s) => s.removeCue);
  const updateCue = useEditorStore((s) => s.updateCue);
  const setInspectorTab = useEditorStore((s) => s.setInspectorTab);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [laneLocks, setLaneLocks] = useState<Record<LaneId, boolean>>({
    video: false,
    subtitle: false,
    audio: false,
    overlay: false,
  });
  const [laneMutes, setLaneMutes] = useState<Record<LaneId, boolean>>({
    video: false,
    subtitle: false,
    audio: false,
    overlay: false,
  });

  const sequenceLength = useMemo(
    () => clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0),
    [clips],
  );

  // The scrollable content is always at least a little wider than the content
  // so there is somewhere to drag past the last block.
  const contentWidth = Math.max(sequenceLength + 12, 40) * zoom;

  /** Convert a client X coordinate into a sequence time. */
  const timeAtClientX = useCallback(
    (clientX: number) => {
      const el = scrollRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft;
      return Math.max(0, x / zoom);
    },
    [zoom],
  );

  const scrub = useCallback(
    (clientX: number) => setPlayhead(timeAtClientX(clientX)),
    [setPlayhead, timeAtClientX],
  );

  // --- ruler scrubbing ---------------------------------------------------
  const onRulerPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub(event.clientX);
  };
  const onRulerPointerMove = (event: React.PointerEvent) => {
    if (event.buttons !== 1) return;
    scrub(event.clientX);
  };

  // --- keyboard shortcuts ------------------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        useEditorStore.getState().setPlaying(!useEditorStore.getState().playing);
        return;
      }
      if (event.key === 's' || event.key === 'S') {
        event.preventDefault();
        splitClipAtPlayhead();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedClipId) {
          event.preventDefault();
          removeClip(selectedClipId);
        }
        return;
      }
      if (event.key === 'd' || event.key === 'D') {
        if (selectedClipId) {
          event.preventDefault();
          duplicateClip(selectedClipId);
        }
        return;
      }
      // Frame stepping — a tenth of a second keeps it usable without a
      // dedicated frame rate in the model.
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPlayhead(Math.max(0, playhead - (event.shiftKey ? 1 : 0.1)));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPlayhead(playhead + (event.shiftKey ? 1 : 0.1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duplicateClip, playhead, removeClip, selectedClipId, setPlayhead, splitClipAtPlayhead]);

  const ticks = useMemo(() => buildTicks(sequenceLength + 12, zoom), [sequenceLength, zoom]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-800/70 backdrop-blur-xl">
      <TimelineToolbar
        zoom={zoom}
        onZoom={setZoom}
        snapping={snapping}
        onToggleSnapping={toggleSnapping}
        onSplit={splitClipAtPlayhead}
        onDuplicate={() => selectedClipId && duplicateClip(selectedClipId)}
        onDelete={() => selectedClipId && removeClip(selectedClipId)}
        onAdd={() => {
          addClipFromSource();
          setInspectorTab('clip');
        }}
        hasSelection={Boolean(selectedClipId)}
        hasSource={source.kind !== 'none'}
      />

      <div className="flex min-h-0 flex-1">
        {/* Track headers */}
        <div className="w-[92px] shrink-0 border-r border-white/[0.07] bg-black/30 sm:w-[104px]">
          <div style={{ height: RULER_HEIGHT }} className="border-b border-white/[0.07]" />
          {LANES.map((lane) => (
            <div
              key={lane.id}
              style={{ height: LANE_HEIGHT }}
              className="flex flex-col justify-center gap-1 border-b border-white/[0.05] px-2"
            >
              <span className="flex items-center gap-1.5 truncate">
                <lane.icon className={cn('size-3 shrink-0', lane.tone)} />
                <span className="truncate text-2xs font-medium text-white/70">{lane.label}</span>
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLaneMutes((m) => ({ ...m, [lane.id]: !m[lane.id] }))}
                  className="pill size-5 text-white/35 hover:bg-white/[0.06] hover:text-white/80"
                  title={laneMutes[lane.id] ? 'Unmute lane' : 'Mute lane'}
                >
                  {laneMutes[lane.id] ? <VolumeX className="size-2.5" /> : <Volume2 className="size-2.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setLaneLocks((l) => ({ ...l, [lane.id]: !l[lane.id] }))}
                  className={cn(
                    'pill size-5 hover:bg-white/[0.06]',
                    laneLocks[lane.id] ? 'text-gold-300' : 'text-white/35 hover:text-white/80',
                  )}
                  title={laneLocks[lane.id] ? 'Unlock lane' : 'Lock lane'}
                >
                  {laneLocks[lane.id] ? <Lock className="size-2.5" /> : <Unlock className="size-2.5" />}
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable lanes */}
        <div ref={scrollRef} className="no-scrollbar relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative" style={{ width: contentWidth, minWidth: '100%' }}>
            {/* Ruler */}
            <div
              onPointerDown={onRulerPointerDown}
              onPointerMove={onRulerPointerMove}
              className="sticky top-0 z-20 cursor-ew-resize select-none border-b border-white/[0.07] bg-ink-900/90 backdrop-blur"
              style={{ height: RULER_HEIGHT, width: contentWidth }}
            >
              {ticks.map((tick) => (
                <div
                  key={tick.sec}
                  className="absolute top-0 flex h-full flex-col justify-end"
                  style={{ left: tick.sec * zoom }}
                >
                  <span
                    className={cn(
                      'mono-num pl-1 text-[9px] leading-none',
                      tick.major ? 'text-white/45' : 'text-white/25',
                    )}
                  >
                    {tick.label}
                  </span>
                  <span className={cn('mt-0.5 w-px', tick.major ? 'h-2 bg-white/25' : 'h-1 bg-white/12')} />
                </div>
              ))}
            </div>

            {/* Lanes */}
            {LANES.map((lane) => (
              <div
                key={lane.id}
                className="relative border-b border-white/[0.05]"
                style={{ height: LANE_HEIGHT, width: contentWidth }}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget) {
                    selectClip(null);
                    scrub(event.clientX);
                  }
                }}
              >
                <div className="pointer-events-none absolute inset-0 grid-lines opacity-[0.18]" />

                {lane.id === 'video' &&
                  clips.map((clip) => (
                    <VideoBlock
                      key={clip.id}
                      clip={clip}
                      zoom={zoom}
                      selected={clip.id === selectedClipId}
                      locked={laneLocks.video}
                      onSelect={() => {
                        selectClip(clip.id);
                        setInspectorTab('clip');
                      }}
                      onMove={(start) => moveClip(clip.id, start)}
                      onTrim={(edge, delta) => trimClip(clip.id, edge, delta)}
                      onScrub={scrub}
                      timeAtClientX={timeAtClientX}
                    />
                  ))}

                {lane.id === 'subtitle' &&
                  cues.map((cue) => (
                    <SubtitleBlock
                      key={cue.id}
                      cue={cue}
                      zoom={zoom}
                      locked={laneLocks.subtitle}
                      onSelect={() => {
                        selectCue(cue.id);
                        setInspectorTab('text');
                      }}
                      onMove={(start) => updateCue(cue.id, { start, end: start + (cue.end - cue.start) })}
                      onResize={(start, end) => updateCue(cue.id, { start, end })}
                      onRemove={() => removeCue(cue.id)}
                      timeAtClientX={timeAtClientX}
                    />
                  ))}

                {lane.id === 'audio' && (
                  <>
                    {voice.audioUrl && (
                      <GhostBlock
                        zoom={zoom}
                        start={0}
                        end={Math.max(sequenceLength, 4)}
                        label={voice.audioName ?? 'Narration'}
                        className="from-signal-green/60 to-signal-green/25 border-signal-green/40"
                        icon={AudioLines}
                      />
                    )}
                    {music.objectUrl && (
                      <GhostBlock
                        zoom={zoom}
                        start={0}
                        end={Math.max(sequenceLength, 4)}
                        label={music.name ?? 'Music bed'}
                        className="from-sky-500/50 to-sky-700/30 border-sky-400/40"
                        icon={Music4}
                        dimmed
                      />
                    )}
                    {!voice.audioUrl && !music.objectUrl && (
                      <LaneHint text="Narration and music beds appear here" />
                    )}
                  </>
                )}

                {lane.id === 'overlay' &&
                  (watermark.enabled && watermark.text.trim() ? (
                    <GhostBlock
                      zoom={zoom}
                      start={0}
                      end={Math.max(sequenceLength, 4)}
                      label={watermark.text}
                      className="from-gold-400/50 to-gold-600/30 border-gold-400/40"
                      icon={Layers2}
                      dimmed
                    />
                  ) : (
                    <LaneHint text="Watermark layer is off" />
                  ))}
              </div>
            ))}

            {/* Playhead */}
            <Playhead zoom={zoom} playhead={playhead} height={RULER_HEIGHT + LANE_HEIGHT * LANES.length} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

function TimelineToolbar({
  zoom,
  onZoom,
  snapping,
  onToggleSnapping,
  onSplit,
  onDuplicate,
  onDelete,
  onAdd,
  hasSelection,
  hasSource,
}: {
  zoom: number;
  onZoom: (z: number) => void;
  snapping: boolean;
  onToggleSnapping: () => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAdd: () => void;
  hasSelection: boolean;
  hasSource: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.07] bg-black/30 px-2.5 py-2">
      <button
        type="button"
        onClick={onAdd}
        disabled={!hasSource}
        className="pill h-7 gap-1.5 border border-white/[0.12] bg-white/[0.05] px-2.5 text-2xs text-white/80 hover:bg-white/[0.09] disabled:opacity-40"
        title="Append a clip from the source"
      >
        <Plus className="size-3" />
        Add clip
      </button>

      <span className="mx-0.5 h-5 w-px bg-white/10" />

      <ToolButton icon={SquareSplitHorizontal} label="Split at playhead (S)" onClick={onSplit} />
      <ToolButton icon={Scissors} label="Duplicate (D)" onClick={onDuplicate} disabled={!hasSelection} />
      <ToolButton
        icon={Trash2}
        label="Delete (Del)"
        onClick={onDelete}
        disabled={!hasSelection}
        danger
      />

      <span className="mx-0.5 h-5 w-px bg-white/10" />

      <button
        type="button"
        onClick={onToggleSnapping}
        className={cn(
          'pill h-7 gap-1.5 border px-2.5 text-2xs',
          snapping
            ? 'border-violet-500/35 bg-violet-500/[0.12] text-violet-200'
            : 'border-white/[0.1] text-white/45 hover:text-white/80',
        )}
        title="Magnetic snapping"
      >
        <Magnet className="size-3" />
        Snap
      </button>

      <div className="ml-auto flex items-center gap-1">
        <span className="mono-num hidden text-2xs text-white/35 sm:block">
          {formatClock(useEditorStore.getState().playhead)}
        </span>
        <span className="mx-0.5 hidden h-5 w-px bg-white/10 sm:block" />
        <ToolButton icon={ZoomOut} label="Zoom out" onClick={() => onZoom(zoom / 1.4)} />
        <input
          type="range"
          min={6}
          max={160}
          step={1}
          value={zoom}
          onChange={(e) => onZoom(Number(e.target.value))}
          className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/[0.1] sm:w-28 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400"
          aria-label="Timeline zoom"
        />
        <ToolButton icon={ZoomIn} label="Zoom in" onClick={() => onZoom(zoom * 1.4)} />
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'pill size-7 border border-white/[0.08] text-white/55 hover:bg-white/[0.07] hover:text-white active:scale-90',
        'disabled:pointer-events-none disabled:opacity-30',
        danger && 'hover:border-signal-red/30 hover:bg-signal-red/[0.12] hover:text-signal-red',
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Video clip block                                                    */
/* ------------------------------------------------------------------ */

function VideoBlock({
  clip,
  zoom,
  selected,
  locked,
  onSelect,
  onMove,
  onTrim,
  onScrub,
  timeAtClientX,
}: {
  clip: Clip;
  zoom: number;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onMove: (startSec: number) => void;
  onTrim: (edge: 'in' | 'out', deltaSec: number) => void;
  onScrub: (clientX: number) => void;
  timeAtClientX: (clientX: number) => number;
}) {
  const duration = clipDuration(clip);
  const width = Math.max(14, duration * zoom);
  const left = clip.startSec * zoom;

  const dragState = useRef<{
    mode: 'move' | 'in' | 'out' | null;
    originX: number;
    originStart: number;
    lastSourceSec: number;
  }>({ mode: null, originX: 0, originStart: 0, lastSourceSec: 0 });

  const store = useEditorStore.getState;

  const onPointerDown = (mode: 'move' | 'in' | 'out') => (event: React.PointerEvent) => {
    event.stopPropagation();
    if (locked) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    onSelect();
    dragState.current = {
      mode,
      originX: event.clientX,
      originStart: clip.startSec,
      lastSourceSec: timeAtClientX(event.clientX),
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag.mode) return;
    event.stopPropagation();

    const deltaPx = event.clientX - drag.originX;
    const deltaSec = deltaPx / zoom;

    if (drag.mode === 'move') {
      const raw = Math.max(0, drag.originStart + deltaSec);
      onMove(store().snapTime(raw, clip.id));
      return;
    }

    // Trim: apply the *incremental* delta since the last move so repeated
    // calls stay idempotent (the store clamps each time).
    const currentSource = timeAtClientX(event.clientX);
    const step = currentSource - drag.lastSourceSec;
    if (Math.abs(step) < 1 / zoom) return;
    drag.lastSourceSec = currentSource;
    onTrim(drag.mode, step);
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!dragState.current.mode) return;
    dragState.current.mode = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  return (
    <motion.div
      layout={false}
      onPointerDown={onPointerDown('move')}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={cn(
        'group absolute top-1.5 z-10 flex select-none overflow-hidden rounded-lg border bg-gradient-to-b text-left',
        'from-violet-600/80 to-violet-800/70',
        selected
          ? 'border-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_8px_24px_-8px_rgba(139,92,246,0.9)]'
          : 'border-violet-400/30 hover:border-violet-300/60',
        locked ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing',
      )}
      style={{ left, width, height: LANE_HEIGHT - 12 }}
    >
      {/* Filmstrip perforations — reads as "video" at a glance. */}
      <span className="pointer-events-none absolute inset-x-0 top-0 flex h-1.5 justify-between px-1">
        {Array.from({ length: Math.max(1, Math.floor(width / 14)) }).slice(0, 40).map((_, i) => (
          <span key={i} className="h-full w-1 rounded-sm bg-white/20" />
        ))}
      </span>

      <span className="flex min-w-0 flex-col justify-center gap-0.5 px-2 pt-1.5">
        <span className="truncate text-2xs font-medium text-white">{clip.label || 'Clip'}</span>
        <span className="mono-num truncate text-[9px] text-white/60">
          {formatClock(clip.inSec)}–{formatClock(clip.outSec)} · {duration.toFixed(1)}s
          {clip.speed !== 1 && ` · ${clip.speed}×`}
        </span>
      </span>

      {clip.muted && (
        <VolumeX className="absolute bottom-1 right-1.5 size-3 text-white/70" />
      )}

      {!locked && (
        <>
          <TrimHandle side="left" onPointerDown={onPointerDown('in')} onPointerMove={onPointerMove} onPointerUp={endDrag} />
          <TrimHandle side="right" onPointerDown={onPointerDown('out')} onPointerMove={onPointerMove} onPointerUp={endDrag} />
        </>
      )}
    </motion.div>
  );
}

function TrimHandle({
  side,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  side: 'left' | 'right';
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  return (
    <span
      role="slider"
      aria-label={side === 'left' ? 'Trim in' : 'Trim out'}
      aria-valuenow={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={cn(
        'absolute inset-y-0 z-20 flex w-3 cursor-ew-resize items-center justify-center bg-white/20 opacity-0 transition-opacity group-hover:opacity-100',
        side === 'left' ? 'left-0 rounded-l-lg' : 'right-0 rounded-r-lg',
      )}
    >
      <span className="h-4 w-0.5 rounded-full bg-white/90" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Subtitle block                                                      */
/* ------------------------------------------------------------------ */

function SubtitleBlock({
  cue,
  zoom,
  locked,
  onSelect,
  onMove,
  onResize,
  onRemove,
  timeAtClientX,
}: {
  cue: { id: string; start: number; end: number; text: string };
  zoom: number;
  locked: boolean;
  onSelect: () => void;
  onMove: (startSec: number) => void;
  onResize: (start: number, end: number) => void;
  onRemove: () => void;
  timeAtClientX: (clientX: number) => number;
}) {
  const width = Math.max(12, (cue.end - cue.start) * zoom);
  const drag = useRef<{ mode: 'move' | 'left' | 'right' | null; originX: number; start: number; end: number }>({
    mode: null,
    originX: 0,
    start: 0,
    end: 0,
  });

  const begin = (mode: 'move' | 'left' | 'right') => (event: React.PointerEvent) => {
    event.stopPropagation();
    if (locked) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    onSelect();
    drag.current = { mode, originX: event.clientX, start: cue.start, end: cue.end };
  };

  const move = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d.mode) return;
    event.stopPropagation();
    const delta = (event.clientX - d.originX) / zoom;
    if (d.mode === 'move') {
      const start = Math.max(0, d.start + delta);
      onMove(start);
    } else if (d.mode === 'left') {
      onResize(Math.max(0, Math.min(d.start + delta, d.end - 0.2)), d.end);
    } else {
      onResize(d.start, Math.max(d.start + 0.2, d.end + delta));
    }
  };

  const end = (event: React.PointerEvent) => {
    drag.current.mode = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  };

  return (
    <motion.div
      layout={false}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      title={`${cue.text}\n(double-click to delete)`}
      className={cn(
        'absolute top-2 z-10 flex select-none items-center overflow-hidden rounded-md border bg-gradient-to-b px-1.5',
        'from-gold-500/75 to-gold-600/55 border-gold-300/40 hover:border-gold-200/70',
        locked ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing',
      )}
      style={{ left: cue.start * zoom, width, height: LANE_HEIGHT - 16 }}
    >
      {!locked && (
        <span
          onPointerDown={begin('left')}
          onPointerMove={move}
          onPointerUp={end}
          className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-white/30 opacity-0 hover:opacity-100"
        />
      )}
      <span className="truncate text-[10px] font-medium leading-tight text-black/85">{cue.text}</span>
      {!locked && (
        <span
          onPointerDown={begin('right')}
          onPointerMove={move}
          onPointerUp={end}
          className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-white/30 opacity-0 hover:opacity-100"
        />
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Non-interactive lane blocks                                         */
/* ------------------------------------------------------------------ */

function GhostBlock({
  zoom,
  start,
  end,
  label,
  className,
  icon: Icon,
  dimmed,
}: {
  zoom: number;
  start: number;
  end: number;
  label: string;
  className: string;
  icon: React.ComponentType<{ className?: string }>;
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn(
        'absolute top-2 flex select-none items-center gap-1.5 overflow-hidden rounded-md border bg-gradient-to-b px-2',
        className,
        dimmed && 'opacity-80',
      )}
      style={{ left: start * zoom, width: Math.max(14, (end - start) * zoom), height: LANE_HEIGHT - 16 }}
    >
      <Icon className="size-3 shrink-0 text-white/80" />
      <span className="truncate text-[10px] font-medium text-white/85">{label}</span>
      <span className="ml-auto flex h-4 items-end gap-[2px]">
        {[0.4, 0.75, 0.5, 0.95, 0.6, 0.8, 0.45].map((h, i) => (
          <span key={i} className="w-0.5 rounded-full bg-white/50" style={{ height: `${h * 100}%` }} />
        ))}
      </span>
    </div>
  );
}

function LaneHint({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center px-3 text-2xs italic text-white/20">
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Playhead                                                            */
/* ------------------------------------------------------------------ */

function Playhead({ zoom, playhead, height }: { zoom: number; playhead: number; height: number }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-30 w-px bg-white"
      style={{ left: playhead * zoom, height }}
    >
      <span className="absolute -left-[7px] top-0 grid h-3.5 w-3.5 place-items-center rounded-sm bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]">
        <span className="h-1.5 w-px bg-black/50" />
      </span>
      <span className="absolute inset-y-0 -left-px w-0.5 bg-gradient-to-b from-white/80 to-white/20" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

interface Tick {
  sec: number;
  major: boolean;
  label: string;
}

/** Pick a tick interval that keeps labels ~64px apart at the current zoom. */
function buildTicks(totalSec: number, zoom: number): Tick[] {
  const targetPx = 64;
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const interval = candidates.find((c) => c * zoom >= targetPx) ?? candidates[candidates.length - 1];

  const ticks: Tick[] = [];
  const count = Math.min(600, Math.ceil(totalSec / interval) + 1);
  for (let i = 0; i < count; i += 1) {
    const sec = i * interval;
    ticks.push({
      sec,
      major: i % 2 === 0,
      label: interval < 1 ? `${sec.toFixed(1)}s` : formatClock(sec),
    });
  }
  return ticks;
}

/** Small standalone transport used above the timeline in the mobile layout. */
export function TimelineTransport() {
  const playing = useEditorStore((s) => s.playing);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const playhead = useEditorStore((s) => s.playhead);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const duration = useEditorStore((s) => s.sequenceDuration());

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPlaying(!playing)}
        className="pill size-8 border border-white/[0.12] bg-white/[0.06] text-white"
      >
        {playing ? <VolumeX className="size-3.5" /> : <Film className="size-3.5" />}
      </button>
      <span className="mono-num text-2xs text-white/45">
        {formatClock(playhead)} / {formatClock(duration)}
      </span>
      <input
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={0.05}
        value={Math.min(playhead, duration)}
        onChange={(e) => setPlayhead(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.1] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
      />
    </div>
  );
}
