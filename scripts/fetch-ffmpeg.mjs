#!/usr/bin/env node
/**
 * Download the FFmpeg.wasm core into public/ffmpeg so the studio can render
 * fully offline. Run once after cloning, or let CI do it before a build.
 */

import { mkdir, writeFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const VERSION = '0.12.6';
const BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${VERSION}/dist/umd`;
const FILES = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];
const OUT_DIR = path.resolve('public/ffmpeg');

async function exists(file) {
  try {
    const info = await stat(file);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function download(file) {
  const target = path.join(OUT_DIR, file);
  if ((await exists(target)) && !process.argv.includes('--force')) {
    console.log(`  ${file} already present (use --force to refresh)`);
    return;
  }

  const url = `${BASE}/${file}`;
  process.stdout.write(`-> ${file} ... `);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  const info = await stat(target);
  console.log(`${(info.size / 1024 / 1024).toFixed(1)} MB`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const file of FILES) {
    await download(file);
  }
  await writeFile(path.join(OUT_DIR, '.version'), `${VERSION}\n`, 'utf8');
  console.log(`\nFFmpeg core ${VERSION} ready in public/ffmpeg`);
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`);
  console.error('The studio will fall back to the jsDelivr CDN at runtime.');
  process.exit(1);
});
