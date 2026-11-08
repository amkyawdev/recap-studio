# FFmpeg.wasm core binaries

The render engine loads its wasm core from this directory at runtime
(`/ffmpeg/ffmpeg-core.js` and `/ffmpeg/ffmpeg-core.wasm`). They are **not**
committed — the wasm binary is ~32 MB, which does not belong in git.

## Fetch them

```bash
npm run fetch:ffmpeg   # or:
curl -L -o public/ffmpeg/ffmpeg-core.js   https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js
curl -L -o public/ffmpeg/ffmpeg-core.wasm https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm
```

The CI workflow (`.github/workflows/build.yml`) downloads them before the build
so release bundles ship with a working offline core.

## Fallback

When these files are absent, `loadEngine()` in
`src/lib/ffmpeg/render-engine.ts` falls back to the jsDelivr CDN build
automatically — the studio still works, it just needs a network connection on
first render.
