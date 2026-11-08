'use client';

import { create } from 'zustand';
import type { Cue } from '@/lib/utils/srt-parser';
import {
  autoFitToDuration,
  normaliseCues,
  parseSRT,
  rezero,
  sampleCues,
  splitCue,
  toSRT,
  totalDuration,
} from '@/lib/utils/srt-parser';
import { PACING, countWords, estimateSpeechSeconds } from '@/lib/utils/format';
import {
  DEFAULT_PLAN,
  MAX_DURATION_SEC,
  type AspectRatio,
  type RenderPlan,
  type RenderProgress,
  type SubtitleStyle,
  type WatermarkSettings,
} from '@/lib/ffmpeg/render-engine';

/**
 * Editor session state. One store drives the preview canvas, the timeline,
 * the TTS panel, the overlay panel and the exporter, so the mobile layout can
 * swap panels without unmounting shared state.
 */

export type EditorPanel = 'subtitle' | 'voice' | 'overlay' | 'render';
export type TtsProvider = 'elevenlabs' | 'gemini';
export type SourceKind = 'youtube' | 'file' | 'none';

/** Inspector tabs on the right rail — mirrors CapCut's context panels. */
export type InspectorTab = 'clip' | 'text' | 'audio' | 'effects';

/** Which horizontal lane a block lives on in the multitrack timeline. */
export type TrackId = 'video' | 'subtitle' | 'audio' | 'overlay';

/**
 * A segment of the source media placed on the video track.
 *
 * `inSec`/`outSec` index into the *source* file; `startSec` is where the clip
 * begins on the *sequence*. Trimming changes the in/out pair, moving changes
 * `startSec`, and splitting produces two clips that share the source.
 */
export interface Clip {
  id: string;
  /** Source key — reserved for multi-source projects; single source today. */
  sourceRef: string;
  inSec: number;
  outSec: number;
  startSec: number;
  label: string;
  /** Playback rate; 1 is normal speed. */
  speed: number;
  /** Clip-local gain, 0..2. */
  volume: number;
  /** Video opacity, 0..1. */
  opacity: number;
  muted: boolean;
}

/** Source-seconds -> sequence-seconds for a clip of the given duration. */
export function clipDuration(clip: Clip): number {
  return Math.max(0, (clip.outSec - clip.inSec) / Math.max(0.1, clip.speed));
}

export function clipEnd(clip: Clip): number {
  return clip.startSec + clipDuration(clip);
}

/** The clip covering a sequence time, if any. */
export function clipAt(clips: Clip[], sequenceSec: number): Clip | undefined {
  return clips.find((c) => sequenceSec >= c.startSec && sequenceSec < clipEnd(c));
}

/**
 * Map a sequence time onto the source timeline.
 * Returns null when the playhead sits in a gap between clips.
 */
export function sequenceToSource(clips: Clip[], sequenceSec: number): number | null {
  const clip = clipAt(clips, sequenceSec);
  if (!clip) return null;
  return clip.inSec + (sequenceSec - clip.startSec) * clip.speed;
}

/** Where a given source time lands on the sequence (first matching clip). */
export function sourceToSequence(clips: Clip[], sourceSec: number): number | null {
  const clip = clips.find((c) => sourceSec >= c.inSec && sourceSec <= c.outSec);
  if (!clip) return null;
  return clip.startSec + (sourceSec - clip.inSec) / Math.max(0.1, clip.speed);
}

/**
 * Overlay a translation onto a cue list.
 *
 * Pure so components can derive it inside a `useMemo` — a store selector that
 * built a new array on every call would trip React's snapshot check.
 * Cues with no translated line keep the original text, so a partial run still
 * renders complete subtitles rather than gaps.
 */
export function localizeCues(
  cues: Cue[],
  translations: Record<string, Record<string, string>>,
  language: string | null,
): Cue[] {
  if (!language) return cues;
  const map = translations[language];
  if (!map) return cues;
  let changed = false;
  const next = cues.map((cue) => {
    const text = map[cue.id];
    if (!text) return cue;
    changed = true;
    return { ...cue, text };
  });
  return changed ? next : cues;
}

export interface SourceVideo {
  kind: SourceKind;
  /** YouTube id, or the original file name. */
  ref: string;
  title: string;
  durationSec: number;
  /** Raw bytes for local uploads — kept out of persisted state. */
  bytes?: Uint8Array;
  /** Object URL for the preview player. */
  objectUrl?: string;
  thumbnail?: string;
}

