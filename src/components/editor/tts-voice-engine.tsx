'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AudioLines,
  Check,
  Download,
  Gauge,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Waves,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { StatusPill } from '@/components/ui/status-pill';
import { useEditorStore, type TtsProvider } from '@/store/use-editor-store';
import { useApiKeysStore } from '@/store/use-api-keys-store';
import { generateElevenSpeech, ELEVEN_VOICES, ELEVEN_MODELS } from '@/lib/api/elevenlabs';
import { generateGeminiSpeech, GEMINI_VOICES, GEMINI_TEXT_MODELS } from '@/lib/api/gemini';
import { toTranscript } from '@/lib/utils/srt-parser';
import { formatClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { seededRandom } from '@/lib/utils/format';

/**
 * Voice Generator & Stream Panel.
 *
 * Multi-provider TTS with a live waveform. The waveform is driven by the real
 * AudioContext analyser once audio exists, and by a deterministic pseudo-random
 * envelope while idle so the panel never looks dead.
 */

export function TtsVoiceEngine() {
  const cues = useEditorStore((s) => s.cues);
  const voice = useEditorStore((s) => s.voice);
  const setVoice = useEditorStore((s) => s.setVoice);
  const keys = useApiKeysStore((s) => s.keys);
  const getRouter = useApiKeysStore((s) => s.getRouter);

  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const transcript = useMemo(() => toTranscript(cues), [cues]);
  const voices = voice.provider === 'elevenlabs' ? ELEVEN_VOICES : GEMINI_VOICES;
  const models = ELEVEN_MODELS;
  const keyPresent = Boolean(keys[voice.provider]);

  useEffect(() => {
    // Default the voice selection to the first option of the active provider.
    if (!voice.voiceId || !voices.some((v) => v.id === voice.voiceId)) {
      setVoice({ voiceId: voices[0].id, modelId: models[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.provider]);

  const generate = useCallback(async () => {
    setError(null);
    if (!keyPresent) {
      setError(`Add your ${voice.provider === 'elevenlabs' ? 'ElevenLabs' : 'Gemini'} key in API Settings.`);
      return;
    }
    if (!transcript.trim()) {
      setError('The timeline is empty — nothing to narrate.');
      return;
    }

    setVoice({ status: 'generating', error: undefined });
    try {
      const router = getRouter();
      const audio =
        voice.provider === 'elevenlabs'
          ? await generateElevenSpeech(router, {
              text: transcript,
              voiceId: voice.voiceId,
              modelId: voice.modelId,
              stability: voice.stability,
              speed: voice.speed,
            })
          : await generateGeminiSpeech(router, {
              text: transcript,
              voice: voice.voiceId,
              model: 'gemini-2.5-flash-preview-tts',
            });

      const bytes = new Uint8Array(audio.data);
      const blob = new Blob([bytes], { type: audio.mimeType });
      const url = URL.createObjectURL(blob);
      if (voice.audioUrl) URL.revokeObjectURL(voice.audioUrl);

      setVoice({
        status: 'ready',
        audioUrl: url,
        audioBytes: bytes,
        audioName: `narration.${audio.extension}`,
        audioExtension: audio.extension,
      });
    } catch (err) {
      setVoice({ status: 'error' });
      setError(err instanceof Error ? err.message : 'Narration failed.');
    }
  }, [getRouter, keyPresent, setVoice, transcript, voice.audioUrl, voice.modelId, voice.provider, voice.speed, voice.stability, voice.voiceId]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !voice.audioUrl) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  const download = () => {
    if (!voice.audioUrl || !voice.audioName) return;
    const anchor = document.createElement('a');
    anchor.href = voice.audioUrl;
    anchor.download = voice.audioName;
    anchor.click();
  };

  return (
    <GlassPanel padding="none" className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <AudioLines className="size-4 text-gold-400" />
          <h2 className="text-[13px] font-semibold text-white">Voice Generator</h2>
        </div>
        <StatusPill
          state={keyPresent ? 'active' : 'missing'}
          message={keyPresent ? 'Key present' : 'No key'}
          busy={voice.status === 'generating'}
        />
      </header>

      <div className="hairline-t space-y-3 px-4 py-3">
        <Segmented<TtsProvider>
          value={voice.provider}
          onChange={(provider) => setVoice({ provider, voiceId: '', status: 'idle' })}
          options={[
            { value: 'elevenlabs', label: 'ElevenLabs' },
            { value: 'gemini', label: 'Gemini TTS' },
          ]}
        />

        <label className="block space-y-1.5">
          <span className="kicker">Voice</span>
          <div className="relative">
            <select
              value={voice.voiceId}
              onChange={(e) => setVoice({ voiceId: e.target.value })}
              className="h-9 w-full appearance-none rounded-xl border border-white/[0.09] bg-black/40 px-3 pr-8 text-[13px] text-white/85 focus:border-violet-500/50 focus:outline-none"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id} className="bg-ink-700">
                  {v.label} — {v.character}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">▾</span>
          </div>
        </label>

        {voice.provider === 'elevenlabs' && (
          <label className="block space-y-1.5">
            <span className="kicker">Model</span>
            <div className="relative">
              <select
                value={voice.modelId}
                onChange={(e) => setVoice({ modelId: e.target.value })}
                className="h-9 w-full appearance-none rounded-xl border border-white/[0.09] bg-black/40 px-3 pr-8 text-[13px] text-white/85 focus:border-violet-500/50 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-ink-700">
                    {m.label} — {m.blurb}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">▾</span>
            </div>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Slider
            label="Stability"
            icon={Gauge}
            value={voice.stability}
            min={0}
            max={1}
            step={0.05}
            onChange={(stability) => setVoice({ stability })}
          />
          <Slider
            label="Speed"
            icon={Sparkles}
            value={voice.speed}
            min={0.7}
            max={1.3}
            step={0.05}
            onChange={(speed) => setVoice({ speed })}
          />
        </div>
      </div>

      <div className="hairline-t px-4 py-3">
        <Waveform url={voice.audioUrl} active={playing} idle={voice.status === 'generating'} />
      </div>

      <div className="hairline-t flex flex-wrap items-center gap-1.5 px-3 py-3">
        <Button
          size="sm"
          variant="gold"
          icon={voice.status === 'generating' ? RefreshCw : Sparkles}
          loading={voice.status === 'generating'}
          onClick={() => void generate()}
        >
          {voice.status === 'ready' ? 'Regenerate' : 'Generate narration'}
        </Button>

        {voice.status === 'ready' && voice.audioUrl && (
          <>
            <Button size="sm" variant="glass" icon={playing ? Square : Play} onClick={togglePlay}>
              {playing ? 'Stop' : 'Preview'}
            </Button>
            <Button size="sm" variant="ghost" icon={Download} onClick={download}>
              .{voice.audioExtension}
            </Button>
            <span className="mono-num ml-auto text-2xs text-white/40">
              {voice.audioBytes ? `${(voice.audioBytes.byteLength / 1024).toFixed(0)} KB` : ''}
            </span>
          </>
        )}

        <audio
          ref={audioRef}
          src={voice.audioUrl}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          className="hidden"
        />
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="hairline-t px-4 py-2 text-2xs text-signal-red"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}

function Slider({
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="kicker flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Icon className="size-3" />
          {label}
        </span>
        <span className="mono-num text-white/50">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] accent-violet-500 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(139,92,246,0.25)]"
      />
    </label>
  );
}

/**
 * Waveform strip. Uses a real analyser when audio is playing; otherwise draws a
 * deterministic envelope so the panel always reads as "audio".
 */
function Waveform({ url, active, idle }: { url?: string; active: boolean; idle?: boolean }) {
  const [levels, setLevels] = useState<number[]>(() => baseline());
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<{ analyser: AnalyserNode; source: MediaElementAudioSourceNode } | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      nodesRef.current?.source.disconnect();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!active || !url) return;
    let cancelled = false;

    const run = async () => {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = ctxRef.current ?? new AudioCtx();
      ctxRef.current = ctx;

      // An element can only be wired to one source node; build it once per URL.
      if (!nodesRef.current) {
        const el = document.querySelector<HTMLAudioElement>('audio');
        if (!el) return;
        const source = ctx.createMediaElementSource(el);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        nodesRef.current = { analyser, source };
      }

      const analyser = nodesRef.current.analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(data);
        const next = Array.from({ length: 40 }, (_, i) => {
          const sample = data[Math.floor((i / 40) * data.length)] ?? 0;
          return Math.max(0.06, sample / 255);
        });
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    };

    void run();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, url]);

  useEffect(() => {
    if (active) return;
    // Idle animation: a slow travelling envelope, seeded so SSR matches.
    let t = 0;
    const timer = window.setInterval(() => {
      t += 1;
      setLevels(
        Array.from({ length: 40 }, (_, i) => {
          const base = 0.08 + 0.5 * Math.abs(Math.sin((i / 40) * Math.PI * 2 + t / 18));
          return Math.max(0.06, base * (0.6 + 0.4 * seededRandom(i * 7 + t)));
        }),
      );
    }, 90);
    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="kicker flex items-center gap-1.5">
          <Waves className="size-3" />
          Waveform
        </span>
        <span className="mono-num text-2xs text-white/35">
          {active ? 'live' : idle ? 'generating' : 'idle'}
        </span>
      </div>
      <div className="flex h-12 items-center justify-between gap-[2px] rounded-xl border border-white/[0.06] bg-black/40 px-2">
        {levels.map((level, i) => (
          <motion.span
            key={i}
            className="w-full rounded-full bg-gradient-to-t from-violet-600 to-gold-300"
            animate={{ height: `${Math.round(level * 100)}%` }}
            transition={{ duration: active ? 0.08 : 0.4, ease: 'easeOut' }}
            style={{ opacity: 0.35 + level * 0.65 }}
          />
        ))}
      </div>
    </div>
  );
}

function baseline(): number[] {
  return Array.from({ length: 40 }, (_, i) => 0.1 + 0.15 * Math.abs(Math.sin(i / 4)));
}
