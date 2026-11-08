import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { Cue } from '@/lib/utils/srt-parser';
import { formatClockMs } from '@/lib/utils/format';

/**
 * Client-side render engine.
 *
 * Everything below runs in the browser: the source video is written into the
 * FFmpeg.wasm virtual filesystem, filters are composed into a single
 * `-filter_complex` graph, and the finished MP4 is read back out. No bytes
 * leave the device.
 *
 * The 3-minute ceiling is enforced twice — the plan is rejected before exec,
 * and the graph carries a hard `-t` trim — because a wasm render that runs
 * long enough to exhaust memory takes the whole tab with it.
 */

export const MAX_DURATION_SEC = 180;
export const ASPECTS = ['9:16', '16:9', '1:1', '4:5'] as const;
export type AspectRatio = (typeof ASPECTS)[number];

export const ASPECT_PRESETS: Record<AspectRatio, { label: string; width: number; height: number; note: string }> = {
  '9:16': { label: 'Vertical', width: 1080, height: 1920, note: 'Reels · Shorts · TikTok' },
  '16:9': { label: 'Widescreen', width: 1920, height: 1080, note: 'YouTube · Landscape' },
  '1:1': { label: 'Square', width: 1080, height: 1080, note: 'Feed posts' },
  '4:5': { label: 'Portrait', width: 1080, height: 1350, note: 'Instagram feed' },
};

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number; // 0..1
  size: number; // px in the output frame
}

export interface SubtitleStyle {
  fontName: string;
  fontSize: number;
  primaryColour: string; // hex without '#'
  outlineColour: string;
  backColour: string;
  borderStyle: 1 | 3; // 1 = outline+shadow, 3 = opaque box
  outline: number;
  shadow: number;
  marginV: number;
  bold: boolean;
  uppercase: boolean;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontName: 'Geist Mono',
  fontSize: 54,
  primaryColour: 'FFFFFF',
  outlineColour: '0A0A0C',
  backColour: '000000',
  borderStyle: 1,
  outline: 3,
  shadow: 1,
  marginV: 140,
  bold: true,
  uppercase: false,
};

export interface RenderPlan {
  aspect: AspectRatio;
  durationSec: number;
  cues: Cue[];
  subtitleStyle: SubtitleStyle;
  watermark: WatermarkSettings;
  /** Background music track (optional), mixed under the narration. */
  musicVolume: number;
  /** Narration gain. */
  voiceVolume: number;
  fps: number;
  crf: number;
  /** Optional fade-to-black at the head/tail, in seconds. */
  fadeInSec: number;
  fadeOutSec: number;
}

export const DEFAULT_PLAN: Omit<RenderPlan, 'cues'> = {
  aspect: '9:16',
  durationSec: 0,
  subtitleStyle: DEFAULT_SUBTITLE_STYLE,
  watermark: { enabled: true, text: '@recapstudio', position: 'bottom-right', opacity: 0.55, size: 30 },
  musicVolume: 0.12,
  voiceVolume: 1,
  fps: 30,
  crf: 26,
  fadeInSec: 0.4,
  fadeOutSec: 0.8,
};

export interface RenderInputs {
  /** Original source video bytes. */
  source: Uint8Array;
  sourceName: string;
  /** Narration audio bytes (mp3/wav). */
  voice?: Uint8Array;
  voiceName?: string;
  /** Optional background music bytes. */
  music?: Uint8Array;
  musicName?: string;
}

export type RenderStage =
  | 'idle'
  | 'loading-core'
  | 'staging-files'
  | 'encoding'
  | 'finalising'
  | 'done'
  | 'error';

export interface RenderProgress {
  stage: RenderStage;
  /** 0..1 across the whole job, not just the current exec. */
  ratio: number;
  message: string;
  /** Wall-clock seconds elapsed. */
  elapsedSec: number;
  /** Estimated seconds remaining, or null while unknown. */
  etaSec: number | null;
}