export interface VoiceSettings {
  provider: TtsProvider;
  voiceId: string;
  modelId: string;
  stability: number;
  speed: number;
  /** Latest synthesised audio. */
  audioUrl?: string;
  audioBytes?: Uint8Array;
  audioName?: string;
  audioExtension: 'mp3' | 'wav';
  status: 'idle' | 'generating' | 'ready' | 'error';
  error?: string;
}

export interface MusicSettings {
  name?: string;
  bytes?: Uint8Array;
  objectUrl?: string;
  volume: number;
}

export interface EditorState {
  // ---- source -------------------------------------------------------
  source: SourceVideo;
  setSource: (source: SourceVideo) => void;
  clearSource: () => void;

  // ---- timeline -----------------------------------------------------
  cues: Cue[];
  selectedCueId: string | null;

  /**
   * Translations, keyed by language code then cue id.
   *
   * Timing lives only on `cues`; a translation swaps *text* for a given cue.
   * That keeps one source of truth for the timeline and means a translation
   * survives retiming, trimming and reordering automatically.
   */
  translations: Record<string, Record<string, string>>;
  /** `null` renders the original language. */
  activeLanguage: string | null;
  translating: boolean;
  translateProgress: { done: number; total: number } | null;
  translateError: string | null;
  setActiveLanguage: (code: string | null) => void;
  applyTranslation: (code: string, byCueId: Record<string, string>) => void;
  clearTranslation: (code: string) => void;
  setTranslating: (patch: { translating?: boolean; progress?: { done: number; total: number } | null; error?: string | null }) => void;
  /** The cue list as it should be rendered/exported right now. */
  activeCues: () => Cue[];

  setCues: (cues: Cue[]) => void;
  loadSrt: (raw: string) => number;
  loadSample: () => void;
  addCue: (at?: number) => void;
  updateCue: (id: string, patch: Partial<Cue>) => void;
  nudgeCue: (id: string, deltaSec: number) => void;
  removeCue: (id: string) => void;
  selectCue: (id: string | null) => void;
  splitSelected: () => void;
  autoSync: (targetSec?: number) => void;
  rezeroTimeline: () => void;
  exportSrt: () => string;

  // ---- multitrack timeline ------------------------------------------
  clips: Clip[];
  selectedClipId: string | null;
  /** Pixels per second on the timeline ruler. */
  timelineZoom: number;
  /** Magnetic snapping to block edges and the playhead. */
  snapping: boolean;
  setTimelineZoom: (zoom: number) => void;
  toggleSnapping: () => void;
  addClipFromSource: () => void;
  updateClip: (id: string, patch: Partial<Clip>) => void;
  moveClip: (id: string, startSec: number) => void;
  trimClip: (id: string, edge: 'in' | 'out', deltaSec: number) => void;
  splitClipAtPlayhead: () => void;
  duplicateClip: (id: string) => void;
  removeClip: (id: string) => void;
  selectClip: (id: string | null) => void;
  /** Snap a candidate time to nearby edges when `snapping` is on. */
  snapTime: (value: number, ignoreId?: string) => number;

  // ---- inspector ----------------------------------------------------
  inspectorTab: InspectorTab;
  setInspectorTab: (tab: InspectorTab) => void;

  // ---- playback -----------------------------------------------------
  playhead: number;
  playing: boolean;
  setPlayhead: (value: number) => void;
  setPlaying: (value: boolean) => void;

  // ---- presentation -------------------------------------------------
  aspect: AspectRatio;
  setAspect: (aspect: AspectRatio) => void;
  subtitleStyle: SubtitleStyle;
  updateSubtitleStyle: (patch: Partial<SubtitleStyle>) => void;
  watermark: WatermarkSettings;
  updateWatermark: (patch: Partial<WatermarkSettings>) => void;

  // ---- voice --------------------------------------------------------
  voice: VoiceSettings;
  setVoice: (patch: Partial<VoiceSettings>) => void;
  music: MusicSettings;
  setMusic: (patch: Partial<MusicSettings>) => void;

  // ---- render -------------------------------------------------------
  panel: EditorPanel;
  setPanel: (panel: EditorPanel) => void;
  render: { progress: RenderProgress; running: boolean; error?: string; outputUrl?: string; outputName?: string; outputSize?: number };
  setRender: (patch: Partial<EditorState['render']>) => void;

