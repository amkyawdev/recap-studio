import { ApiError, type ClientRouter } from './client-router';

/**
 * Google Gemini — script generation and the Gemini TTS voice lane.
 * Docs: https://ai.google.dev/gemini-api/docs
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiTextModel {
  id: string;
  label: string;
  blurb: string;
}

export const GEMINI_TEXT_MODELS: GeminiTextModel[] = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', blurb: 'Fastest recap scripting' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', blurb: 'Deeper narrative reasoning' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', blurb: 'Legacy, cheap' },
];

export interface GeminiVoice {
  id: string;
  label: string;
  character: string;
}

/** Prebuilt Gemini TTS voices (the subset that reads narration well). */
export const GEMINI_VOICES: GeminiVoice[] = [
  { id: 'Kore', label: 'Kore', character: 'Firm, neutral narrator' },
  { id: 'Puck', label: 'Puck', character: 'Upbeat, energetic' },
  { id: 'Charon', label: 'Charon', character: 'Deep documentary' },
  { id: 'Fenrir', label: 'Fenrir', character: 'Gravelly tension' },
  { id: 'Aoede', label: 'Aoede', character: 'Bright, breezy' },
  { id: 'Enceladus', label: 'Enceladus', character: 'Intimate, close-mic' },
];

export interface RecapScriptRequest {
  transcript: string;
  targetSeconds: number;
  tone: 'cinematic' | 'documentary' | 'energetic' | 'analytical';
  language?: string;
  model?: string;
}

export interface RecapScriptResult {
  script: string;
  hook: string;
  model: string;
}

const TONE_BRIEF: Record<RecapScriptRequest['tone'], string> = {
  cinematic:
    'Write like a film trailer. Short, punchy sentences. Present tense. Build dread and release it.',
  documentary:
    'Write like a prestige documentary narrator. Measured, factual, quietly authoritative.',
  energetic:
    'Write like a top YouTube recap channel. High tempo, second person, relentless forward motion.',
  analytical:
    'Write like a critical essay read aloud. Precise, comparative, attentive to theme and craft.',
};

