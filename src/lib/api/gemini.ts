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