export interface RenderResult {
  blob: Blob;
  fileName: string;
  durationSec: number;
  sizeBytes: number;
  wallClockSec: number;
  log: string[];
}

export class RenderLimitError extends Error {
  constructor(readonly durationSec: number) {
    super(
      `Clip is ${formatClockMs(durationSec)} long. Recap Studio renders a maximum of ${MAX_DURATION_SEC / 60} minutes per export.`,
    );
    this.name = 'RenderLimitError';
  }
}

/** Reject a plan whose timeline exceeds the 3-minute ceiling. */
export function assertWithinLimit(durationSec: number) {
  if (durationSec > MAX_DURATION_SEC + 0.5) throw new RenderLimitError(durationSec);
}

export interface EngineHandle {
  ffmpeg: FFmpeg;
  /** Release the worker and free its memory. */
  dispose: () => void;
}

/**
 * Load the FFmpeg core. Prefers the binaries bundled under `/public/ffmpeg`
 * (offline-capable, and what the Download page hands out); falls back to the
 * jsDelivr build of `@ffmpeg/core` when the local copy is absent.
 */
export async function loadEngine(options: {
  coreBase?: string;
  onLog?: (message: string) => void;
} = {}): Promise<EngineHandle> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');

  const ffmpeg = new FFmpeg();
  if (options.onLog) ffmpeg.on('log', ({ message }) => options.onLog?.(message));

  const local = options.coreBase ?? '/ffmpeg';
  const version = '0.12.6';
  const cdn = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${version}/dist/umd`;

  const load = async (base: string, wrap: boolean) => {
    const url = (file: string) => `${base}/${file}`;
    await ffmpeg.load({
      coreURL: wrap ? await toBlobURL(url('ffmpeg-core.js'), 'text/javascript') : url('ffmpeg-core.js'),
      wasmURL: wrap ? await toBlobURL(url('ffmpeg-core.wasm'), 'application/wasm') : url('ffmpeg-core.wasm'),
    });
  };

  try {
    await load(local, false);
  } catch {
    options.onLog?.('[engine] local core unavailable — falling back to CDN');
    await load(cdn, true);
  }

  return {
    ffmpeg,
    dispose: () => {
      try {
        ffmpeg.terminate();
      } catch {
        /* worker already gone */
      }
    },
  };
}

/**
 * Compose the ffmpeg argument vector for a plan. Exported separately from the
 * exec so the UI can show the exact command that will run — useful when a
 * render fails and the user wants to reproduce it locally.
 */
export function buildCommand(plan: RenderPlan, inputs: { hasVoice: boolean; hasMusic: boolean }): string[] {
  const preset = ASPECT_PRESETS[plan.aspect];
  const filters: string[] = [];

  // Fit the source into the target frame without distortion, then pad.
  filters.push(
    `[0:v]scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,` +
      `pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v0]`,
  );

  if (plan.fadeInSec > 0 || plan.fadeOutSec > 0) {
    const out = Math.max(0, plan.durationSec - plan.fadeOutSec);
    filters.push(
      `[v0]fade=t=in:st=0:d=${plan.fadeInSec},fade=t=out:st=${out.toFixed(2)}:d=${plan.fadeOutSec}[v1]`,
    );
  } else {
    filters.push('[v0]null[v1]');
  }

  let videoLabel = 'v1';
  if (plan.cues.length > 0) {
    filters.push(`[${videoLabel}]subtitles=subs.ass[v2]`);
    videoLabel = 'v2';
  }

  if (plan.watermark.enabled && plan.watermark.text.trim()) {
    const margin = 40;
    const anchor = {
      'top-left': `${margin}:${margin}`,
      'top-right': `w-tw-${margin}:${margin}`,
      'bottom-left': `${margin}:h-th-${margin}`,
      'bottom-right': `w-tw-${margin}:h-th-${margin}`,
    }[plan.watermark.position];
    filters.push(
      `[${videoLabel}]drawtext=text='${escapeDrawText(plan.watermark.text)}':` +
        `fontcolor=white@${plan.watermark.opacity.toFixed(2)}:fontsize=${plan.watermark.size}:` +
        `x=${anchor.split(':')[0]}:y=${anchor.split(':')[1]}:` +
        `shadowcolor=black@0.5:shadowx=1:shadowy=1[v3]`,
    );
    videoLabel = 'v3';
  }

  const args: string[] = ['-i', 'source'];

  let audioLabel = '0:a';
  if (inputs.hasVoice) {
    args.push('-i', 'voice');
    if (inputs.hasMusic) {
      args.push('-i', 'music');
      filters.push(`[2:a]volume=${plan.musicVolume.toFixed(2)},aloop=loop=-1:size=2e9[music]`);
      filters.push(
        `[1:a]volume=${plan.voiceVolume.toFixed(2)}[voice];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
      );
    } else {
      filters.push(`[1:a]volume=${plan.voiceVolume.toFixed(2)}[aout]`);
    }
    audioLabel = 'aout';
  } else if (inputs.hasMusic) {
    args.push('-i', 'music');
    filters.push(`[1:a]volume=${plan.musicVolume.toFixed(2)},aloop=loop=-1:size=2e9[aout]`);
    audioLabel = 'aout';
  }

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', `[${videoLabel}]`);
  if (audioLabel !== '0:a' || inputs.hasVoice || inputs.hasMusic) args.push('-map', `[${audioLabel}]`);
  else args.push('-map', '0:a?');

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(plan.crf),
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(plan.fps),
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    // Hard ceiling — belt and braces alongside assertWithinLimit().
    '-t',
    String(Math.min(plan.durationSec || MAX_DURATION_SEC, MAX_DURATION_SEC)),
    '-y',
    'output.mp4',
  );

  return args;
}

