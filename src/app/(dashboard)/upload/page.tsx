'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  AudioWaveform,
  ClipboardPaste,
  FileText,
  Film,
  Languages,
  Link2,
  Loader2,
  Sparkles,
  UploadCloud,
  Wand2,
  Youtube,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PageShell, PageHeader } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { StatusPill } from '@/components/ui/status-pill';
import { useEditorStore } from '@/store/use-editor-store';
import { useApiKeysStore } from '@/store/use-api-keys-store';
import { cuesToSrt, transcribe, wordsToCues } from '@/lib/api/assemblyai';
import { generateRecapScript, GEMINI_TEXT_MODELS, LANGUAGES, findLanguage, translateCues } from '@/lib/api/gemini';
import { parseSRT } from '@/lib/utils/srt-parser';
import { MAX_DURATION_SEC } from '@/lib/ffmpeg/render-engine';
import { estimateSpeechSeconds, formatClock, formatBytes } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * Source intake: YouTube link, local media, or a pasted SRT — then optional
 * AssemblyAI transcription and Gemini recap-script drafting before handing the
 * result to the editor.
 */

type IntakeMode = 'link' | 'file' | 'srt';

export default function UploadPage() {
  const router = useRouter();
  const setSource = useEditorStore((s) => s.setSource);
  const setCues = useEditorStore((s) => s.setCues);
  const loadSrt = useEditorStore((s) => s.loadSrt);
  const setActiveLanguage = useEditorStore((s) => s.setActiveLanguage);
  const translations = useEditorStore((s) => s.translations);
  const applyTranslation = useEditorStore((s) => s.applyTranslation);
  const keys = useApiKeysStore((s) => s.keys);
  const getRouter = useApiKeysStore((s) => s.getRouter);

  const [mode, setMode] = useState<IntakeMode>('link');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [srtText, setSrtText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tone, setTone] = useState<'cinematic' | 'documentary' | 'energetic' | 'analytical'>('cinematic');
  const [script, setScript] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [targetLang, setTargetLang] = useState('my');
  const [translateProgress, setTranslateProgress] = useState<{ done: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const youtubeId = useMemo(() => extractYouTubeId(url), [url]);
  const hasAssembly = Boolean(keys.assemblyai);
  const hasGemini = Boolean(keys.gemini);

  const handleFile = useCallback(async (next: File) => {
    setFile(next);
    setError(null);
    const objectUrl = URL.createObjectURL(next);
    const duration = await probeDuration(objectUrl, next.type).catch(() => 0);
    setSource({
      kind: 'file',
      ref: next.name,
      title: next.name,
      durationSec: duration,
      objectUrl,
    });
  }, [setSource]);

  const runTranscription = async () => {
    setError(null);
    if (!file) {
      setError('Choose a media file first — AssemblyAI needs audio to listen to.');
      return;
    }
    setBusy(true);
    setStatus('Uploading audio to AssemblyAI');
    try {
      const result = await transcribe(getRouter(), {
        bytes: file,
        onProgress: (r, elapsed) =>
          setStatus(`${r.status === 'queued' ? 'Queued' : 'Transcribing'} · ${Math.round(elapsed / 1000)}s`),
      });
      if (!result.words?.length) {
        setError('Transcription completed but returned no word timings.');
        return;
      }
      const cues = wordsToCues(result.words);
      setCues(cues);
      setStatus(`Transcribed ${cues.length} cues`);
      if (result.audioDurationSec) {
        setSource({
          kind: 'file',
          ref: file.name,
          title: file.name,
          durationSec: result.audioDurationSec,
          objectUrl: file ? URL.createObjectURL(file) : undefined,
        });
      }
      // Stash the raw SRT so the user can inspect it below.
      setSrtText(cuesToSrt(cues));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Translate the extracted SRT into the target language.
   *
   * This is the "movie -> SRT -> Myanmar" step: the timings from AssemblyAI are
   * kept, and only the text changes. The result is stored as a track and made
   * active, so opening the editor lands on the translated subtitles.
   */
  const runTranslate = async () => {
    setError(null);
    if (!hasGemini) {
      setError('Add a Gemini key in API Settings to translate subtitles.');
      return;
    }
    const cues = parseSRT(srtText);
    if (cues.length === 0) {
      setError('Nothing to translate — transcribe the source or paste an SRT first.');
      return;
    }
    const language = findLanguage(targetLang);
    if (!language) return;

    setBusy(true);
    setTranslateProgress({ done: 0, total: cues.length });
    setStatus(`Translating ${cues.length} cues to ${language.label}`);
    try {
      const result = await translateCues(getRouter(), {
        lines: cues.map((c) => c.text),
        target: language.label,
        onProgress: (done, total) => {
          setTranslateProgress({ done, total });
          setStatus(`Translating to ${language.label} · ${done}/${total}`);
        },
      });

      const byCueId: Record<string, string> = {};
      cues.forEach((cue, i) => {
        byCueId[cue.id] = result.lines[i] ?? cue.text;
      });

      // Make sure the editor sees these cues, then attach the track.
      setCues(cues);
      applyTranslation(language.code, byCueId);
      setSrtText(cuesToSrt(cues.map((c) => ({ ...c, text: byCueId[c.id] ?? c.text }))));
      setStatus(
        result.keptOriginal > 0
          ? `Translated ${cues.length} cues to ${language.label} — ${result.keptOriginal} line(s) came back unchanged.`
          : `Translated ${cues.length} cues to ${language.label}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setBusy(false);
      setTranslateProgress(null);
    }
  };

  const runScript = async () => {
    setError(null);
    if (!hasGemini) {
      setError('Add a Gemini key in API Settings to draft a recap script.');
      return;
    }
    const transcript = srtText || file?.name || '';
    if (!transcript.trim()) {
      setError('Transcribe the source first, or paste an SRT below.');
      return;
    }
    setBusy(true);
    setStatus('Drafting the recap script with Gemini');
    try {
      const cues = parseSRT(srtText);
      const plain = cues.map((c) => c.text).join(' ');
      const result = await generateRecapScript(getRouter(), {
        transcript: plain || srtText,
        targetSeconds: MAX_DURATION_SEC,
        tone,
      });
      setScript(result.script);
      setStatus(`Drafted with ${result.model}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Script generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const commitAndOpen = () => {
    if (srtText.trim()) {
      const cues = parseSRT(srtText);
      if (cues.length > 0) loadSrt(srtText);
    }
    if (url && mode === 'link') {
      setSource({
        kind: 'youtube',
        ref: youtubeId ?? url,
        title: youtubeId ? `YouTube · ${youtubeId}` : url,
        durationSec: 0,
        thumbnail: youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : undefined,
      });
    }
    router.push('/editor');
  };

  const applyScriptToTimeline = () => {
    if (!script) return;
    const sentences = script
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const per = MAX_DURATION_SEC / Math.max(sentences.length, 1);
    let cursor = 0;
    const cues = sentences.map((text, i) => {
      const cue = {
        id: `script-${i}`,
        index: i + 1,
        start: Math.round(cursor * 1000) / 1000,
        end: Math.round((cursor + per) * 1000) / 1000,
        text,
      };
      cursor += per;
      return cue;
    });
    setCues(cues);
    router.push('/editor');
  };

  return (
    <PageShell>
      <PageHeader
        kicker="Intake"
        title="Upload &amp; Transcribe"
        description="Bring a YouTube link, a local media file, or an existing SRT. Transcription runs on AssemblyAI with your key; the recap script is drafted by Gemini."
        actions={
          <>
            <StatusPill state={hasAssembly ? 'active' : 'missing'} message="AssemblyAI" />
            <StatusPill state={hasGemini ? 'active' : 'missing'} message="Gemini" />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <GlassPanel padding="md" className="space-y-4">
            <Segmented<IntakeMode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'link', label: 'YouTube link', icon: Youtube },
                { value: 'file', label: 'Local file', icon: Film },
                { value: 'srt', label: 'Paste SRT', icon: FileText },
              ]}
            />

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-3"
              >
                {mode === 'link' && (
                  <>
                    <div className="relative flex items-center rounded-xl border border-white/[0.09] bg-black/40 focus-within:border-violet-500/50">
                      <Link2 className="pointer-events-none absolute left-3 size-4 text-white/30" />
                      <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=…"
                        className="h-11 w-full rounded-xl bg-transparent pl-10 pr-3 text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                      />
                    </div>
                    {youtubeId && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`}
                          alt=""
                          className="h-12 w-20 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="mono-num text-2xs text-white/40">video id</p>
                          <p className="truncate text-xs text-white/80">{youtubeId}</p>
                        </div>
                        <StatusPill state="active" message="Link parsed" className="ml-auto" />
                      </motion.div>
                    )}
                    <p className="text-2xs leading-relaxed text-white/40">
                      Link intake registers the source for the editor. To transcribe YouTube audio, download the
                      file and use the Local file tab, or paste an SRT you already have.
                    </p>
                  </>
                )}

                {mode === 'file' && (
                  <>
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        const dropped = e.dataTransfer.files?.[0];
                        if (dropped) void handleFile(dropped);
                      }}
                      className={cn(
                        'flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 transition-colors',
                        dragging
                          ? 'border-violet-500/50 bg-violet-500/[0.07]'
                          : 'border-white/[0.14] bg-white/[0.02] hover:border-white/25',
                      )}
                    >
                      <UploadCloud className={cn('size-6', dragging ? 'text-violet-300' : 'text-white/40')} />
                      <span className="text-xs text-white/70">
                        {file ? file.name : 'Drop a video or audio file, or browse'}
                      </span>
                      <span className="mono-num text-2xs text-white/35">
                        {file ? formatBytes(file.size) : 'mp4 · mov · mp3 · wav · m4a'}
                      </span>
                    </button>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="video/*,audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const next = e.target.files?.[0];
                        if (next) void handleFile(next);
                        e.target.value = '';
                      }}
                    />
                  </>
                )}

                {mode === 'srt' && (
                  <textarea
                    value={srtText}
                    onChange={(e) => setSrtText(e.target.value)}
                    rows={10}
                    spellCheck={false}
                    placeholder={'1\n00:00:01,000 --> 00:00:03,500\nA quiet town. A missing signal.'}
                    className="mono-num w-full resize-y rounded-xl border border-white/[0.09] bg-black/40 p-3 text-xs leading-relaxed text-white/85 placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="primary"
                icon={AudioWaveform}
                loading={busy && status?.includes('Transcrib')}
                disabled={busy || mode !== 'file' || !hasAssembly || !file}
                onClick={() => void runTranscription()}
              >
                Transcribe with AssemblyAI
              </Button>
              <Button
                size="md"
                variant="gold"
                icon={Languages}
                loading={busy && status?.includes('Translating')}
                disabled={busy || !hasGemini || !srtText.trim()}
                onClick={() => void runTranslate()}
              >
                Translate subtitles
              </Button>
              <Button size="md" variant="glass" icon={Sparkles} disabled={busy || !hasGemini} onClick={() => void runScript()}>
                Draft recap script
              </Button>
              <Button size="md" variant="ghost" icon={ArrowRight} onClick={commitAndOpen}>
                Open in editor
              </Button>
            </div>

            {translateProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-2xs text-white/45">
                  <span>
                    Translating to {findLanguage(targetLang)?.label} · {translateProgress.done}/{translateProgress.total}
                  </span>
                  <span className="mono-num">
                    {Math.round((translateProgress.done / Math.max(1, translateProgress.total)) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="signal-bar h-full transition-[width] duration-300"
                    style={{ width: `${(translateProgress.done / Math.max(1, translateProgress.total)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {!hasAssembly && mode === 'file' && (
              <p className="text-2xs text-signal-amber">
                Add an AssemblyAI key in{' '}
                <Link href="/api-settings" className="underline">
                  API Settings
                </Link>{' '}
                to enable transcription.
              </p>
            )}

            <AnimatePresence>
              {(status || error) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-2xs',
                    error
                      ? 'border-signal-red/25 bg-signal-red/[0.07] text-signal-red'
                      : 'border-violet-500/25 bg-violet-500/[0.07] text-violet-200',
                  )}
                >
                  {busy && !error && <Loader2 className="size-3.5 animate-spin" />}
                  {error ?? status}
                </motion.div>
              )}
            </AnimatePresence>
          </GlassPanel>

          <AnimatePresence>
            {script && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <GlassPanel glow="gold" padding="md" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-[13px] font-semibold text-white">
                      <Wand2 className="size-4 text-gold-400" />
                      Recap script
                    </h2>
                    <span className="mono-num text-2xs text-white/40">
                      {script.split(/\s+/).filter(Boolean).length} words · est. {formatClock(estimateSpeechSeconds(script))}
                    </span>
                  </div>
                  <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    rows={10}
                    className="w-full resize-y rounded-xl border border-white/[0.09] bg-black/40 p-3 text-[13px] leading-relaxed text-white/85 focus:border-violet-500/50 focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="gold" icon={ArrowRight} onClick={applyScriptToTimeline}>
                      Send to timeline
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={ClipboardPaste}
                      onClick={() => void navigator.clipboard.writeText(script)}
                    >
                      Copy
                    </Button>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GlassPanel padding="md" className="space-y-3">
            <h3 className="kicker flex items-center gap-1.5">
              <Languages className="size-3 text-violet-400" />
              Subtitle language
            </h3>
            <div className="relative">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="h-9 w-full appearance-none rounded-xl border border-white/[0.09] bg-black/40 px-3 pr-8 text-[13px] text-white/85 focus:border-violet-500/50 focus:outline-none"
              >
                {LANGUAGES.map((option) => (
                  <option key={option.code} value={option.code} className="bg-ink-700">
                    {option.label} — {option.native}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">▾</span>
            </div>
            <p className="text-2xs leading-relaxed text-white/40">
              Transcribe first, then translate. The timings from AssemblyAI are kept — only the text changes —
              so the edit never needs re-timing.
            </p>
            {Object.keys(translations).length > 0 && (
              <div className="space-y-1.5">
                <span className="kicker">Tracks ready</span>
                {Object.keys(translations).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setActiveLanguage(code)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-2xs text-white/60 hover:text-white"
                  >
                    <span>{findLanguage(code)?.label ?? code}</span>
                    <span className="mono-num text-white/35">{Object.keys(translations[code]).length} cues</span>
                  </button>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel padding="md" className="space-y-3">
            <h3 className="kicker">Script tone</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {(['cinematic', 'documentary', 'energetic', 'analytical'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTone(option)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-2xs capitalize transition-colors',
                    tone === option
                      ? 'border-violet-500/40 bg-violet-500/[0.08] text-white'
                      : 'border-white/[0.07] text-white/50 hover:text-white/80',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="text-2xs leading-relaxed text-white/40">
              The tone steers the Gemini writer. Scripts target {MAX_DURATION_SEC / 60} minutes at 150&nbsp;wpm.
            </p>
          </GlassPanel>

          <GlassPanel padding="md" className="space-y-2">
            <h3 className="kicker">Writer models</h3>
            <ul className="space-y-1.5">
              {GEMINI_TEXT_MODELS.map((model) => (
                <li key={model.id} className="flex items-center justify-between text-2xs">
                  <span className="text-white/70">{model.label}</span>
                  <span className="text-white/35">{model.blurb}</span>
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel padding="md" grid className="space-y-2">
            <h3 className="kicker">Pipeline</h3>
            <ol className="space-y-1.5 text-2xs leading-relaxed text-white/45">
              <li>1. Register the source (link or file).</li>
              <li>2. Transcribe to word-level timings.</li>
              <li>3. Draft and tighten the recap script.</li>
              <li>4. Generate narration, then render on-device.</li>
            </ol>
          </GlassPanel>
        </div>
      </div>
    </PageShell>
  );
}

/** Pull the 11-char video id out of any common YouTube URL shape. */
function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match) return match[1];
  }
  return null;
}

/** Read the duration of a media file without attaching it to the DOM. */
function probeDuration(objectUrl: string, type: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const element = document.createElement(type.startsWith('audio') ? 'audio' : 'video');
    element.preload = 'metadata';
    element.src = objectUrl;
    const cleanup = () => {
      element.removeAttribute('src');
      element.load();
    };
    element.onloadedmetadata = () => {
      const duration = element.duration;
      cleanup();
      resolve(Number.isFinite(duration) ? duration : 0);
    };
    element.onerror = () => {
      cleanup();
      reject(new Error('Could not read media metadata.'));
    };
  });
}
