'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Captions,
  Download,
  Languages,
  Layers2,
  Music4,
  Scissors,
  Wand2,
  Type,
  Upload,
  Gauge,
  Crop,
  Palette,
  Volume2,
  Film,
  Split,
  Trash2,
  Copy,
  Timer,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useEditorStore, clipDuration, clipEnd, type InspectorTab } from '@/store/use-editor-store';
import { useApiKeysStore } from '@/store/use-api-keys-store';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { SubtitleTimeline } from '@/components/editor/subtitle-timeline';
import { ASPECT_PRESETS, ASPECTS, type AspectRatio } from '@/lib/ffmpeg/render-engine';
import { GEMINI_TEXT_MODELS, LANGUAGES, findLanguage, translateCues } from '@/lib/api/gemini';
import { cn } from '@/lib/utils/cn';
import { formatClock } from '@/lib/utils/format';

/**
 * Right-hand inspector.
 *
 * Four context tabs, matching the CapCut/Alight Motion arrangement: the panel
 * follows whatever you last touched on the timeline (a clip opens Clip, a
 * subtitle block opens Text) and every control writes straight to the store.
 */

const TABS: { id: InspectorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'clip', label: 'Clip', icon: Scissors },
  { id: 'text', label: 'Text', icon: Captions },
  { id: 'audio', label: 'Audio', icon: Music4 },
  { id: 'effects', label: 'Effects', icon: Wand2 },
];

export function Inspector() {
  const tab = useEditorStore((s) => s.inspectorTab);
  const setTab = useEditorStore((s) => s.setInspectorTab);

  return (
    <GlassPanel padding="none" className="flex h-full min-h-0 flex-col">
      <div className="px-2.5 pt-2.5">
        <Segmented<InspectorTab>
          size="sm"
          value={tab}
          onChange={setTab}
          options={TABS.map(({ id, label, icon }) => ({ value: id, label, icon }))}
        />
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-3"
        >
          {tab === 'clip' && <ClipInspector />}
          {tab === 'text' && <TextInspector />}
          {tab === 'audio' && <AudioInspector />}
          {tab === 'effects' && <EffectsInspector />}
        </motion.div>
      </div>
    </GlassPanel>
  );
}

/* ------------------------------------------------------------------ */
/* Clip                                                                */
/* ------------------------------------------------------------------ */

function ClipInspector() {
  const clips = useEditorStore((s) => s.clips);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const updateClip = useEditorStore((s) => s.updateClip);
  const splitClipAtPlayhead = useEditorStore((s) => s.splitClipAtPlayhead);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const playhead = useEditorStore((s) => s.playhead);

  const clip = clips.find((c) => c.id === selectedClipId) ?? null;

  if (!clip) {
    return (
      <EmptyPanel
        icon={Scissors}
        title="No clip selected"
        body="Tap a clip on the video track to trim it, change its speed, or split it at the playhead."
      />
    );
  }

  const duration = clipDuration(clip);
  const canSplit = playhead > clip.startSec + 0.2 && playhead < clipEnd(clip) - 0.2;

  return (
    <>
      <PanelTitle icon={Film} title={clip.label || 'Clip'} sub={`${formatClock(clip.startSec)} → ${formatClock(clipEnd(clip))}`} />

      <Field label="Speed" hint={`${clip.speed.toFixed(2)}× · plays ${duration.toFixed(2)}s`}>
        <Slider
          min={0.25}
          max={4}
          step={0.05}
          value={clip.speed}
          onChange={(speed) => updateClip(clip.id, { speed })}
        />
        <div className="mt-1.5 flex gap-1">
          {[0.5, 1, 1.5, 2, 3].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => updateClip(clip.id, { speed: preset })}
              className={cn(
                'pill h-6 flex-1 border text-2xs',
                Math.abs(clip.speed - preset) < 0.001
                  ? 'border-violet-500/40 bg-violet-500/[0.12] text-violet-200'
                  : 'border-white/[0.08] text-white/45 hover:text-white/80',
              )}
            >
              {preset}×
            </button>
          ))}
        </div>
      </Field>

      <Field label="Trim in" hint={formatClock(clip.inSec)}>
        <Slider
          min={0}
          max={Math.max(0.2, clip.outSec - 0.2)}
          step={0.05}
          value={clip.inSec}
          onChange={(inSec) => updateClip(clip.id, { inSec })}
        />
      </Field>

      <Field label="Trim out" hint={formatClock(clip.outSec)}>
        <Slider
          min={clip.inSec + 0.2}
          max={Math.max(clip.inSec + 0.2, useEditorStore.getState().source.durationSec || clip.outSec)}
          step={0.05}
          value={clip.outSec}
          onChange={(outSec) => updateClip(clip.id, { outSec })}
        />
      </Field>

      <Field label="Opacity" hint={`${Math.round(clip.opacity * 100)}%`}>
        <Slider min={0} max={1} step={0.01} value={clip.opacity} onChange={(opacity) => updateClip(clip.id, { opacity })} />
      </Field>

      <Field label="Clip volume" hint={`${Math.round(clip.volume * 100)}%`}>
        <Slider min={0} max={2} step={0.01} value={clip.volume} onChange={(volume) => updateClip(clip.id, { volume })} />
      </Field>

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button
          size="sm"
          variant="primary"
          icon={Split}
          disabled={!canSplit}
          onClick={splitClipAtPlayhead}
          title={canSplit ? 'Split at the playhead' : 'Move the playhead over the clip to split'}
        >
          Split
        </Button>
        <Button size="sm" variant="glass" icon={Copy} onClick={() => duplicateClip(clip.id)}>
          Duplicate
        </Button>
        <Button size="sm" variant="ghost" icon={Volume2} onClick={() => updateClip(clip.id, { muted: !clip.muted })}>
          {clip.muted ? 'Unmute' : 'Mute'}
        </Button>
        <Button size="sm" variant="danger" icon={Trash2} onClick={() => removeClip(clip.id)}>
          Delete
        </Button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

