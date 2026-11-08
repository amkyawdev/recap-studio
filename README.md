# Recap Studio

A browser-based video recap workstation. Transcribe a film, compress it into a
three-minute script, translate the subtitles, generate narration, and render the finished
cut — all on the device, with your own API keys.

Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion · Zustand · FFmpeg.wasm

<p align="center">
  <img src="docs/screenshots/editor-mobile.png" alt="The Recap Studio editor on a phone: a 9:16 preview with transport controls above a four-lane multitrack timeline, and a tool bar along the bottom" width="330" />
</p>
<p align="center"><sub><b>The editor on mobile</b> — stage over multitrack timeline, tools in a bottom sheet.</sub></p>

---

## Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [The workflow](#the-workflow)
- [The editor](#the-editor)
  - [Multitrack timeline](#multitrack-timeline)
  - [Inspector](#inspector)
  - [Keyboard shortcuts](#keyboard-shortcuts)
- [Translating subtitles](#translating-subtitles)
- [Rendering](#rendering)
- [Bring your own key](#bring-your-own-key)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Security](#security)
- [Known limitations](#known-limitations)
- [Licence](#licence)

---

## What it does

| Capability | Detail |
| --- | --- |
| **Transcribe** | AssemblyAI returns word-level timings, converted into subtitle cues. |
| **Script** | Gemini compresses the transcript into a 3-minute narration in a chosen tone. |
| **Translate** | 12 languages, Burmese first. Timings are shared, so the edit never needs re-timing. |
| **Narrate** | ElevenLabs or Gemini TTS, with a live waveform and MP3/WAV export. |
| **Edit** | A four-lane multitrack timeline: trim, split, move, speed, snap, zoom. |
| **Render** | FFmpeg.wasm compiles the cut in the browser, with a hard three-minute ceiling. |

Two design commitments run through the whole app:

1. **Your media and keys never leave the device.** Renders happen in a wasm worker; keys
   sit in a local encrypted vault.
2. **Three minutes is the product.** The ceiling is enforced before the encode and again
   inside the argument vector.

## Quick start

```bash
npm install
npm run fetch:ffmpeg   # optional: bundle the wasm core for offline rendering
npm run dev            # http://localhost:3000
```

Then:

1. Open **`/api-settings`**, create a vault passphrase, and paste at least one provider key.
2. Open **`/upload`** to bring in a source and transcribe it.
3. Open **`/editor`** to cut it.

## The workflow

```
Upload a source ─► Transcribe (SRT) ─► Translate ─► Tighten the timeline ─► Narrate ─► Render
   /upload            /upload          /upload          /editor             /editor    /editor
```

## The editor

Desktop is arranged like a desktop NLE: a tool rail on the left, the preview stage in the
middle, the context inspector on the right, and the multitrack timeline docked across the
full width beneath. On a phone the stage sits above the timeline and the inspector opens
as a bottom sheet.

### Multitrack timeline

| Lane | Holds | Interactions |
| --- | --- | --- |
| **Video** | Clips cut from the source | Drag to move, drag an edge to trim, split, duplicate, mute |
| **Subtitles** | Cue blocks | Drag to retime, drag an edge to resize, double-click to delete |
| **Audio** | Narration and the music bed | Read-only blocks reflecting the loaded audio |
| **Overlay** | The watermark layer | Read-only block reflecting the overlay settings |

Each lane has its own **mute** and **lock** toggle. Locking a lane blocks edits on it
without hiding the blocks — how you protect a finished pass.

Clips carry a *source window* (`in`/`out`) and a *sequence position* (`start`):

```ts
interface Clip {
  id: string;
  sourceRef: string;   // which media file
  inSec: number;       // trim in  (source time)
  outSec: number;      // trim out (source time)
  startSec: number;    // position on the sequence
  speed: number;       // 0.25 – 4
  volume: number;      // 0 – 2
  opacity: number;     // 0 – 1
  muted: boolean;
}
```

`clipDuration = (out - in) / speed`, and the sequence length is the maximum clip end —
there is no separate duration field to drift out of sync. The preview maps sequence time
onto source time with `sequenceToSource()`, so a trim is visible immediately.

### Inspector

Four context tabs. The panel follows what you last touched — tapping a clip opens
**Clip**, tapping a subtitle block opens **Text**.

| Tab | Controls |
| --- | --- |
| **Clip** | Speed presets, trim in/out, opacity, clip volume, split / duplicate / mute / delete |
| **Text** | Per-cue text and timing, subtitle style, SRT import/export, auto-sync, and the **Translate** panel |
| **Audio** | Narration playback and the music-bed level |
| **Effects** | Aspect ratio, watermark layer, and sequence timing against the ceiling |

### Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `S` | Split the selected clip at the playhead |
| `D` | Duplicate the selected clip |
| `Delete` / `Backspace` | Delete the selected clip |
| `←` / `→` | Nudge the playhead 0.1s (hold `Shift` for 1s) |

Shortcuts are ignored while a text field has focus.

## Translating subtitles

The pipeline is **movie → SRT → translation → burn-in**, and it runs from either end of
the app:

- **Upload page** — *Transcribe with AssemblyAI*, pick a language, then *Translate subtitles*.
- **Editor** — Text inspector → *Translate subtitles* → pick a language → *Translate to …*.

### How a translation is stored

Timings live only on `cues`. A translation is a map of cue id to translated text:

```ts
translations: Record<languageCode, Record<cueId, string>>
activeLanguage: string | null   // null = original
```

That is the whole model. Because a translation is keyed by cue id and carries no timings
of its own, it **survives retiming, trimming, splitting and reordering** automatically —
there is no second timeline to keep in sync. `localizeCues()` overlays the map onto the
cue list, and `activeLanguage` is the single switch that drives:

| Surface | Follows the active track |
| --- | --- |
| Timeline subtitle blocks | yes |
| Preview burn-in | yes |
| Narration transcript | yes |
| Exported SRT | yes |
| The rendered MP4's subtitles | yes — `buildPlan()` burns the active cues |

Switch tracks from the **Subtitle track** list in the inspector, or click the language
badge in the editor's top bar to jump back to the original.

### Reliability

The model is asked for a JSON array of exactly the same length as the input. If it breaks
that contract the batch is retried **line by line**, and any line that still fails keeps
its source text. A run therefore never loses a cue and never emits a blank subtitle — at
worst a line stays in the original language, and the UI says how many did:

> *1 of 4 lines came back unchanged and may not be translated.*

Batches are 40 lines. To add a language, extend `LANGUAGES` in
`src/lib/api/gemini.ts` — that array is the only place the list is defined.

## Rendering

`buildCommand()` composes a single `-filter_complex` graph:

```
scale + pad to frame  →  fade in/out  →  burn subtitles (ASS)  →  watermark  →  mix audio
```

`buildAssSubtitles()` writes the cue list as **ASS** rather than SRT, so the burned-in text
carries the studio's styling (font, size, outline, margin) instead of ffmpeg's defaults.

The render runs in five visible stages — loading core, staging files, encoding,
finalising, done — and the three-minute ceiling is enforced twice: the plan is rejected
before encoding, and the argument vector carries a hard `-t 180`. A wasm render that runs
long enough to exhaust memory takes the tab with it, so the guard is deliberately strict.

## Bring your own key

Keys are stored in an AES-GCM-256 vault, derived from a passphrase you choose via
PBKDF2-SHA256 (210k iterations). The passphrase is never persisted and cannot be
recovered. Persistence is either **session only** (cleared when the tab closes) or
**this device**.

| Provider | Used for |
| --- | --- |
| Gemini API | Recap scripting, TTS narration, subtitle translation |
| Google AI Studio | Optional separate quota lane for transcription passes |
| ElevenLabs | Highest-fidelity narration |
| AssemblyAI | Word-level transcription for subtitle sync |

The `ClientRouter` is the only module that reads a key, so provider calls go straight from
your browser to the provider. Set `NEXT_PUBLIC_RELAY_URL` to route them through the bundled
Cloudflare Worker instead.

## Configuration

Everything is optional — the studio runs fully client-side with nothing set. See
`.env.example`.

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_RELAY_URL` | Route provider calls through your Cloudflare Worker |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web config (required to enable auth) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web config (required to enable auth) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web config (required to enable auth) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Realtime Database URL, if a feature reads from RTDB |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Set this to switch Analytics **on**; unset ships no telemetry |
| `ALLOWED_ORIGINS` | (relay) comma-separated origin allow-list |

Auth and Analytics are both opt-in: with the three required Firebase keys absent, sign-in
falls back to a device-local profile and `initAnalytics()` no-ops.

### Deploying to Vercel

```bash
# 1. Link the project (writes .vercel/project.json)
npx vercel link

# 2. Push every variable to production, preview and development
VERCEL_TOKEN=... ./scripts/setup-vercel-env.sh <project-name> [team-scope]

# 3. Redeploy so the values take effect
npx vercel --prod
```

`scripts/setup-vercel-env.sh` upserts each key (create, or update when it already exists)
across all three targets and prints the resulting list. It needs a token that is valid for
the target scope — **Vercel tokens are scope-bound**, so a personal token will not work
against a team project and vice versa. Create one at
<https://vercel.com/account/tokens>.

The Firebase web config values are public by design (they ship to the browser). The Vercel
token is a secret: the script only ever reads it from `$VERCEL_TOKEN` and never writes it
to disk.

## Project layout

```
src/
├── app/
│   ├── (auth)/login/           Google + SMS-OTP sign-in
│   ├── (dashboard)/
│   │   ├── editor/             the NLE
│   │   ├── upload/             intake, transcription, translation, scripting
│   │   └── api-settings/       BYOK vault
│   ├── docs/                   documentation (+ /docs/api-usage)
│   ├── download/               PWA install, FFmpeg core, releases
│   └── about/  offline/  layout.tsx  page.tsx
├── components/
│   ├── ui/                     Button, GlassPanel, AnimatedModal, StatusPill,
│   │                           SecureInput, Segmented, UpdateBadge
│   ├── editor/
│   │   ├── video-timeline.tsx    multitrack surface (ruler, lanes, playhead, trims)
│   │   ├── inspector.tsx         tool rail + Clip / Text / Audio / Effects panels
│   │   ├── preview-stage.tsx     9:16 / 16:9 stage driven by the clip sequence
│   │   ├── subtitle-timeline.tsx cue list + typewriter read-through
│   │   ├── tts-voice-engine.tsx  narration with a live waveform
│   │   ├── media-overlay.tsx     aspect, watermark, subtitle style, music bed
│   │   └── ffmpeg-exporter.tsx   render progress + ceiling meter
│   └── common/                 navbar, floating-dock, page-shell, providers
├── lib/
│   ├── api/                    client-router, gemini, elevenlabs, assemblyai
│   ├── ffmpeg/render-engine.ts filter graph, ASS subtitles, exec
│   ├── firebase/               config, auth
│   └── utils/                  srt-parser, secure-storage (vault), format, cn
└── store/
    ├── use-editor-store.ts     clips, cues, translations, playback
    └── use-api-keys-store.ts   the encrypted key vault
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run fetch:ffmpeg` | Download the FFmpeg core into `public/ffmpeg` |
| `npm run screenshots` | Regenerate the README screenshot (dev server + Playwright) |
| `./scripts/setup-vercel-env.sh` | Push environment variables to Vercel |
| `npm run relay:dev` | Run the Cloudflare Worker relay locally |
| `npm run relay:deploy` | Deploy the relay |

## Deployment

`next build` emits a standalone server. Tag a `v*` commit to publish a GitHub release with
the bundle and the FFmpeg core; see `.github/workflows/build.yml`.

```bash
tar -xzf recap-studio-standalone.tar.gz
cd recap-studio && node server.js   # :3000
```

## Security

- The vault passphrase is never persisted and cannot be recovered.
- The service worker explicitly refuses to cache provider responses or relay traffic.
- The edge relay allow-lists provider hosts and applies a per-IP token bucket.
- In development only, the stores are exposed on `window.__recapStore` for debugging and
  browser automation. The bridge is compiled out of production bundles.

## Known limitations

- **A real end-to-end render has not been exercised in CI.** It needs a browser with
  `SharedArrayBuffer` and an actual video file. The filter graph is unverified at runtime —
  this is the least-proven part of the app.
- The FFmpeg core is not committed (the wasm is ~32 MB). Run `npm run fetch:ffmpeg`, or let
  the engine fall back to the jsDelivr CDN.
- Wasm encoding is CPU-bound, and mobile Safari caps wasm memory lower than desktop.
- YouTube intake registers the source; transcription needs the media file itself.
- Narration for a translated track uses the provider's multilingual voice; there is no
  per-language voice picker yet.

## Licence

MIT.
