'use client';

import { motion } from 'framer-motion';
import {
  AlignCenter,
  Contrast,
  Crop,
  Droplet,
  Music4,
  Palette,
  Stamp,
  Type,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useEditorStore } from '@/store/use-editor-store';
import { ASPECT_PRESETS, ASPECTS, type AspectRatio } from '@/lib/ffmpeg/render-engine';
import { cn } from '@/lib/utils/cn';
import { useRef } from 'react';

/**
 * Proportion & Overlay panel — aspect ratio, watermark layer, subtitle styling
 * and the background-music bed.
 */

const POSITIONS = [
  { value: 'top-left', label: '↖' },
  { value: 'top-right', label: '↗' },
  { value: 'bottom-left', label: '↙' },
  { value: 'bottom-right', label: '↘' },
] as const;

const SWATCHES = ['#FFFFFF', '#8B5CF6', '#D4A017', '#3ECF8E', '#FF5C5C', '#000000'] as const;

export function MediaOverlay() {
  const aspect = useEditorStore((s) => s.aspect);
  const setAspect = useEditorStore((s) => s.setAspect);
  const watermark = useEditorStore((s) => s.watermark);
  const updateWatermark = useEditorStore((s) => s.updateWatermark);
  const style = useEditorStore((s) => s.subtitleStyle);
  const updateStyle = useEditorStore((s) => s.updateSubtitleStyle);
  const music = useEditorStore((s) => s.music);
  const setMusic = useEditorStore((s) => s.setMusic);
  const musicInput = useRef<HTMLInputElement>(null);

  return (
    <GlassPanel padding="none" className="flex h-full flex-col">
      <header className="flex items-center gap-2 px-4 py-3">
        <Crop className="size-4 text-violet-400" />
        <h2 className="text-[13px] font-semibold text-white">Proportion &amp; Overlay</h2>
      </header>

      <div className="hairline-t space-y-4 overflow-y-auto px-4 py-4">
        {/* Aspect ratio */}
        <section className="space-y-2">
          <span className="kicker flex items-center gap-1.5">
            <Crop className="size-3" />
            Aspect ratio
          </span>
          <div className="grid grid-cols-2 gap-2">
            {ASPECTS.map((ratio) => {
              const preset = ASPECT_PRESETS[ratio];
              const active = ratio === aspect;
              return (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspect(ratio as AspectRatio)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                    active
                      ? 'border-violet-500/40 bg-violet-500/[0.08]'
                      : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]',
                  )}
                >
                  <AspectGlyph ratio={ratio} active={active} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-white">{preset.label}</span>
                    <span className="mono-num block text-2xs text-white/40">
                      {ratio} · {preset.width}×{preset.height}
                    </span>
                  </span>
                  {active && (
                    <motion.span
                      layoutId="aspect-active"
                      className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-violet-400/30"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Watermark */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="kicker flex items-center gap-1.5">
              <Stamp className="size-3" />
              Watermark layer
            </span>
            <Toggle checked={watermark.enabled} onChange={(enabled) => updateWatermark({ enabled })} />
          </div>

          <motion.div
            animate={{ opacity: watermark.enabled ? 1 : 0.4 }}
            className="space-y-2.5"
          >
            <input
              value={watermark.text}
              onChange={(e) => updateWatermark({ text: e.target.value })}
              placeholder="@yourhandle"
              disabled={!watermark.enabled}
              className="h-9 w-full rounded-xl border border-white/[0.09] bg-black/40 px-3 font-mono text-[13px] text-white placeholder:text-white/25 focus:border-violet-500/50 focus:outline-none disabled:opacity-50"
            />

            <div className="flex items-center gap-2">
              <div className="grid grid-cols-2 gap-1">
                {POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    disabled={!watermark.enabled}
                    onClick={() => updateWatermark({ position: p.value })}
                    className={cn(
                      'grid size-7 place-items-center rounded-lg border text-xs transition-colors disabled:opacity-40',
                      watermark.position === p.value
                        ? 'border-violet-500/40 bg-violet-500/15 text-white'
                        : 'border-white/[0.08] text-white/40 hover:text-white',
                    )}
                    title={p.value}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex-1 space-y-1.5">
                <MiniSlider
                  label="Opacity"
                  icon={Droplet}
                  value={watermark.opacity}
                  min={0.1}
                  max={1}
                  step={0.05}
                  disabled={!watermark.enabled}
                  onChange={(opacity) => updateWatermark({ opacity })}
                />
                <MiniSlider
                  label="Size"
                  icon={Type}
                  value={watermark.size}
                  min={16}
                  max={72}
                  step={2}
                  disabled={!watermark.enabled}
                  onChange={(size) => updateWatermark({ size })}
                />
              </div>
            </div>
          </motion.div>
        </section>

        {/* Subtitle styling */}
        <section className="space-y-2.5">
          <span className="kicker flex items-center gap-1.5">
            <Palette className="size-3" />
            Subtitle styling
          </span>

          <div className="flex items-center gap-1.5">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => updateStyle({ primaryColour: hex.replace('#', '') })}
                className={cn(
                  'size-6 rounded-full border transition-transform active:scale-90',
                  `#${style.primaryColour}`.toLowerCase() === hex.toLowerCase()
                    ? 'border-white/70 ring-2 ring-white/20'
                    : 'border-white/15',
                )}
                style={{ background: hex }}
                aria-label={`Subtitle colour ${hex}`}
              />
            ))}
            <div className="ml-auto flex gap-1">
              <Button
                size="xs"
                variant={style.borderStyle === 1 ? 'primary' : 'ghost'}
                onClick={() => updateStyle({ borderStyle: 1 })}
              >
                Outline
              </Button>
              <Button
                size="xs"
                variant={style.borderStyle === 3 ? 'primary' : 'ghost'}
                onClick={() => updateStyle({ borderStyle: 3 })}
              >
                Box
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MiniSlider
              label="Font size"
              icon={Type}
              value={style.fontSize}
              min={28}
              max={96}
              step={2}
              onChange={(fontSize) => updateStyle({ fontSize })}
            />
            <MiniSlider
              label="Bottom margin"
              icon={AlignCenter}
              value={style.marginV}
              min={20}
              max={420}
              step={10}
              onChange={(marginV) => updateStyle({ marginV })}
            />
          </div>

          <div className="flex gap-1.5">
            <Button
              size="xs"
              variant={style.bold ? 'primary' : 'ghost'}
              icon={Contrast}
              onClick={() => updateStyle({ bold: !style.bold })}
            >
              Bold
            </Button>
            <Button
              size="xs"
              variant={style.uppercase ? 'primary' : 'ghost'}
              onClick={() => updateStyle({ uppercase: !style.uppercase })}
            >
              UPPERCASE
            </Button>
          </div>
        </section>

        {/* Background music */}
        <section className="space-y-2.5">
          <span className="kicker flex items-center gap-1.5">
            <Music4 className="size-3" />
            Background bed
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="glass"
              icon={music.bytes ? Volume2 : VolumeX}
              onClick={() => musicInput.current?.click()}
            >
              {music.name ? truncateMiddle(music.name, 22) : 'Add music'}
            </Button>
            {music.objectUrl && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  URL.revokeObjectURL(music.objectUrl!);
                  setMusic({ name: undefined, bytes: undefined, objectUrl: undefined });
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <MiniSlider
            label="Bed volume"
            icon={Volume2}
            value={music.volume}
            min={0}
            max={0.5}
            step={0.01}
            onChange={(volume) => setMusic({ volume })}
          />
          <input
            ref={musicInput}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const bytes = new Uint8Array(await file.arrayBuffer());
              setMusic({ name: file.name, bytes, objectUrl: URL.createObjectURL(file) });
              event.target.value = '';
            }}
          />
        </section>
      </div>
    </GlassPanel>
  );
}

function AspectGlyph({ ratio, active }: { ratio: string; active: boolean }) {
  const [w, h] = ratio.split(':').map(Number);
  const scale = 22 / Math.max(w, h);
  return (
    <span className="grid size-8 shrink-0 place-items-center">
      <span
        className={cn(
          'rounded-[3px] border transition-colors',
          active ? 'border-violet-300 bg-violet-500/30' : 'border-white/25 bg-white/[0.04]',
        )}
        style={{ width: `${w * scale}px`, height: `${h * scale}px` }}
      />
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full border transition-colors',
        checked ? 'border-violet-400/50 bg-violet-500/40' : 'border-white/[0.12] bg-white/[0.06]',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 600, damping: 34 }}
        className={cn(
          'absolute top-0.5 size-3.5 rounded-full',
          checked ? 'left-[18px] bg-white' : 'left-0.5 bg-white/60',
        )}
      />
    </button>
  );
}

function MiniSlider({
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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
        <span className="flex items-center gap-1">
          <Icon className="size-3" />
          {label}
        </span>
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
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/[0.08] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400"
      />
    </label>
  );
}

function truncateMiddle(text: string, max: number) {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}…${text.slice(-half)}`;
}
