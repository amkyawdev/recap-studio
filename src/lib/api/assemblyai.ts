import { ApiError, type ClientRouter } from './client-router';
import type { Cue } from '@/lib/utils/srt-parser';
import { toTimecode } from '@/lib/utils/srt-parser';

/**
 * AssemblyAI — transcription with word-level timestamps.
 * Docs: https://www.assemblyai.com/docs/api-reference
 *
 * The browser flow is: upload bytes -> poll the transcript -> convert the
 * word stream into SRT cues. Polling lives here so the UI stays declarative.
 */

const BASE = 'https://api.assemblyai.com/v2';

export interface TranscriptWord {
  text: string;
  start: number; // ms
  end: number; // ms
  confidence: number;
}

export type TranscriptStatus = 'queued' | 'processing' | 'completed' | 'error';

export interface TranscriptResult {
  id: string;
  status: TranscriptStatus;
  text?: string;
  words?: TranscriptWord[];
  error?: string;
  audioDurationSec?: number;
}

export interface SubmitOptions {
  /** URL to a publicly reachable audio/video file, or omit to upload bytes. */
  audioUrl?: string;
  bytes?: Blob;
  languageCode?: string;
  speakerLabels?: boolean;
  punctuate?: boolean;
  autoChapters?: boolean;
}

/** Upload raw bytes and receive a hosted URL AssemblyAI can ingest. */
export async function uploadAudio(router: ClientRouter, bytes: Blob): Promise<string> {
  const key = router.keyFor('assemblyai');
  const response = await router.request('assemblyai', `${BASE}/upload`, {
    method: 'POST',
    headers: { authorization: key, 'content-type': 'application/octet-stream' },
    body: bytes,
  });
  const payload = (await response.json()) as { upload_url?: string };
  if (!payload.upload_url) throw new ApiError('AssemblyAI upload did not return a URL.', undefined, 'assemblyai');
  return payload.upload_url;
}

export async function submitTranscript(router: ClientRouter, options: SubmitOptions): Promise<string> {
  const key = router.keyFor('assemblyai');
  const audioUrl = options.audioUrl ?? (options.bytes ? await uploadAudio(router, options.bytes) : undefined);
  if (!audioUrl) throw new ApiError('Provide either an audio URL or a file to upload.', undefined, 'assemblyai');

  const response = await router.request('assemblyai', `${BASE}/transcript`, {
    method: 'POST',
    headers: { authorization: key, 'content-type': 'application/json' },
    body: JSON.stringify({
      audio_url: audioUrl,
      punctuate: options.punctuate ?? true,
      speaker_labels: options.speakerLabels ?? false,
      auto_chapters: options.autoChapters ?? false,
      language_code: options.languageCode,
    }),
  });
  const payload = (await response.json()) as { id?: string };
  if (!payload.id) throw new ApiError('AssemblyAI did not return a transcript id.', undefined, 'assemblyai');
  return payload.id;
}

export async function getTranscript(router: ClientRouter, id: string): Promise<TranscriptResult> {
  const key = router.keyFor('assemblyai');
  const response = await router.request('assemblyai', `${BASE}/transcript/${id}`, {
    method: 'GET',
    headers: { authorization: key },
  });
  const payload = (await response.json()) as {
    id: string;
    status: TranscriptStatus;
    text?: string;
    error?: string;
    words?: TranscriptWord[];
    audio_duration?: number;
  };
  return {
    id: payload.id,
    status: payload.status,
    text: payload.text,
    error: payload.error,
    words: payload.words,
    audioDurationSec: payload.audio_duration ?? undefined,
  };
}

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onProgress?: (result: TranscriptResult, elapsedMs: number) => void;
}

/** Poll until the transcript completes, errors, or the timeout elapses. */
export async function waitForTranscript(
  router: ClientRouter,
  id: string,
  options: PollOptions = {},
): Promise<TranscriptResult> {
  const interval = options.intervalMs ?? 2500;
  const timeout = options.timeoutMs ?? 15 * 60_000;
  const started = Date.now();

  while (Date.now() - started < timeout) {
    if (options.signal?.aborted) throw new ApiError('Transcription cancelled.', undefined, 'assemblyai');
    const result = await getTranscript(router, id);
    options.onProgress?.(result, Date.now() - started);
    if (result.status === 'completed') return result;
    if (result.status === 'error') {
      throw new ApiError(result.error ?? 'AssemblyAI reported a transcription error.', undefined, 'assemblyai');
    }
    await sleep(interval, options.signal);
  }
  throw new ApiError('Transcription timed out after 15 minutes.', 408, 'assemblyai');
}

export interface TranscribeOptions extends SubmitOptions {
  onProgress?: (result: TranscriptResult, elapsedMs: number) => void;
  signal?: AbortSignal;
}

/** One-call convenience: submit and wait. */
export async function transcribe(router: ClientRouter, options: TranscribeOptions): Promise<TranscriptResult> {
  const id = await submitTranscript(router, options);
  return waitForTranscript(router, id, {
    onProgress: options.onProgress,
    signal: options.signal,
  });
}

/**
 * Convert a word stream into cues, breaking on sentence-ending punctuation and
 * on gaps longer than `gapMs` so subtitles breathe with the speech.
 */
export function wordsToCues(words: TranscriptWord[], options: { gapMs?: number; maxChars?: number } = {}): Cue[] {
  const gapMs = options.gapMs ?? 620;
  const maxChars = options.maxChars ?? 84;
  const cues: Cue[] = [];
  let bucket: TranscriptWord[] = [];

  const flush = () => {
    if (bucket.length === 0) return;
    const text = bucket.map((w) => w.text).join(' ').trim();
    const start = bucket[0].start / 1000;
    const end = bucket[bucket.length - 1].end / 1000;
    cues.push({
      id: `asr-${cues.length}-${Math.round(start * 1000)}`,
      index: cues.length + 1,
      start,
      end: Math.max(end, start + 0.4),
      text,
    });
    bucket = [];
  };

  for (const word of words) {
    const previous = bucket[bucket.length - 1];
    const gap = previous ? word.start - previous.end : 0;
    const wouldOverflow = bucket.reduce((n, w) => n + w.text.length + 1, 0) + word.text.length > maxChars;

    if (previous && (gap > gapMs || wouldOverflow)) flush();
    bucket.push(word);
    if (/[.!?]$/.test(word.text)) flush();
  }
  flush();
  return cues;
}

export function cuesToSrt(cues: Cue[]): string {
  return cues
    .map((cue, i) => `${i + 1}\n${toTimecode(cue.start)} --> ${toTimecode(cue.end)}\n${cue.text}`)
    .join('\n\n')
    .concat('\n');
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new ApiError('Transcription cancelled.', undefined, 'assemblyai'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