  // ---- derived ------------------------------------------------------
  duration: () => number;
  /** Length of the video track alone — what the renderer encodes. */
  sequenceDuration: () => number;
  overLimit: () => boolean;
  wordCount: () => number;
  spokenSeconds: () => number;
  buildPlan: () => RenderPlan;
  reset: () => void;
}

const EMPTY_SOURCE: SourceVideo = { kind: 'none', ref: '', title: 'No source loaded', durationSec: 0 };

const EMPTY_VOICE: VoiceSettings = {
  provider: 'elevenlabs',
  voiceId: '',
  modelId: 'eleven_multilingual_v2',
  stability: 0.45,
  speed: 1,
  audioExtension: 'mp3',
  status: 'idle',
};

const IDLE_PROGRESS: RenderProgress = {
  stage: 'idle',
  ratio: 0,
  message: 'Idle',
  elapsedSec: 0,
  etaSec: null,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  source: EMPTY_SOURCE,
  setSource: (source) => {
    // Landing a new source seeds the video track with one full-length clip so
    // the timeline is never empty after an import.
    const clip: Clip = {
      id: `clip-${Date.now()}`,
      sourceRef: source.ref || source.title,
      inSec: 0,
      outSec: source.durationSec > 0 ? source.durationSec : 30,
      startSec: 0,
      label: source.title,
      speed: 1,
      volume: 1,
      opacity: 1,
      muted: false,
    };
    set({ source, clips: [clip], selectedClipId: clip.id });
  },
  clearSource: () => set({ source: EMPTY_SOURCE, clips: [], selectedClipId: null }),

  cues: [],
  selectedCueId: null,
  translations: {},
  activeLanguage: null,
  translating: false,
  translateProgress: null,
  translateError: null,

  activeCues: () => {
    const { cues, translations, activeLanguage } = get();
    return localizeCues(cues, translations, activeLanguage);
  },

  setActiveLanguage: (activeLanguage) => set({ activeLanguage }),

  applyTranslation: (code, byCueId) =>
    set((state) => ({
      translations: { ...state.translations, [code]: { ...(state.translations[code] ?? {}), ...byCueId } },
      activeLanguage: code,
      translating: false,
      translateProgress: null,
      translateError: null,
    })),

  clearTranslation: (code) =>
    set((state) => {
      const next = { ...state.translations };
      delete next[code];
      return { translations: next, activeLanguage: state.activeLanguage === code ? null : state.activeLanguage };
    }),

  setTranslating: (patch) =>
    set((state) => ({
      translating: patch.translating ?? state.translating,
      translateProgress: patch.progress === undefined ? state.translateProgress : patch.progress,
      translateError: patch.error === undefined ? state.translateError : patch.error,
    })),

  setCues: (cues) => set({ cues: normaliseCues(cues) }),
  loadSrt: (raw) => {
    const cues = parseSRT(raw);
    set({ cues: normaliseCues(cues), selectedCueId: cues[0]?.id ?? null });
    return cues.length;
  },
  loadSample: () => {
    const cues = sampleCues();
    set({ cues, selectedCueId: cues[0]?.id ?? null });
  },
  addCue: (at) => {
    const { cues, playhead } = get();
    const start = at ?? playhead;
    const last = cues[cues.length - 1];
    const begin = last ? Math.max(start, last.end) : start;
    const cue: Cue = {
      id: `cue-${Date.now()}`,
      index: cues.length + 1,
      start: round3(begin),
      end: round3(begin + 2.4),
      text: 'New subtitle line',
    };
    set({ cues: normaliseCues([...cues, cue]), selectedCueId: cue.id });
  },
  updateCue: (id, patch) =>
    set((state) => ({
      cues: normaliseCues(state.cues.map((c) => (c.id === id ? { ...c, ...patch } : c))),
    })),
  nudgeCue: (id, deltaSec) =>
    set((state) => ({
      cues: normaliseCues(
        state.cues.map((c) =>
          c.id === id
            ? { ...c, start: round3(Math.max(0, c.start + deltaSec)), end: round3(Math.max(0.4, c.end + deltaSec)) }
            : c,
        ),
      ),
    })),
  removeCue: (id) =>
    set((state) => ({
      cues: normaliseCues(state.cues.filter((c) => c.id !== id)),
      selectedCueId: state.selectedCueId === id ? null : state.selectedCueId,
    })),
  selectCue: (id) => set({ selectedCueId: id }),
  splitSelected: () => {
    const { cues, selectedCueId } = get();
    const index = cues.findIndex((c) => c.id === selectedCueId);
    if (index < 0) return;
    const pieces = splitCue(cues[index]);
    if (pieces.length < 2) return;
    const next = [...cues.slice(0, index), ...pieces, ...cues.slice(index + 1)];
    set({ cues: normaliseCues(next), selectedCueId: pieces[0].id });
  },
  autoSync: (targetSec) => {
    const { cues } = get();
    if (cues.length === 0) return;
    const target = Math.min(targetSec ?? MAX_DURATION_SEC, MAX_DURATION_SEC);
    set({ cues: autoFitToDuration(cues, target) });
  },
  rezeroTimeline: () => set((state) => ({ cues: rezero(state.cues) })),
  exportSrt: () => toSRT(get().activeCues()),

  clips: [],
  selectedClipId: null,
  timelineZoom: 26,
  snapping: true,
  setTimelineZoom: (zoom) => set({ timelineZoom: Math.min(160, Math.max(6, zoom)) }),
  toggleSnapping: () => set((state) => ({ snapping: !state.snapping })),

  addClipFromSource: () => {
    const { source, clips } = get();
    const duration = source.durationSec > 0 ? source.durationSec : 30;
    const tail = clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
    const clip: Clip = {
      id: `clip-${Date.now()}`,
      sourceRef: source.ref || source.title,
      inSec: 0,
      outSec: duration,
      startSec: round3(tail),
      label: source.title,
      speed: 1,
      volume: 1,
      opacity: 1,
      muted: false,
    };
    set({ clips: [...clips, clip], selectedClipId: clip.id });
  },

  updateClip: (id, patch) =>
    set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? clampClip({ ...c, ...patch }) : c)),
    })),

  moveClip: (id, startSec) =>
    set((state) => ({
      clips: state.clips.map((c) =>
        c.id === id ? { ...c, startSec: round3(Math.max(0, startSec)) } : c,
      ),
    })),

  trimClip: (id, edge, deltaSec) =>
    set((state) => ({
      clips: state.clips.map((c) => {
        if (c.id !== id) return c;
        const sourceMax = get().source.durationSec || c.outSec;
        if (edge === 'in') {
          // Dragging the left edge also shifts the clip's sequence position so
          // the visible frames stay put — the CapCut/Alight Motion behaviour.
          const nextIn = Math.min(Math.max(0, c.inSec + deltaSec), c.outSec - 0.2);
          const shift = (nextIn - c.inSec) / Math.max(0.1, c.speed);
          return { ...c, inSec: round3(nextIn), startSec: round3(Math.max(0, c.startSec + shift)) };
        }
        const nextOut = Math.max(c.inSec + 0.2, Math.min(sourceMax, c.outSec + deltaSec));
        return { ...c, outSec: round3(nextOut) };
      }),
    })),

  splitClipAtPlayhead: () => {
    const { clips, playhead, selectedClipId } = get();
    // Prefer the selected clip; otherwise split whatever the playhead is over.
    const target =
      clips.find((c) => c.id === selectedClipId && playhead > c.startSec && playhead < clipEnd(c)) ??
      clips.find((c) => playhead > c.startSec && playhead < clipEnd(c));
    if (!target) return;

    const offsetSec = (playhead - target.startSec) * target.speed;
    const cutSource = round3(target.inSec + offsetSec);
    if (cutSource <= target.inSec + 0.2 || cutSource >= target.outSec - 0.2) return;

    const left: Clip = { ...target, outSec: cutSource };
    const right: Clip = {
      ...target,
      id: `clip-${Date.now()}`,
      inSec: cutSource,
      startSec: round3(playhead),
    };
    const index = clips.findIndex((c) => c.id === target.id);
    const next = [...clips.slice(0, index), left, right, ...clips.slice(index + 1)];
    set({ clips: next, selectedClipId: right.id });
  },

  duplicateClip: (id) => {
    const { clips } = get();
    const original = clips.find((c) => c.id === id);
    if (!original) return;
    const copy: Clip = {
      ...original,
      id: `clip-${Date.now()}`,
      startSec: round3(clipEnd(original)),
    };
    set({ clips: [...clips, copy], selectedClipId: copy.id });
  },

  removeClip: (id) =>
    set((state) => ({
      clips: state.clips.filter((c) => c.id !== id),
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId,
    })),

  selectClip: (id) => set({ selectedClipId: id }),

  snapTime: (value, ignoreId) => {
    const { snapping, clips, cues, playhead } = get();
    if (!snapping) return value;
    const threshold = 8 / get().timelineZoom; // ~8px of travel
    const targets = [
      playhead,
      0,
      ...clips.filter((c) => c.id !== ignoreId).flatMap((c) => [c.startSec, clipEnd(c)]),
      ...cues.map((c) => c.start),
    ];
    let best = value;
    let bestDelta = threshold;
    for (const target of targets) {
      const delta = Math.abs(target - value);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = target;
      }
    }
    return round3(best);
  },

  inspectorTab: 'clip',
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),

  playhead: 0,
  playing: false,
  setPlayhead: (value) => set({ playhead: Math.max(0, value) }),
  setPlaying: (value) => set({ playing: value }),

  aspect: DEFAULT_PLAN.aspect,
  setAspect: (aspect) => set({ aspect }),
  subtitleStyle: DEFAULT_PLAN.subtitleStyle,
  updateSubtitleStyle: (patch) => set((state) => ({ subtitleStyle: { ...state.subtitleStyle, ...patch } })),
  watermark: DEFAULT_PLAN.watermark,
  updateWatermark: (patch) => set((state) => ({ watermark: { ...state.watermark, ...patch } })),

  voice: EMPTY_VOICE,
  setVoice: (patch) => set((state) => ({ voice: { ...state.voice, ...patch } })),
  music: { volume: DEFAULT_PLAN.musicVolume },
  setMusic: (patch) => set((state) => ({ music: { ...state.music, ...patch } })),

  panel: 'subtitle',
  setPanel: (panel) => set({ panel }),
  render: { progress: IDLE_PROGRESS, running: false },
  setRender: (patch) => set((state) => ({ render: { ...state.render, ...patch } })),

  duration: () => {
    const { clips, cues, source } = get();
    const sequence = clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
    return Math.max(sequence, totalDuration(cues), source.durationSec);
  },
  /** Length of the video track alone — what the renderer actually encodes. */
  sequenceDuration: () => get().clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0),
  overLimit: () => {
    const { clips, cues } = get();
    const sequence = clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
    return Math.max(sequence, totalDuration(cues)) > MAX_DURATION_SEC + 0.5;
  },
  wordCount: () => countWords(get().cues.map((c) => c.text).join(' ')),
  spokenSeconds: () => estimateSpeechSeconds(get().cues.map((c) => c.text).join(' ')),

  buildPlan: () => {
    const { aspect, subtitleStyle, watermark, music, clips } = get();
    // Burn the active language's cues, not the source-language list.
    const cues = get().activeCues();
    const sequence = clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
    const durationSec = Math.min(Math.max(sequence, totalDuration(cues), 1), MAX_DURATION_SEC);
    return {
      ...DEFAULT_PLAN,
      aspect,
      durationSec,
      cues,
      subtitleStyle,
      watermark,
      musicVolume: music.volume,
      voiceVolume: 1,
      fadeOutSec: Math.min(DEFAULT_PLAN.fadeOutSec, Math.max(0, durationSec - 0.5)),
    };
  },

  reset: () =>
    set({
      source: EMPTY_SOURCE,
      clips: [],
      selectedClipId: null,
      inspectorTab: 'clip',
      timelineZoom: 26,
      cues: [],
      selectedCueId: null,
      translations: {},
      activeLanguage: null,
      translating: false,
      translateProgress: null,
      translateError: null,
      playhead: 0,
      playing: false,
      voice: EMPTY_VOICE,
      music: { volume: DEFAULT_PLAN.musicVolume },
      render: { progress: IDLE_PROGRESS, running: false },
    }),
}));

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** Keep clip fields inside sane bounds after an edit. */
function clampClip(clip: Clip): Clip {
  const speed = Math.min(4, Math.max(0.25, clip.speed));
  return {
    ...clip,
    speed,
    inSec: round3(Math.max(0, Math.min(clip.inSec, clip.outSec - 0.2))),
    outSec: round3(Math.max(clip.inSec + 0.2, clip.outSec)),
    startSec: round3(Math.max(0, clip.startSec)),
    volume: Math.min(2, Math.max(0, clip.volume)),
    opacity: Math.min(1, Math.max(0, clip.opacity)),
  };
}

/** Words the pacing model allows inside the render ceiling. */
export const WORD_BUDGET = PACING.maxWords;
