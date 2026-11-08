/** Formatting helpers shared by the timeline, exporter and status pills. */

/** Seconds -> `mm:ss` (or `h:mm:ss` past an hour). */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Seconds -> `mm:ss,mmm` (SRT timecode body). */
export function formatClockMs(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const ms = Math.floor((seconds % 1) * 1000);
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

/** Bytes -> human readable (`1.4 GB`). */
export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

/** `1234567` -> `1,234,567`. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Clamp a word count into the pacing band the render engine enforces.
 * Recaps read at roughly 150 wpm; a 3-minute ceiling is ~450 spoken words.
 */
export const PACING = {
  wordsPerMinute: 150,
  maxDurationSec: 180,
  get maxWords() {
    return Math.round((this.wordsPerMinute * this.maxDurationSec) / 60);
  },
} as const;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Rough spoken-length estimate used to warn before the 3-minute ceiling. */
export function estimateSpeechSeconds(text: string, wpm = PACING.wordsPerMinute): number {
  return (countWords(text) / wpm) * 60;
}

export function truncate(text: string, max = 60): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Deterministic pseudo-random in [0,1) — keeps SSR and client waveforms identical. */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
