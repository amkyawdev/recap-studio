/* Recap Studio service worker.
 *
 * Strategy
 *  - App shell (documents + RSC payloads): network-first, falling back to cache
 *    so a flaky connection still boots the studio.
 *  - Static build assets (/_next/static, icons, fonts): cache-first, they are
 *    content-hashed and immutable.
 *  - FFmpeg core: cache-first with an explicit runtime cache so the ~30 MB wasm
 *    binary survives offline. This is the single most valuable thing to cache.
 *  - Everything else: stale-while-revalidate.
 */

const VERSION = 'v1.0.0';
const SHELL_CACHE = `recap-shell-${VERSION}`;
const STATIC_CACHE = `recap-static-${VERSION}`;
const RUNTIME_CACHE = `recap-runtime-${VERSION}`;
const WASM_CACHE = `recap-ffmpeg-${VERSION}`;

const SHELL_ROUTES = ['/', '/editor', '/upload', '/api-settings', '/download', '/docs', '/about', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Best-effort: a missing route must not abort the install.
      await Promise.allSettled(SHELL_ROUTES.map((route) => cache.add(route)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => ![SHELL_CACHE, STATIC_CACHE, RUNTIME_CACHE, WASM_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept provider APIs or the edge relay — the user's keys and
  // responses must not be written to a cache.
  const isProvider =
    /generativelanguage\.googleapis\.com|api\.elevenlabs\.io|api\.assemblyai\.com|cdn\.jsdelivr\.net/.test(
      url.hostname,
    );
  if (isProvider || url.origin !== self.location.origin) {
    // Exception: allow caching of the FFmpeg core from jsDelivr when it is a
    // large immutable binary, since that is the documented offline path.
    if (url.pathname.endsWith('ffmpeg-core.wasm') || url.pathname.endsWith('ffmpeg-core.js')) {
      event.respondWith(cacheFirst(request, WASM_CACHE));
    }
    return;
  }

  if (url.pathname.startsWith('/ffmpeg/')) {
    event.respondWith(cacheFirst(request, WASM_CACHE));
    return;
  }

  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const fallback = await cache.match(request);
    if (fallback) return fallback;
    throw error;
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match('/offline');
    if (offline) return offline;
    return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