function TextInspector() {
  const cues = useEditorStore((s) => s.cues);
  const selectedCueId = useEditorStore((s) => s.selectedCueId);
  const updateCue = useEditorStore((s) => s.updateCue);
  const selectCue = useEditorStore((s) => s.selectCue);
  const addCue = useEditorStore((s) => s.addCue);
  const removeCue = useEditorStore((s) => s.removeCue);
  const style = useEditorStore((s) => s.subtitleStyle);
  const updateStyle = useEditorStore((s) => s.updateSubtitleStyle);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const loadSrt = useEditorStore((s) => s.loadSrt);
  const exportSrt = useEditorStore((s) => s.exportSrt);
  const autoSync = useEditorStore((s) => s.autoSync);
  const loadSample = useEditorStore((s) => s.loadSample);
  const fileRef = useRef<HTMLInputElement>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const cue = cues.find((c) => c.id === selectedCueId) ?? null;

  const onImport = async (file: File) => {
    loadSrt(await file.text());
  };

  const onExport = () => {
    const blob = new Blob([exportSrt()], { type: 'application/x-subrip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'recap-studio.srt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <PanelTitle icon={Captions} title="Subtitles" sub={`${cues.length} cues`} />
        <Button size="xs" variant="glass" icon={Type} onClick={() => addCue()}>
          Add
        </Button>
      </div>

      {/* SRT tools — the round-trip that makes the timeline portable. */}
      <div className="flex flex-wrap gap-1.5">
        <Button size="xs" variant="glass" icon={Upload} onClick={() => fileRef.current?.click()}>
          Import SRT
        </Button>
        <Button size="xs" variant="glass" icon={Download} disabled={cues.length === 0} onClick={onExport}>
          Export SRT
        </Button>
        <Button
          size="xs"
          variant="ghost"
          icon={Wand2}
          disabled={cues.length === 0}
          onClick={() => autoSync(180)}
          title="Redistribute every unlocked cue to fit three minutes"
        >
          Auto-sync
        </Button>
        <Button size="xs" variant="ghost" icon={Layers2} onClick={() => setDetailOpen(true)}>
          Detail
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".srt,.txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = '';
          }}
        />
      </div>

      {cues.length === 0 && (
        <Button size="sm" variant="ghost" onClick={loadSample}>
          Load a sample track
        </Button>
      )}

      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {cues.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              selectCue(c.id);
              setPlayhead(c.start);
            }}
            className={cn(
              'shrink-0 rounded-lg border px-2 py-1 text-2xs transition-colors',
              c.id === selectedCueId
                ? 'border-gold-500/40 bg-gold-500/[0.12] text-gold-100'
                : 'border-white/[0.08] text-white/45 hover:text-white/80',
            )}
          >
            {c.index}
          </button>
        ))}
      </div>

      {cue ? (
        <>
          <Field label="Line" hint={`${cue.text.length} chars`}>
            <textarea
              value={cue.text}
              onChange={(e) => updateCue(cue.id, { text: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/[0.09] bg-black/40 px-2.5 py-2 text-[13px] leading-relaxed text-white/85 focus:border-violet-500/50 focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Start" hint={formatClock(cue.start)}>
              <Slider min={0} max={Math.max(1, cue.end - 0.2)} step={0.05} value={cue.start} onChange={(start) => updateCue(cue.id, { start })} />
            </Field>
            <Field label="End" hint={formatClock(cue.end)}>
              <Slider min={cue.start + 0.2} max={cue.start + 12} step={0.05} value={cue.end} onChange={(end) => updateCue(cue.id, { end })} />
            </Field>
          </div>

          <Button size="sm" variant="danger" icon={Trash2} onClick={() => removeCue(cue.id)}>
            Delete cue
          </Button>
        </>
      ) : (
        <p className="text-2xs text-white/35">Select a cue to edit its text and timing.</p>
      )}

      <div className="hairline-t pt-3">
        <p className="kicker mb-2 flex items-center gap-1.5">
          <Palette className="size-3" />
          Style
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Size" hint={`${style.fontSize}px`}>
            <Slider min={28} max={96} step={2} value={style.fontSize} onChange={(fontSize) => updateStyle({ fontSize })} />
          </Field>
          <Field label="Margin" hint={`${style.marginV}px`}>
            <Slider min={20} max={420} step={10} value={style.marginV} onChange={(marginV) => updateStyle({ marginV })} />
          </Field>
        </div>
        <div className="mt-2 flex gap-1.5">
          <Button size="xs" variant={style.bold ? 'primary' : 'ghost'} onClick={() => updateStyle({ bold: !style.bold })}>
            Bold
          </Button>
          <Button size="xs" variant={style.uppercase ? 'primary' : 'ghost'} onClick={() => updateStyle({ uppercase: !style.uppercase })}>
            CAPS
          </Button>
          <Button size="xs" variant={style.borderStyle === 3 ? 'primary' : 'ghost'} onClick={() => updateStyle({ borderStyle: style.borderStyle === 3 ? 1 : 3 })}>
            Box
          </Button>
        </div>
      </div>

      <div className="hairline-t pt-3">
        <TranslatePanel />
      </div>

      <AnimatedModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Subtitle detail"
        description="The full cue list with the typewriter read-through."
        size="lg"
      >
        <div className="h-[62dvh]">
          <SubtitleTimeline />
        </div>
      </AnimatedModal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Translate                                                           */
/* ------------------------------------------------------------------ */

/**
 * Subtitle translation.
 *
 * Translating swaps the *text* of each cue while its timings stay untouched, so
 * a translation survives retiming, trimming and reordering. Pick a language,
 * run it, and the timeline, the preview burn-in, the narration and the export
 * all switch together — `activeLanguage` is the one switch.
 */
function TranslatePanel() {
  const cues = useEditorStore((s) => s.cues);
  const translations = useEditorStore((s) => s.translations);
  const activeLanguage = useEditorStore((s) => s.activeLanguage);
  const setActiveLanguage = useEditorStore((s) => s.setActiveLanguage);
  const applyTranslation = useEditorStore((s) => s.applyTranslation);
  const clearTranslation = useEditorStore((s) => s.clearTranslation);
  const setTranslating = useEditorStore((s) => s.setTranslating);
  const translating = useEditorStore((s) => s.translating);
  const progress = useEditorStore((s) => s.translateProgress);
  const translateError = useEditorStore((s) => s.translateError);
  const getRouter = useApiKeysStore((s) => s.getRouter);
  const hasGemini = useApiKeysStore((s) => Boolean(s.keys.gemini));

  const [target, setTarget] = useState('my');
  const [model, setModel] = useState('gemini-2.5-flash');

  const available = Object.keys(translations);
  const language = findLanguage(target);
  const done = progress ? progress.done : 0;
  const total = progress ? progress.total : cues.length;
  const ratio = total > 0 ? done / total : 0;

  const run = async () => {
    if (!language || cues.length === 0) return;
    if (!hasGemini) {
      setTranslating({ error: 'Add a Gemini key in API Settings to translate.' });
      return;
    }
    setTranslating({ translating: true, progress: { done: 0, total: cues.length }, error: null });

    try {
      const ordered = cues.slice().sort((a, b) => a.start - b.start);
      const result = await translateCues(getRouter(), {
        lines: ordered.map((c) => c.text),
        target: language.label,
        model,
        onProgress: (d, t) => setTranslating({ progress: { done: d, total: t } }),
      });

      const byCueId: Record<string, string> = {};
      ordered.forEach((cue, i) => {
        byCueId[cue.id] = result.lines[i] ?? cue.text;
      });
      applyTranslation(language.code, byCueId);

      if (result.keptOriginal > 0) {
        setTranslating({
          error: `${result.keptOriginal} of ${ordered.length} lines came back unchanged and may not be translated. Check the track before rendering.`,
        });
      }
    } catch (error) {
      setTranslating({
        translating: false,
        progress: null,
        error: error instanceof Error ? error.message : 'Translation failed.',
      });
    }
  };

  return (
    <div className="space-y-3">
      <p className="kicker flex items-center gap-1.5">
        <Languages className="size-3" />
        Translate subtitles
      </p>

      <Field label="Target language" hint={language?.native}>
        <div className="relative">
          <select
            value={target}
            disabled={translating}
            onChange={(e) => setTarget(e.target.value)}
            className="h-9 w-full appearance-none rounded-xl border border-white/[0.09] bg-black/40 px-3 pr-8 text-[13px] text-white/85 focus:border-violet-500/50 focus:outline-none disabled:opacity-60"
          >
            {LANGUAGES.map((option) => (
              <option key={option.code} value={option.code} className="bg-ink-700">
                {option.label} — {option.native}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">▾</span>
        </div>
      </Field>

      <Field label="Model" hint={model === 'gemini-2.5-flash' ? 'fast' : 'quality'}>
        <div className="relative">
          <select
            value={model}
            disabled={translating}
            onChange={(e) => setModel(e.target.value)}
            className="h-9 w-full appearance-none rounded-xl border border-white/[0.09] bg-black/40 px-3 pr-8 text-[13px] text-white/85 focus:border-violet-500/50 focus:outline-none disabled:opacity-60"
          >
            {GEMINI_TEXT_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-ink-700">
                {m.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/30">▾</span>
        </div>
      </Field>

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="primary"
          icon={Languages}
          loading={translating}
          disabled={translating || cues.length === 0}
          onClick={() => void run()}
        >
          {translations[target] ? 'Re-translate' : `Translate to ${language?.label ?? target}`}
        </Button>
        {translations[target] && (
          <Button size="sm" variant="ghost" icon={Trash2} disabled={translating} onClick={() => clearTranslation(target)}>
            Remove
          </Button>
        )}
      </div>

      {/* Progress */}
      <AnimatePresence>
        {translating && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-2xs text-white/45">
                <span>Translating {done} / {total} cues</span>
                <span className="mono-num">{Math.round(ratio * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div className="signal-bar h-full" animate={{ width: `${ratio * 100}%` }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {translateError && <p className="text-2xs text-signal-amber">{translateError}</p>}

      {/* Track switcher */}
      {available.length > 0 && (
        <Field label="Subtitle track" hint={activeLanguage ? findLanguage(activeLanguage)?.native : 'original'}>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveLanguage(null)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-2xs transition-colors',
                !activeLanguage
                  ? 'border-violet-500/40 bg-violet-500/[0.10] text-white'
                  : 'border-white/[0.08] text-white/55 hover:text-white',
              )}
            >
              <span>Original</span>
              <span className="mono-num text-white/35">{cues.length} cues</span>
            </button>
            {available.map((code) => {
              const meta = findLanguage(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setActiveLanguage(code)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-2xs transition-colors',
                    activeLanguage === code
                      ? 'border-violet-500/40 bg-violet-500/[0.10] text-white'
                      : 'border-white/[0.08] text-white/55 hover:text-white',
                  )}
                >
                  <span>
                    {meta?.label ?? code}
                    {meta && <span className="ml-1.5 text-white/35">{meta.native}</span>}
                  </span>
                  <span className="mono-num text-white/35">
                    {Object.keys(translations[code]).length} cues
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <p className="text-2xs leading-relaxed text-white/35">
        The active track drives the timeline, the preview burn-in, the narration and the exported SRT.
        Timings are shared, so switching languages never re-times the edit.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audio                                                               */
/* ------------------------------------------------------------------ */

function AudioInspector() {
  const voice = useEditorStore((s) => s.voice);
  const setVoice = useEditorStore((s) => s.setVoice);
  const music = useEditorStore((s) => s.music);
  const setMusic = useEditorStore((s) => s.setMusic);

  return (
    <>
      <PanelTitle icon={Music4} title="Audio" sub="Narration and music bed" />

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="kicker mb-2">Narration</p>
        {voice.audioUrl ? (
          <div className="space-y-2">
            <p className="mono-num truncate text-2xs text-white/70">{voice.audioName}</p>
            <audio controls src={voice.audioUrl} className="h-8 w-full" />
            <div className="flex gap-1.5">
              <Button size="xs" variant="ghost" onClick={() => setVoice({ audioUrl: undefined, audioBytes: undefined, status: 'idle' })}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-2xs leading-relaxed text-white/40">
            Generate narration from the Voice panel, then it appears here and on the audio track.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="kicker mb-2">Music bed</p>
        {music.objectUrl ? (
          <div className="space-y-2">
            <p className="mono-num truncate text-2xs text-white/70">{music.name}</p>
            <Field label="Volume" hint={`${Math.round(music.volume * 100)}%`}>
              <Slider min={0} max={0.6} step={0.01} value={music.volume} onChange={(volume) => setMusic({ volume })} />
            </Field>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                URL.revokeObjectURL(music.objectUrl!);
                setMusic({ name: undefined, bytes: undefined, objectUrl: undefined });
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <p className="text-2xs leading-relaxed text-white/40">
            Add a music bed from the Overlay panel. It is mixed under the narration at the volume you set.
          </p>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Effects                                                             */
/* ------------------------------------------------------------------ */

function EffectsInspector() {
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const watermark = useEditorStore((s) => s.watermark);
  const updateWatermark = useEditorStore((s) => s.updateWatermark);
  const sequenceDuration = useEditorStore((s) => s.sequenceDuration());
  const clips = useEditorStore((s) => s.clips);

  return (
    <>
      <PanelTitle icon={Wand2} title="Effects" sub="Frame, watermark and timing" />

      <Field label="Aspect ratio" hint={ASPECT_PRESETS[aspect].note}>
        <div className="grid grid-cols-2 gap-1.5">
          {ASPECTS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => setAspect(ratio as AspectRatio)}
              className={cn(
                'rounded-lg border px-2 py-2 text-left text-2xs transition-colors',
                ratio === aspect
                  ? 'border-violet-500/40 bg-violet-500/[0.10] text-white'
                  : 'border-white/[0.08] text-white/50 hover:text-white/80',
              )}
            >
              <span className="block font-medium">{ASPECT_PRESETS[ratio as AspectRatio].label}</span>
              <span className="mono-num block text-[9px] text-white/40">{ratio}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Watermark" hint={watermark.enabled ? 'On' : 'Off'}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={watermark.enabled}
            onClick={() => updateWatermark({ enabled: !watermark.enabled })}
            className={cn(
              'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
              watermark.enabled ? 'border-violet-400/50 bg-violet-500/40' : 'border-white/[0.12] bg-white/[0.06]',
            )}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 600, damping: 34 }}
              className={cn(
                'absolute top-0.5 size-3.5 rounded-full',
                watermark.enabled ? 'left-[18px] bg-white' : 'left-0.5 bg-white/60',
              )}
            />
          </button>
          <input
            value={watermark.text}
            onChange={(e) => updateWatermark({ text: e.target.value })}
            disabled={!watermark.enabled}
            placeholder="@yourhandle"
            className="h-8 w-full rounded-lg border border-white/[0.09] bg-black/40 px-2.5 font-mono text-2xs text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none disabled:opacity-50"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <MiniSlider label="Opacity" value={watermark.opacity} min={0.1} max={1} step={0.05} disabled={!watermark.enabled} onChange={(opacity) => updateWatermark({ opacity })} />
          <MiniSlider label="Size" value={watermark.size} min={16} max={72} step={2} disabled={!watermark.enabled} onChange={(size) => updateWatermark({ size })} />
        </div>
      </Field>

      <Field label="Sequence" hint={`${clips.length} clips · ${formatClock(sequenceDuration)}`}>
        <div className="space-y-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 text-2xs">
          <Row label="Clip count" value={String(clips.length)} />
          <Row label="Sequence length" value={formatClock(sequenceDuration)} />
          <Row label="Ceiling" value="3:00" tone={sequenceDuration > 180 ? 'red' : 'green'} />
        </div>
      </Field>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function PanelTitle({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg border border-white/[0.09] bg-white/[0.03]">
        <Icon className="size-3.5 text-violet-300" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-white">{title}</p>
        {sub && <p className="mono-num truncate text-2xs text-white/40">{sub}</p>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="kicker">{label}</span>
        {hint && <span className="mono-num truncate text-2xs text-white/40">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Slider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={Math.max(max, min + step)}
      step={step}
      value={Math.min(Math.max(value, min), Math.max(max, min + step))}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.09] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(139,92,246,0.25)]"
    />
  );
}

function MiniSlider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={cn('block space-y-1', disabled && 'opacity-50')}>
      <span className="flex items-center justify-between text-2xs text-white/45">
        <span>{label}</span>
        <span className="mono-num">{step < 1 ? value.toFixed(2) : Math.round(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.09] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400"
      />
    </label>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span
        className={cn(
          'mono-num',
          tone === 'red' ? 'text-signal-red' : tone === 'green' ? 'text-signal-green' : 'text-white/75',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <Icon className="size-4 text-white/40" />
      </span>
      <p className="text-[13px] font-medium text-white/80">{title}</p>
      <p className="text-2xs leading-relaxed text-white/40">{body}</p>
    </div>
  );
}

/** Small vertical rail of tools that also drives the inspector tab. */
export function ToolRail() {
  const tab = useEditorStore((s) => s.inspectorTab);
  const setTab = useEditorStore((s) => s.setInspectorTab);
  const setPanel = useEditorStore((s) => s.setPanel);
  const panel = useEditorStore((s) => s.panel);

  const tools: {
    id: InspectorTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    mobilePanel?: typeof panel;
  }[] = [
    { id: 'clip', label: 'Media', icon: Film, mobilePanel: 'subtitle' },
    { id: 'text', label: 'Text', icon: Captions, mobilePanel: 'subtitle' },
    { id: 'audio', label: 'Audio', icon: Music4, mobilePanel: 'voice' },
    { id: 'effects', label: 'Effects', icon: Wand2, mobilePanel: 'overlay' },
  ];

  return (
    <nav className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-ink-800/70 p-1.5 backdrop-blur-xl">
      {tools.map((tool) => {
        const active = tab === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => {
              setTab(tool.id);
              if (tool.mobilePanel) setPanel(tool.mobilePanel);
            }}
            title={tool.label}
            aria-label={tool.label}
            className={cn(
              'relative grid size-9 place-items-center rounded-xl transition-colors',
              active ? 'text-white' : 'text-white/40 hover:text-white/80',
            )}
          >
            {active && (
              <motion.span
                layoutId="rail-active"
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                className="absolute inset-0 rounded-xl border border-violet-500/35 bg-violet-500/[0.14]"
              />
            )}
            <tool.icon className="relative size-4" />
          </button>
        );
      })}

      <span className="my-0.5 h-px w-6 bg-white/10" />

      <button
        type="button"
        onClick={() => {
          setTab('effects');
          setPanel('render');
        }}
        title="Export"
        aria-label="Export"
        className={cn(
          'grid size-9 place-items-center rounded-xl transition-colors',
          panel === 'render' ? 'bg-gold-500/[0.14] text-gold-200' : 'text-white/40 hover:text-white/80',
        )}
      >
        <Gauge className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          setTab('effects');
          setPanel('overlay');
        }}
        title="Frame"
        aria-label="Frame"
        className="grid size-9 place-items-center rounded-xl text-white/40 transition-colors hover:text-white/80"
      >
        <Crop className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => {
          setTab('effects');
          setPanel('render');
        }}
        title="Timing"
        aria-label="Timing"
        className="grid size-9 place-items-center rounded-xl text-white/40 transition-colors hover:text-white/80"
      >
        <Timer className="size-4" />
      </button>
    </nav>
  );
}