/** Ask Gemini to compress a transcript into a timed narration script. */
export async function generateRecapScript(
  router: ClientRouter,
  req: RecapScriptRequest,
): Promise<RecapScriptResult> {
  const key = router.keyFor('gemini');
  const model = req.model ?? 'gemini-2.5-flash';
  const words = Math.round((req.targetSeconds / 60) * 150);

  const prompt = [
    'You are the head writer for a video recap studio.',
    TONE_BRIEF[req.tone],
    `Target length: ${words} words (${Math.round(req.targetSeconds)} seconds at 150 wpm).`,
    'Return JSON only, matching: {"hook": string, "script": string}.',
    'The hook is one sentence (max 18 words) that opens the video.',
    'The script is the full narration, plain prose, no stage directions, no markdown.',
    req.language ? `Write in ${req.language}.` : '',
    '',
    'Transcript:',
    req.transcript.slice(0, 120_000),
  ]
    .filter(Boolean)
    .join('\n');

  const response = await router.request('gemini', `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
    }),
  });

  const payload = (await response.json()) as GeminiResponse;
  const text = extractText(payload);
  if (!text) throw new ApiError('Gemini returned an empty script.', undefined, 'gemini');

  try {
    const parsed = JSON.parse(text) as { hook?: string; script?: string };
    return {
      hook: parsed.hook?.trim() || firstSentence(parsed.script ?? ''),
      script: parsed.script?.trim() || text.trim(),
      model,
    };
  } catch {
    // Model ignored the JSON contract — degrade gracefully rather than fail.
    return { hook: firstSentence(text), script: text.trim(), model };
  }
}

export interface GeminiTtsRequest {
  text: string;
  voice?: string;
  model?: string;
}

/* ------------------------------------------------------------------ */
/* Subtitle translation                                                */
/* ------------------------------------------------------------------ */

export interface LanguageOption {
  /** BCP-47-ish code, used as the translation-map key. */
  code: string;
  /** English label shown in the picker. */
  label: string;
  /** Endonym, shown as a subtitle so users can find their own language. */
  native: string;
}

/**
 * Target languages offered by the subtitle translator.
 *
 * The list is deliberately short and hand-picked: these are the languages the
 * studio's audience actually asks for, and a short list keeps the picker usable
 * on a phone. Gemini accepts anything, so widening this array is the only change
 * needed to support more.
 */
export const LANGUAGES: LanguageOption[] = [
  { code: 'my', label: 'Burmese', native: 'မြန်မာ' },
  { code: 'th', label: 'Thai', native: 'ไทย' },
  { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt' },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'zh', label: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'ja', label: 'Japanese', native: '日本語' },
  { code: 'ko', label: 'Korean', native: '한국어' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'pt', label: 'Portuguese', native: 'Português' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
];

export function findLanguage(code: string): LanguageOption | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export interface TranslateRequest {
  /** One string per subtitle cue, in timeline order. */
  lines: string[];
  /** Target language label, e.g. "Burmese (Myanmar)". */
  target: string;
  /** Optional synopsis so pronouns and names stay consistent across batches. */
  context?: string;
  model?: string;
  /** Called after each batch with (completed, total) cue counts. */
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
}

export interface TranslateResult {
  /** Translated lines, same length and order as the input. */
  lines: string[];
  model: string;
  /** Batches that needed the per-line retry because the model broke the contract. */
  retriedBatches: number;
  /** Individual lines that still failed and kept their source text. */
  keptOriginal: number;
}

const TRANSLATE_BATCH_SIZE = 40;

/**
 * Translate a cue list into another language.
 *
 * Contract: the model receives a JSON array of strings and must return a JSON
 * array of the *same length*. Anything else is treated as a bad batch. On a bad
 * batch the lines are split and retried once individually, and any line that
 * still fails keeps its original text — a translation run never loses timing,
 * and never silently drops a cue.
 */
export async function translateCues(
  router: ClientRouter,
  req: TranslateRequest,
): Promise<TranslateResult> {
  const key = router.keyFor('gemini');
  const model = req.model ?? 'gemini-2.5-flash';
  const total = req.lines.length;
  const out: string[] = new Array(total);
  let retriedBatches = 0;
  let keptOriginal = 0;
  let completed = 0;

  for (let start = 0; start < total; start += TRANSLATE_BATCH_SIZE) {
    if (req.signal?.aborted) throw new ApiError('Translation cancelled.', undefined, 'gemini');
    const batch = req.lines.slice(start, start + TRANSLATE_BATCH_SIZE);
    let translated: string[] | null = null;

    try {
      translated = await translateBatch(router, key, model, batch, req.target, req.context);
    } catch {
      translated = null;
    }

    if (!translated || translated.length !== batch.length) {
      // Retry the batch line by line — smaller requests are far more reliable.
      retriedBatches += 1;
      const salvaged = await Promise.all(
        batch.map(async (line) => {
          if (!line.trim()) return line;
          try {
            const one = await translateBatch(router, key, model, [line], req.target, req.context);
            return one?.[0] ?? line;
          } catch {
            return line;
          }
        }),
      );
      translated = salvaged;
    }

    for (let i = 0; i < batch.length; i += 1) {
      const value = translated[i] ?? batch[i];
      // A line is "kept original" when it came back identical to the source
      // *and* the source had words to translate.
      if (value === batch[i] && batch[i].trim().length > 0) keptOriginal += 1;
      out[start + i] = value;
    }
    completed += batch.length;
    req.onProgress?.(completed, total);
  }

  return { lines: out, model, retriedBatches, keptOriginal };
}

async function translateBatch(
  router: ClientRouter,
  key: string,
  model: string,
  batch: string[],
  target: string,
  context?: string,
): Promise<string[] | null> {
  const prompt = [
    `You are a professional subtitle translator for film and television.`,
    `Translate the JSON array of subtitle lines into ${target}.`,
    '',
    'Rules:',
    '- Return JSON only: {"lines": ["...", "..."]} — the same number of entries, in the same order.',
    '- Translate meaning, not word for word. Subtitles must read naturally aloud.',
    '- Keep each line about the same length as the original so it fits the same screen time.',
    '- Preserve proper nouns, sound cues and formatting. Do not add or remove lines.',
    '- Never merge two lines into one or split one line into two.',
    '- If a line is untranslatable (a name, a sound effect), repeat it unchanged.',
    context ? `Context for consistency: ${context}` : '',
    '',
    'Lines:',
    JSON.stringify(batch),
  ]
    .filter(Boolean)
    .join('\n');

  const response = await router.request(
    'gemini',
    `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
      }),
    },
    120_000,
  );

  const payload = (await response.json()) as GeminiResponse;
  const text = extractText(payload);
  if (!text) return null;

  const parsed = safeJson(text) as { lines?: unknown } | string[] | null;
  if (Array.isArray(parsed)) return parsed.map(String);
  if (parsed && Array.isArray((parsed as { lines?: unknown }).lines)) {
    return ((parsed as { lines: unknown[] }).lines).map(String);
  }
  return null;
}

/** Parse model output that may be wrapped in a markdown fence. */
function safeJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Last resort: grab the outermost array.
    const match = /\[[\s\S]*\]/.exec(cleaned);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export interface TtsAudio {
  data: ArrayBuffer;
  mimeType: string;
  extension: 'wav' | 'mp3';
}

/** Synthesise narration with the Gemini TTS model (returns 24 kHz PCM in a WAV). */
export async function generateGeminiSpeech(
  router: ClientRouter,
  req: GeminiTtsRequest,
): Promise<TtsAudio> {
  const key = router.keyFor('gemini');
  const model = req.model ?? 'gemini-2.5-flash-preview-tts';

  const response = await router.request('gemini', `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: req.text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: req.voice ?? 'Kore' } },
        },
      },
    }),
  });

  const payload = (await response.json()) as GeminiResponse;
  const inline = payload.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline?.data) throw new ApiError('Gemini TTS returned no audio payload.', undefined, 'gemini');

  const mimeType = inline.mimeType ?? 'audio/L16;rate=24000';
  const pcm = base64ToBytes(inline.data);
  const sampleRate = Number(/rate=(\d+)/.exec(mimeType)?.[1] ?? 24_000);
  const wav = pcmToWav(pcm, sampleRate, 1);
  return { data: wav, mimeType: 'audio/wav', extension: 'wav' };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }>;
    };
  }>;
}

function extractText(payload: GeminiResponse): string {
  return (
    payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ?? ''
  );
}

function firstSentence(text: string): string {
  const match = /^[^.!?]+[.!?]/.exec(text.trim());
  return (match?.[0] ?? text.trim().slice(0, 120)).trim();
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Wrap raw little-endian PCM in a minimal RIFF/WAVE container. */
export function pcmToWav(pcm: Uint8Array, sampleRate: number, channels: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = pcm.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(pcm);
  return buffer;
}
