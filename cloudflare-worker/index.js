/**
 * Recap Studio edge relay — Cloudflare Worker.
 *
 * Purpose: an optional hop between the browser and AI providers that gives you
 * a place for rate limiting, an origin allow-list, and (if you want it)
 * server-side keys. The app works without it; point NEXT_PUBLIC_RELAY_URL at
 * the deployed worker to switch it on.
 *
 * Request shape
 *   GET /?target=<url-encoded absolute https URL>
 *   POST /?target=<url-encoded absolute https URL>   (body forwarded as-is)
 *
 * Security posture
 *   - Only https targets on an explicit host allow-list are proxied.
 *   - Client credentials are passed through untouched; the worker never logs
 *     bodies and never stores keys.
 *   - A per-IP token bucket bounds abuse of your account.
 */

const ALLOWED_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'api.elevenlabs.io',
  'api.assemblyai.com',
  'cdn.jsdelivr.net',
]);

// Headers that must not be forwarded in either direction.
const STRIP_REQUEST = new Set(['host', 'cf-connecting-ip', 'cf-ipcountry', 'x-forwarded-for', 'x-real-ip']);
const STRIP_RESPONSE = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive']);

const RATE = {
  capacity: 60, // burst
  refillPerSecond: 1, // sustained
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return preflight(request, env);

    // Health probe for uptime checks.
    if (url.pathname === '/health') {
      return json({ ok: true, service: 'recap-relay', time: new Date().toISOString() });
    }

    const origin = request.headers.get('origin');
    if (!isAllowedOrigin(origin, env)) {
      return json({ error: 'origin_not_allowed', origin }, 403);
    }

    const target = url.searchParams.get('target');
    if (!target) return json({ error: 'missing_target' }, 400);

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return json({ error: 'invalid_target' }, 400);
    }

    if (targetUrl.protocol !== 'https:') return json({ error: 'insecure_target' }, 400);
    if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
      return json({ error: 'host_not_allowed', host: targetUrl.hostname }, 403);
    }

    // --- rate limit -------------------------------------------------------
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const bucket = await takeToken(env, ip);
    if (!bucket.allowed) {
      return json({ error: 'rate_limited', retryAfter: bucket.retryAfter }, 429, {
        'retry-after': String(bucket.retryAfter),
      });
    }

    // --- forward ----------------------------------------------------------
    const headers = new Headers();
    for (const [key, value] of request.headers) {
      if (!STRIP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
    }
    // Always forward to the allow-listed host; the query string comes from the
    // target URL so provider `?key=` parameters survive intact.
    targetUrl.searchParams.delete('target');

    const init = {
      method: request.method,
      headers,
      redirect: 'follow',
    };
    if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;

    let upstream;
    try {
      upstream = await fetch(targetUrl.toString(), init);
    } catch (error) {
      return json({ error: 'upstream_unreachable', detail: String(error?.message ?? error) }, 502);
    }

    const responseHeaders = new Headers();
    for (const [key, value] of upstream.headers) {
      if (!STRIP_RESPONSE.has(key.toLowerCase())) responseHeaders.set(key, value);
    }
    applyCors(responseHeaders, origin, env);
    responseHeaders.set('x-relay', 'recap-studio');
    responseHeaders.set('x-ratelimit-remaining', String(bucket.remaining));

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

function isAllowedOrigin(origin, env) {
  const configured = (env?.ALLOWED_ORIGINS ?? '*').split(',').map((o) => o.trim()).filter(Boolean);
  if (configured.includes('*')) return true;
  if (!origin) return true; // non-browser clients (curl, CI probes)
  return configured.includes(origin);
}

function applyCors(headers, origin, env) {
  const configured = (env?.ALLOWED_ORIGINS ?? '*').split(',').map((o) => o.trim());
  const allow = configured.includes('*') ? origin ?? '*' : origin ?? configured[0];
  headers.set('access-control-allow-origin', allow);
  headers.set('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set(
    'access-control-allow-headers',
    'authorization,content-type,x-api-key,xi-api-key,accept,x-requested-with',
  );
  headers.set('access-control-max-age', '86400');
  headers.set('vary', 'origin');
}

function preflight(request, env) {
  const headers = new Headers();
  applyCors(headers, request.headers.get('origin'), env);
  return new Response(null, { status: 204, headers });
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });
}

/**
 * Token bucket. Uses the Workers KV namespace bound as RATE_LIMIT when
 * available; falls back to a per-isolate in-memory map for local dev and
 * single-instance deployments.
 */
const memoryBuckets = new Map();

async function takeToken(env, ip) {
  const now = Date.now() / 1000;
  const key = `rl:${ip}`;

  let state;
  if (env?.RATE_LIMIT) {
    state = (await env.RATE_LIMIT.get(key, 'json')) ?? { tokens: RATE.capacity, updated: now };
  } else {
    state = memoryBuckets.get(key) ?? { tokens: RATE.capacity, updated: now };
  }

  const elapsed = Math.max(0, now - state.updated);
  state.tokens = Math.min(RATE.capacity, state.tokens + elapsed * RATE.refillPerSecond);

  const allowed = state.tokens >= 1;
  if (allowed) state.tokens -= 1;
  state.updated = now;

  if (env?.RATE_LIMIT) {
    // KV has no atomic increment; a short TTL bounds drift on a single IP.
    await env.RATE_LIMIT.put(key, JSON.stringify(state), { expirationTtl: 120 });
  } else {
    memoryBuckets.set(key, state);
    if (memoryBuckets.size > 5000) memoryBuckets.clear();
  }

  return {
    allowed,
    remaining: Math.floor(state.tokens),
    retryAfter: allowed ? 0 : Math.ceil((1 - state.tokens) / RATE.refillPerSecond),
  };
}
