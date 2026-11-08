'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlignLeft,
  Clock3,
  Copy,
  Download,
  Film,
  Gauge,
  Lock,
  LockOpen,
  Plus,
  Scissors,
  Trash2,
  Type,
  Upload,
  Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '@/store/use-editor-store';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils/cn';
import { MAX_DURATION_SEC } from '@/lib/ffmpeg/render-engine';
import { countWords, estimateSpeechSeconds, formatClock, formatClockMs } from '@/lib/utils/format';
import { toTimecode, parseTimecode } from '@/lib/utils/srt-parser';

/**
 * SRT subtitle timeline.
 *
 * Two modes share one state machine: `list` is the precise timecode editor,
 * `flow` is the typewriter view that plays the script back at speaking pace so
 * the writer can hear the rhythm before rendering.
 */

type Mode = 'list' | 'flow';

export function SubtitleTimeline() {
  const cues = useEditorStore((s) => s.cues);
  const selectedCueId = useEditorStore((s) => s.selectedCueId);
  const selectCue = useEditorStore((s) => s.selectCue);
  const updateCue = useEditorStore((s) => s.updateCue);
  const removeCue = useEditorStore((s) => s.removeCue);
  const addCue = useEditorStore((s) => s.addCue);
  const nudgeCue = useEditorStore((s) => s.nudgeCue);
  const splitSelected = useEditorStore((s) => s.splitSelected);
  const autoSync = useEditorStore((s) => s.autoSync);
  const rezeroTimeline = useEditorStore((s) => s.rezeroTimeline);
  const loadSrt = useEditorStore((s) => s.loadSrt);
  const loadSample = useEditorStore((s) => s.loadSample);
  const exportSrt = useEditorStore((s) => s.exportSrt);

  const [mode, setMode] = useState<Mode>('list');
  const [flash, setFlash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = cues.find((c) => c.id === selectedCueId) ?? null;
  const words = useMemo(() => countWords(cues.map((c) => c.text).join(' ')), [cues]);
  const spoken = useMemo(() => estimateSpeechSeconds(cues.map((c) => c.text).join(' ')), [cues]);
  const overBudget = spoken > MAX_DURATION_SEC;

  const notify = useCallback((message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2200);
  }, []);

  const onImport = async (file: File) => {
    const text = await file.text();
    const count = loadSrt(text);
    notify(count > 0 ? `Imported ${count} cues from ${file.name}` : 'No cues found in that file.');
  };

  const onExport = () => {
    const blob = new Blob([exportSrt()], { type: 'application/x-subrip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'recap-studio.srt';
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Exported recap-studio.srt');
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(cues.map((c) => c.text).join('\n'));
    notify('Script copied to clipboard');
  };

  return (
    <GlassPanel padding="none" className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlignLeft className="size-4 text-violet-400" />
          <h2 className="text-[13px] font-semibold text-white">Subtitle Timeline</h2>
          <span className="mono-num rounded-md bg-white/[0.05] px-1.5 py-0.5 text-2xs text-white/45">
            {cues.length} cues
          </span>
        </div>
        <Segmented
          size="sm"
          className="w-auto"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'list', label: 'Timecode', icon: Clock3 },
            { value: 'flow', label: 'Typewriter', icon: Type },
          ]}
        />
      </header>

      <div className="hairline-t px-4 py-3">
        <PacingMeter words={words} spoken={spoken} overBudget={overBudget} />
      </div>

      <div className="hairline-t min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {mode === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="no-scrollbar h-full overflow-y-auto px-3 py-3"
            >
              {cues.length === 0 ? (
                <EmptyState onLoadSample={loadSample} onImport={() => fileRef.current?.click()} />
              ) : (
                <ul className="space-y-2">
                  <AnimatePresence initial={false}>
                    {cues.map((cue) => (
                      <CueRow
                        key={cue.id}
                        active={cue.id === selectedCueId}
                        onSelect={() => selectCue(cue.id)}
                        onText={(text) => updateCue(cue.id, { text })}
                        onStart={(start) => updateCue(cue.id, { start })}
                        onEnd={(end) => updateCue(cue.id, { end })}
                        onNudge={(delta) => nudgeCue(cue.id, delta)}
                        onLock={() => updateCue(cue.id, { locked: !cue.locked })}
                        onRemove={() => removeCue(cue.id)}
                        index={cue.index}
                        text={cue.text}
                        start={cue.start}
                        end={cue.end}
                        locked={Boolean(cue.locked)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="flow"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}
              className="h-full overflow-hidden"
            >
              <TypewriterFlow />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="hairline-t flex flex-wrap items-center gap-1.5 px-3 py-3">
        <Button size="sm" variant="glass" icon={Plus} onClick={() => addCue()}>
          Add cue
        </Button>
        <Button size="sm" variant="ghost" icon={Scissors} onClick={splitSelected} disabled={!selected}>
          Split
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={Wand2}
          onClick={() => {
            autoSync(MAX_DURATION_SEC);
            notify(`Auto-synced to ${MAX_DURATION_SEC / 60}:00`);
          }}
          disabled={cues.length === 0}
        >
          Auto-sync
        </Button>
        <Button size="sm" variant="ghost" icon={Gauge} onClick={rezeroTimeline} disabled={cues.length === 0}>
          Re-zero
        </Button>

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={Copy} onClick={copyAll} disabled={cues.length === 0}>
            Copy
          </Button>
          <Button size="sm" variant="ghost" icon={Upload} onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <Button size="sm" variant="outline" icon={Download} onClick={onExport} disabled={cues.length === 0}>
            SRT
          </Button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".srt,.txt,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onImport(file);
            event.target.value = '';
          }}
        />
      </footer>

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pointer-events-none absolute inset-x-0 bottom-16 mx-auto w-fit rounded-full border border-white/[0.12] bg-black/90 px-3 py-1.5 text-2xs text-white/80 backdrop-blur"
          >
            {flash}
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}

/** Word budget + estimated spoken duration against the 3-minute ceiling. */
function PacingMeter({ words, spoken, overBudget }: { words: number; spoken: number; overBudget: boolean }) {
  const ratio = Math.min(1, spoken / MAX_DURATION_SEC);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-2xs">
        <span className="flex items-center gap-1.5 text-white/45">
          <Gauge className={cn('size-3', overBudget ? 'text-signal-red' : 'text-violet-400')} />
          Pacing budget
        </span>
        <span className={cn('mono-num', overBudget ? 'text-signal-red' : 'text-white/55')}>
          {words} words · {formatClock(spoken)} / {formatClock(MAX_DURATION_SEC)}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            overBudget ? 'bg-signal-red' : 'signal-bar',
          )}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>
    </div>
  );
}

