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
  setSource: (source) => set({ source }),
  clearSource: () => set({ source: EMPTY_SOURCE }),

  cues: [],
  selectedCueId: null,
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
  exportSrt: () => toSRT(get().cues),

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

  duration: () => Math.max(totalDuration(get().cues), get().source.durationSec),
  overLimit: () => totalDuration(get().cues) > MAX_DURATION_SEC + 0.5,
  wordCount: () => countWords(get().cues.map((c) => c.text).join(' ')),
  spokenSeconds: () => estimateSpeechSeconds(get().cues.map((c) => c.text).join(' ')),

  buildPlan: () => {
    const { cues, aspect, subtitleStyle, watermark, music } = get();
    const durationSec = Math.min(Math.max(totalDuration(cues), 1), MAX_DURATION_SEC);
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
      cues: [],
      selectedCueId: null,
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

/** Words the pacing model allows inside the render ceiling. */
export const WORD_BUDGET = PACING.maxWords;
