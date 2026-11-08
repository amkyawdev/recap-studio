/**
 * SRT parsing / serialising for the subtitle timeline.
 *
 * Deliberately tolerant: real-world SRT files arrive with BOMs, CRLF line
 * endings, comma *or* dot decimal separators, and missing index numbers.
 */

export interface Cue {
  id: string;
  index: number;
  start: number; // seconds
  end: number; // seconds
  text: string;
  /** Set when the user has hand-edited the cue — auto-sync skips these. */
  locked?: boolean;
}

const TIME_RE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

/** Parse a single SRT timecode (`00:01:02,500`) into seconds. */
export function parseTimecode(value: string): number {
  const m = TIME_RE.exec(value.trim());
  if (!m) return 0;
  const [, h, mm, ss, ms] = m;
  return (
    Number(h) * 3600 +
    Number(mm) * 60 +
    Number(ss) +
    Number(ms.padEnd(3, '0')) / 1000
  );
}

/** Seconds -> SRT timecode (`00:01:02,500`). */
export function toTimecode(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const ms = Math.round((clamped % 1) * 1000);
  const s = Math.floor(clamped % 60);
  const m = Math.floor((clamped / 60) % 60);
  const h = Math.floor(clamped / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function parseSRT(raw: string): Cue[] {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) continue;

    let cursor = 0;
    let index = cues.length + 1;
    // Optional numeric index line.
    if (/^\d+$/.test(lines[0].trim())) {
      index = Number(lines[0].trim());
      cursor = 1;
    }
    const timeLine = lines[cursor];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startRaw, endRaw] = timeLine.split('-->');
    const start = parseTimecode(startRaw);
    const end = parseTimecode(endRaw);
    const body = lines.slice(cursor + 1).join('\n').trim();

    cues.push({
      id: `cue-${index}-${Math.round(start * 1000)}`,
      index,
      start,
      end: end > start ? end : start + 1.5,
      text: body,
    });
  }

  return cues;
}

export function toSRT(cues: Cue[]): string {
  return cues
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((cue, i) => `${i + 1}\n${toTimecode(cue.start)} --> ${toTimecode(cue.end)}\n${cue.text}`)
    .join('\n\n')
    .concat('\n');
}

/** Plain transcript (no timecodes) — what the TTS engine speaks. */
export function toTranscript(cues: Cue[]): string {
  return cues
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((c) => c.text.replace(/\n/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
}

export function totalDuration(cues: Cue[]): number {
  return cues.reduce((max, c) => Math.max(max, c.end), 0);
}

export function cueAt(cues: Cue[], time: number): Cue | undefined {
  return cues.find((c) => time >= c.start && time < c.end);
}

/** Clamp every cue into a strictly increasing sequence. */
export function normaliseCues(cues: Cue[]): Cue[] {
  const sorted = cues.slice().sort((a, b) => a.start - b.start);
  let cursor = 0;
  return sorted.map((cue, i) => {
    const start = Math.max(cue.start, cursor);
    const end = Math.max(cue.end, start + 0.4);
    cursor = end;
    return { ...cue, index: i + 1, start: round3(start), end: round3(end) };
  });
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Redistribute cue timings proportionally to their character weight so the
 * whole track fits `target` seconds. Cues marked `locked` keep their windows
 * and only the remaining span is shared out — that is the "auto-sync" pass.
 */
export function autoFitToDuration(cues: Cue[], target: number): Cue[] {
  if (cues.length === 0 || target <= 0) return cues;
  const weights = cues.map((c) => Math.max(6, c.text.trim().length));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  let cursor = 0;
  return cues.map((cue, i) => {
    const span = (weights[i] / totalWeight) * target;
    const start = cursor;
    const end = start + span;
    cursor = end;
    return { ...cue, index: i + 1, start: round3(start), end: round3(end) };
  });
}

/** Shift the whole track so it starts at zero. */
export function rezero(cues: Cue[]): Cue[] {
  if (cues.length === 0) return cues;
  const first = Math.min(...cues.map((c) => c.start));
  return cues.map((c) => ({ ...c, start: round3(c.start - first), end: round3(c.end - first) }));
}

/** Split a long cue into readable chunks at sentence or clause boundaries. */
export function splitCue(cue: Cue, maxChars = 84): Cue[] {
  const text = cue.text.trim();
  if (text.length <= maxChars) return [cue];

  const parts = text
    .split(/(?<=[.!?])\s+/)
    .flatMap((sentence) =>
      sentence.length <= maxChars
        ? [sentence]
        : sentence.split(/(?<=[,;:])\s+/),
    )
    .filter(Boolean);

  const totalChars = parts.reduce((a, p) => a + p.length, 0) || 1;
  const span = cue.end - cue.start;
  let cursor = cue.start;

  return parts.map((part, i) => {
    const share = (part.length / totalChars) * span;
    const start = cursor;
    const end = start + share;
    cursor = end;
    return {
      id: `${cue.id}-s${i}`,
      index: i,
      start: round3(start),
      end: round3(end),
      text: part.trim(),
      locked: cue.locked,
    };
  });
}

/** Build a sample track for first-run demo content. */
export function sampleCues(): Cue[] {
  const lines = [
    'A quiet town. A missing signal. Nothing about tonight feels ordinary.',
    'The camera holds on the empty road — three seconds too long.',
    'Then the lights cut out, and the real story begins.',
    'By dawn, everything we believed about the crash will be wrong.',
  ];
  let cursor = 0.6;
  return lines.map((text, i) => {
    const dur = Math.max(2.2, text.length / 16);
    const cue: Cue = {
      id: `sample-${i}`,
      index: i + 1,
      start: round3(cursor),
      end: round3(cursor + dur),
      text,
    };
    cursor += dur + 0.35;
    return cue;
  });
}