interface CueRowProps {
  index: number;
  text: string;
  start: number;
  end: number;
  locked: boolean;
  active: boolean;
  onSelect: () => void;
  onText: (text: string) => void;
  onStart: (value: number) => void;
  onEnd: (value: number) => void;
  onNudge: (delta: number) => void;
  onLock: () => void;
  onRemove: () => void;
}

function CueRow({
  index,
  text,
  start,
  end,
  locked,
  active,
  onSelect,
  onText,
  onStart,
  onEnd,
  onNudge,
  onLock,
  onRemove,
}: CueRowProps) {
  const duration = Math.max(0, end - start);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onSelect}
      className={cn(
        'group relative cursor-pointer rounded-xl border p-2.5 transition-colors',
        active
          ? 'border-violet-500/35 bg-violet-500/[0.07]'
          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]',
      )}
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="mono-num grid size-5 place-items-center rounded-md bg-white/[0.06] text-2xs text-white/50">
          {index}
        </span>

        <TimecodeField value={start} onCommit={onStart} label="start" />
        <span className="text-white/25">→</span>
        <TimecodeField value={end} onCommit={onEnd} label="end" />

        <span className="mono-num ml-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-2xs text-white/35">
          {duration.toFixed(2)}s
        </span>

        <div className="ml-auto flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNudge(-0.25);
            }}
            className="pill h-6 px-1.5 text-2xs text-white/45 hover:bg-white/[0.07] hover:text-white"
            title="Shift earlier 0.25s"
          >
            −.25
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNudge(0.25);
            }}
            className="pill h-6 px-1.5 text-2xs text-white/45 hover:bg-white/[0.07] hover:text-white"
            title="Shift later 0.25s"
          >
            +.25
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLock();
            }}
            className={cn(
              'pill size-6 hover:bg-white/[0.07]',
              locked ? 'text-gold-300' : 'text-white/40 hover:text-white',
            )}
            title={locked ? 'Unlock from auto-sync' : 'Lock against auto-sync'}
          >
            {locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="pill size-6 text-white/40 hover:bg-signal-red/15 hover:text-signal-red"
            title="Delete cue"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        onFocus={onSelect}
        rows={2}
        spellCheck
        placeholder="Subtitle text…"
        className="w-full resize-none rounded-lg border border-white/[0.06] bg-black/30 px-2.5 py-2 text-[13px] leading-relaxed text-white/85 placeholder:text-white/25 focus:border-violet-500/40 focus:outline-none"
      />
    </motion.li>
  );
}