/** Serialise cues as an ASS script so subtitles carry the studio's styling. */
export function buildAssSubtitles(cues: Cue[], style: SubtitleStyle, aspect: AspectRatio): string {
  const preset = ASPECT_PRESETS[aspect];
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${preset.width}`,
    `PlayResY: ${preset.height}`,
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Recap,${style.fontName},${style.fontSize},${ass(style.primaryColour)},` +
      `${ass(style.primaryColour)},` +
      `${ass(style.outlineColour)},` +
      `${ass(style.backColour, true)},` +
      `${style.bold ? -1 : 0},0,0,0,100,100,0,0,${style.borderStyle},${style.outline},${style.shadow},2,80,80,${style.marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const events = cues
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((cue) => {
      const text = style.uppercase ? cue.text.toUpperCase() : cue.text;
      // ASS line breaks are \N; newlines inside a cue become separate lines.
      const escaped = text.replace(/\n/g, '\\N').replace(/[{}]/g, '');
      return `Dialogue: 0,${assTime(cue.start)},${assTime(cue.end)},Recap,,0,0,0,,${escaped}`;
    });

  return [...header, ...events, ''].join('\n');
}

/** ASS uses `H:MM:SS.cc` with centisecond precision. */
function assTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const cs = Math.floor((clamped % 1) * 100);
  const s = Math.floor(clamped % 60);
  const m = Math.floor((clamped / 60) % 60);
  const h = Math.floor(clamped / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`;
}

/** ASS colours are `&HAABBGGRR`, with AA as *inverse* alpha. */
function ass(hex: string, transparent = false): string {
  const clean = hex.replace('#', '').padStart(6, '0');
  const rr = clean.slice(0, 2);
  const gg = clean.slice(2, 4);
  const bb = clean.slice(4, 6);
  const alpha = transparent ? 'C0' : '00';
  return `&H${alpha}${bb}${gg}${rr}`;
}

