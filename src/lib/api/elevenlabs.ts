import { ApiError, type ClientRouter } from './client-router';
import type { TtsAudio } from './gemini';

/**
 * ElevenLabs — high-fidelity narration.
 * Docs: https://elevenlabs.io/docs/api-reference
 */

const BASE = 'https://api.elevenlabs.io/v1';

export interface ElevenVoice {
  id: string;
  label: string;
  character: string;
  /** Rough default stability, tuned per voice family. */
  stability: number;
}

/** Public preset voices that suit recap narration. */
export const ELEVEN_VOICES: ElevenVoice[] = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', label: 'George', character: 'Warm documentary', stability: 0.45 },
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel', character: 'Calm, clear', stability: 0.5 },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah', character: 'Soft newsreader', stability: 0.55 },
  { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel', character: 'Authoritative anchor', stability: 0.4 },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', label: 'Liam', character: 'Young, energetic', stability: 0.35 },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam', character: 'Deep, cinematic', stability: 0.4 },
];

export const ELEVEN_MODELS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2', blurb: 'Best quality, 29 languages' },
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', blurb: 'Fast, low latency' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5', blurb: 'Fastest, cheapest' },
];

export interface ElevenRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  /** `mp3_44100_128` | `wav_44100` | `pcm_24000` … */
  outputFormat?: string;
}

/** Stream narration from ElevenLabs as an MP3 (or WAV) blob. */
export async function generateElevenSpeech(router: ClientRouter, req: ElevenRequest): Promise<TtsAudio> {
  const key = router.keyFor('elevenlabs');
  const voiceId = req.voiceId ?? ELEVEN_VOICES[0].id;
  const outputFormat = req.outputFormat ?? 'mp3_44100_128';
  const extension: 'wav' | 'mp3' = outputFormat.startsWith('wav') ? 'wav' : 'mp3';

  const response = await router.request(
    'elevenlabs',
    `${BASE}/text-to-speech/${voiceId}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: req.text,
        model_id: req.modelId ?? 'eleven_multilingual_v2',
        voice_settings: {
          stability: req.stability ?? 0.45,
          similarity_boost: req.similarityBoost ?? 0.75,
          style: req.style ?? 0.15,
          use_speaker_boost: true,
          speed: req.speed ?? 1,
        },
      }),
    },
    120_000,
  );

  const data = await response.arrayBuffer();
  if (data.byteLength === 0) throw new ApiError('ElevenLabs returned an empty audio stream.', undefined, 'elevenlabs');
  return { data, mimeType: extension === 'wav' ? 'audio/wav' : 'audio/mpeg', extension };
}

export interface VoiceLibraryEntry {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
}

/** Pull the account's own voice library (falls back to the presets on failure). */
export async function listElevenVoices(router: ClientRouter): Promise<ElevenVoice[]> {
  if (!router.has('elevenlabs')) return ELEVEN_VOICES;
  try {
    const response = await router.request('elevenlabs', `${BASE}/voices`, {
      method: 'GET',
      headers: { 'xi-api-key': router.keyFor('elevenlabs') },
    });
    const payload = (await response.json()) as { voices?: VoiceLibraryEntry[] };
    const voices = payload.voices ?? [];
    if (voices.length === 0) return ELEVEN_VOICES;
    return voices.map((v) => ({
      id: v.voice_id,
      label: v.name,
      character: v.category ?? v.labels?.accent ?? 'Custom voice',
      stability: 0.45,
    }));
  } catch {
    return ELEVEN_VOICES;
  }
}

export interface SubscriptionInfo {
  tier: string;
  characterCount: number;
  characterLimit: number;
  resetUnix: number;
  percentUsed: number;
}

/** Character-quota health shown on the provider status pill. */
export async function getSubscription(router: ClientRouter): Promise<SubscriptionInfo | null> {
  if (!router.has('elevenlabs')) return null;
  try {
    const response = await router.request('elevenlabs', `${BASE}/user/subscription`, {
      method: 'GET',
      headers: { 'xi-api-key': router.keyFor('elevenlabs') },
    });
    const payload = (await response.json()) as {
      tier?: string;
      character_count?: number;
      character_limit?: number;
      next_character_count_reset_unix?: number;
    };
    const limit = payload.character_limit ?? 0;
    const used = payload.character_count ?? 0;
    return {
      tier: payload.tier ?? 'free',
      characterCount: used,
      characterLimit: limit,
      resetUnix: payload.next_character_count_reset_unix ?? 0,
      percentUsed: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
    };
  } catch {
    return null;
  }
}