/** Inline timecode editor that only commits on blur/Enter. */
function TimecodeField({
  value,
  onCommit,
  label,
}: {
  value: number;
  onCommit: (seconds: number) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? toTimecode(value);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseTimecode(draft);
    onCommit(Number.isFinite(parsed) ? parsed : value);
    setDraft(null);
  };

  return (
    <input
      aria-label={label}
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="mono-num w-[86px] rounded-md border border-white/[0.07] bg-black/40 px-1.5 py-1 text-2xs text-white/75 focus:border-violet-500/40 focus:outline-none"
    />
  );
}

/**
 * Typewriter playback: reveals each cue character by character at the pace the
 * TTS engine would speak it, so the writer can feel the timing.
 */
function TypewriterFlow() {
  const cues = useEditorStore((s) => s.cues);
  const [running, setRunning] = useState(true);
  const [cursor, setCursor] = useState(0);

  const full = cues.map((c) => c.text).join('\n');
  const total = full.length;

  // ~14 chars/second approximates 150 wpm narration with punctuation pauses.
  useTypewriter(running, total, setCursor, cursor);

  const shown = full.slice(0, cursor);
  const progress = total > 0 ? cursor / total : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="kicker">Live read-through</span>
        <Button size="xs" variant="ghost" onClick={() => setRunning((r) => !r)}>
          {running ? 'Pause' : 'Resume'}
        </Button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-4">
        <p className="whitespace-pre-wrap text-[15px] leading-[1.9] tracking-tight text-white/85">
          {shown}
          {running && cursor < total && <span className="animate-caret text-violet-400">▍</span>}
        </p>
      </div>

      <div className="hairline-t px-4 py-3">
        <div className="flex items-center justify-between text-2xs text-white/40">
          <span className="flex items-center gap-1.5">
            <Film className="size-3" />
            {cursor}/{total} chars
          </span>
          <span className="mono-num">{formatClockMs((progress * MAX_DURATION_SEC))}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div className="signal-bar h-full" animate={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Character reveal loop, paused when the tab is hidden. */
function useTypewriter(
  running: boolean,
  total: number,
  setCursor: React.Dispatch<React.SetStateAction<number>>,
  cursor: number,
) {
  const frame = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    const step = (time: number) => {
      if (last.current === 0) last.current = time;
      const delta = time - last.current;
      if (delta > 48) {
        last.current = time;
        setCursor((c) => (c >= total ? 0 : c + 1));
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      last.current = 0;
    };
  }, [running, total, setCursor]);

  // Keep the internal clock in sync when the cursor is reset externally.
  useEffect(() => {
    if (cursor === 0) last.current = 0;
  }, [cursor]);
}

function EmptyState({ onLoadSample, onImport }: { onLoadSample: () => void; onImport: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <AlignLeft className="size-5 text-white/40" />
      </span>
      <div>
        <p className="text-[13px] font-medium text-white/80">No timeline yet</p>
        <p className="mt-1 text-2xs leading-relaxed text-white/40">
          Import an .srt, transcribe a source in Upload, or start from a sample track.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="primary" icon={Upload} onClick={onImport}>
          Import SRT
        </Button>
        <Button size="sm" variant="glass" onClick={onLoadSample}>
          Load sample
        </Button>
      </div>
    </div>
  );
}