function escapeDrawText(text: string): string {
  // ffmpeg's drawtext treats ':' and '\' as syntax; escape the common cases.
  return text.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

export interface RunOptions {
  onProgress?: (progress: RenderProgress) => void;
  onLog?: (message: string) => void;
  signal?: AbortSignal;
}

/** Execute a render end-to-end and return the finished MP4. */
export async function runRender(
  handle: EngineHandle,
  plan: RenderPlan,
  inputs: RenderInputs,
  options: RunOptions = {},
): Promise<RenderResult> {
  assertWithinLimit(plan.durationSec);
  const startedAt = Date.now();
  const log: string[] = [];
  const record = (message: string) => {
    log.push(message);
    if (log.length > 400) log.shift();
    options.onLog?.(message);
  };

  const emit = (stage: RenderStage, ratio: number, message: string) => {
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const etaSec = ratio > 0.02 ? Math.max(0, elapsedSec / ratio - elapsedSec) : null;
    options.onProgress?.({ stage, ratio: Math.min(1, Math.max(0, ratio)), message, elapsedSec, etaSec });
  };

  const { ffmpeg } = handle;

  // The exec progress event is per-command; weight it so it never exceeds the
  // encoding band of the overall bar.
  const encodingBand = { start: 0.25, end: 0.94 };
  const onExecProgress = ({ progress }: { progress: number }) => {
    const ratio = encodingBand.start + (encodingBand.end - encodingBand.start) * progress;
    emit('encoding', ratio, `Encoding ${(progress * 100).toFixed(0)}%`);
  };
  ffmpeg.on('progress', onExecProgress);

  const abortListener = () => {
    try {
      ffmpeg.terminate();
    } catch {
      /* already gone */
    }
  };
  options.signal?.addEventListener('abort', abortListener, { once: true });

  try {
    emit('staging-files', 0.04, 'Writing source into the virtual filesystem');
    await ffmpeg.writeFile(inputs.sourceName, inputs.source);
    if (inputs.voice && inputs.voiceName) await ffmpeg.writeFile(inputs.voiceName, inputs.voice);
    if (inputs.music && inputs.musicName) await ffmpeg.writeFile(inputs.musicName, inputs.music);

    if (plan.cues.length > 0) {
      const ass = buildAssSubtitles(plan.cues, plan.subtitleStyle, plan.aspect);
      await ffmpeg.writeFile('subs.ass', new TextEncoder().encode(ass));
    }

    emit('encoding', encodingBand.start, 'Starting encoder');
    const args = buildCommand(plan, {
      hasVoice: Boolean(inputs.voice),
      hasMusic: Boolean(inputs.music),
    });
    record(`ffmpeg ${args.join(' ')}`);
    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new Error(`FFmpeg exited with code ${code}. See the log for details.`);

    emit('finalising', 0.96, 'Packaging MP4');
    const output = await ffmpeg.readFile('output.mp4');
    const bytes = typeof output === 'string' ? new TextEncoder().encode(output) : output;
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'video/mp4' });

    // Best-effort cleanup so a second render starts from a clean slate.
    await Promise.allSettled([
      ffmpeg.deleteFile('output.mp4'),
      ffmpeg.deleteFile('subs.ass'),
      ffmpeg.deleteFile(inputs.sourceName),
      inputs.voiceName ? ffmpeg.deleteFile(inputs.voiceName) : Promise.resolve(),
      inputs.musicName ? ffmpeg.deleteFile(inputs.musicName) : Promise.resolve(),
    ]);

    emit('done', 1, 'Render complete');
    return {
      blob,
      fileName: `recap-${plan.aspect.replace(':', 'x')}-${Date.now()}.mp4`,
      durationSec: plan.durationSec,
      sizeBytes: blob.size,
      wallClockSec: (Date.now() - startedAt) / 1000,
      log,
    };
  } catch (error) {
    emit('error', 0, error instanceof Error ? error.message : 'Render failed');
    throw error;
  } finally {
    ffmpeg.off('progress', onExecProgress);
    options.signal?.removeEventListener('abort', abortListener);
  }
}
