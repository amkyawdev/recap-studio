/**
 * Dynamic API proxy.
 *
 * Every request the studio makes to an AI provider is routed through here so
 * that exactly one place knows which key belongs to which provider, and the
 * UI can present a single, consistent error surface. Keys are read from the
 * encrypted vault at call time — never module scope, never a bundle.
 *
 * In the browser these calls hit the provider directly (the user owns the
 * key). When the edge relay is configured, `relayUrl` is prepended so the
 * same code path runs against the rate-limited Cloudflare Worker instead.
 */

export type ProviderId = 'gemini' | 'aistudio' | 'elevenlabs' | 'assemblyai';

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  /** Vault slot name. */
  slot: string;
  /** Human hint shown under the input. */
  hint: string;
  /** Placeholder shown in the masked field. */
  placeholder: string;
  docs: string;
  /** Cheap endpoint used by the connection health check. */
  probe: (key: string) => { url: string; init: RequestInit };
  /** Optional extra headers used for provider-specific auth schemes. */
  keyPrefix?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  gemini: {
    id: 'gemini',
    label: 'Gemini API',
    slot: 'gemini',
    hint: 'Used for recap scripting and the Gemini TTS voice engine.',
    placeholder: 'AIza…',
    docs: 'https://aistudio.google.com/app/apikey',
    keyPrefix: '?key=',
    probe: (key) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      init: { method: 'GET' },
    }),
  },
  aistudio: {
    id: 'aistudio',
    label: 'Google AI Studio',
    slot: 'aistudio',
    hint: 'Optional separate quota lane for long-form transcription passes.',
    placeholder: 'AIza…',
    docs: 'https://aistudio.google.com/app/apikey',
    probe: (key) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      init: { method: 'GET' },
    }),
  },
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    slot: 'elevenlabs',
    hint: 'Highest-fidelity narration. Streams MP3 back to the studio.',
    placeholder: 'sk_…',
    docs: 'https://elevenlabs.io/app/settings/api-keys',
    probe: (key) => ({
      url: 'https://api.elevenlabs.io/v1/user/subscription',
      init: { method: 'GET', headers: { 'xi-api-key': key } },
    }),
  },
  assemblyai: {
    id: 'assemblyai',
    label: 'AssemblyAI',
    slot: 'assemblyai',
    hint: 'Word-level timestamps for automated subtitle sync.',
    placeholder: 'aai_…',
    docs: 'https://www.assemblyai.com/app/account',
    probe: (key) => ({
      url: 'https://api.assemblyai.com/v2/transcript?limit=1',
      init: { method: 'GET', headers: { authorization: key } },
    }),
  },
};

export const PROVIDER_ORDER: ProviderId[] = ['gemini', 'aistudio', 'elevenlabs', 'assemblyai'];

export interface KeyResolver {
  (slot: string): string | undefined;
}

export interface RouterOptions {
  resolve: KeyResolver;
  /** Optional Cloudflare Worker relay base (e.g. https://recap-relay.workers.dev). */
  relayUrl?: string;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly provider?: ProviderId,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Turn a provider HTTP status into something a human can act on. */
export function explainStatus(status: number, provider?: ProviderId): string {
  const who = provider ? PROVIDERS[provider].label : 'The provider';
  switch (status) {
    case 400:
      return `${who} rejected the request payload.`;
    case 401:
      return `${who} says the API key is invalid or revoked.`;
    case 402:
      return `${who} requires a paid plan for this endpoint.`;
    case 403:
      return `${who} denied access — check key permissions or region.`;
    case 404:
      return `${who} has no such model or resource.`;
    case 429:
      return `${who} rate limit hit. Quota will reset shortly.`;
    case 500:
    case 502:
    case 503:
      return `${who} is having a moment. Retry in a few seconds.`;
    default:
      return `${who} returned HTTP ${status}.`;
  }
}

export class ClientRouter {
  constructor(private readonly options: RouterOptions) {}

  /** Fetch the key for a provider or throw a user-readable error. */
  keyFor(provider: ProviderId): string {
    const key = this.options.resolve(PROVIDERS[provider].slot);
    if (!key) {
      throw new ApiError(
        `No ${PROVIDERS[provider].label} key configured. Add one in API Settings.`,
        undefined,
        provider,
      );
    }
    return key;
  }

  has(provider: ProviderId): boolean {
    return Boolean(this.options.resolve(PROVIDERS[provider].slot));
  }

  private withRelay(url: string): string {
    const relay = this.options.relayUrl?.replace(/\/$/, '');
    if (!relay) return url;
    return `${relay}/?target=${encodeURIComponent(url)}`;
  }

  /**
   * Issue a request through the relay (when set) with a hard timeout, mapping
   * transport and HTTP failures onto `ApiError`.
   */
  async request(
    provider: ProviderId,
    url: string,
    init: RequestInit = {},
    timeoutMs = this.options.timeoutMs ?? 60_000,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(this.withRelay(url), { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new ApiError(explainStatus(response.status, provider), response.status, provider);
      }
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(`${PROVIDERS[provider].label} timed out after ${timeoutMs / 1000}s.`, 408, provider);
      }
      throw new ApiError(
        `Could not reach ${PROVIDERS[provider].label}. Check your connection or the relay.`,
        undefined,
        provider,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Lightweight health probe used by the connection status pills.
   * Returns a normalised result rather than throwing, so the UI can render
   * "degraded" states without try/catch noise.
   */
  async probe(provider: ProviderId): Promise<ProbeResult> {
    const started = performance.now();
    let key: string;
    try {
      key = this.keyFor(provider);
    } catch (error) {
      return {
        provider,
        state: 'missing',
        latencyMs: 0,
        message: error instanceof Error ? error.message : 'Key missing',
      };
    }

    const { url, init } = PROVIDERS[provider].probe(key);
    try {
      const response = await this.request(provider, url, init, 12_000);
      const latencyMs = Math.round(performance.now() - started);
      const quota = parseQuota(response.headers);
      const exhausted = quota?.remaining === 0;
      return {
        provider,
        state: exhausted ? 'exhausted' : latencyMs > 2500 ? 'degraded' : 'active',
        latencyMs,
        quota,
        message: exhausted ? 'Quota exhausted' : 'Connected',
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - started);
      if (error instanceof ApiError) {
        const state = error.status === 429 ? 'exhausted' : error.status === 401 || error.status === 403 ? 'invalid' : 'offline';
        return { provider, state, latencyMs, message: error.message };
      }
      return { provider, state: 'offline', latencyMs, message: 'Probe failed' };
    }
  }

  async probeAll(): Promise<ProbeResult[]> {
    return Promise.all(PROVIDER_ORDER.map((p) => this.probe(p)));
  }
}

export interface QuotaInfo {
  remaining?: number;
  limit?: number;
  resetSeconds?: number;
}

export type ProbeState = 'active' | 'degraded' | 'exhausted' | 'invalid' | 'missing' | 'offline' | 'unknown';

export interface ProbeResult {
  provider: ProviderId;
  state: ProbeState;
  latencyMs: number;
  quota?: QuotaInfo;
  message: string;
}

/** Read the rate-limit headers providers commonly send back. */
function parseQuota(headers: Headers): QuotaInfo | undefined {
  const remaining = firstHeader(headers, [
    'x-ratelimit-remaining-requests',
    'x-ratelimit-remaining',
    'x-requests-remaining',
  ]);
  const limit = firstHeader(headers, ['x-ratelimit-limit-requests', 'x-ratelimit-limit']);
  const reset = firstHeader(headers, ['x-ratelimit-reset-requests', 'x-ratelimit-reset', 'retry-after']);
  if (remaining === undefined && limit === undefined && reset === undefined) return undefined;
  return {
    remaining: remaining === undefined ? undefined : Number(remaining),
    limit: limit === undefined ? undefined : Number(limit),
    resetSeconds: reset === undefined ? undefined : parseDuration(reset),
  };
}

function firstHeader(headers: Headers, names: string[]): string | undefined {
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null) return value;
  }
  return undefined;
}

/** Accept `30`, `30s`, `1m30s`, `500ms`. */
function parseDuration(raw: string): number {
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const match = /(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/.exec(raw);
  if (!match) return 0;
  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2] ?? 0);
  return Math.round(minutes * 60 + seconds);
}

export const STATE_LABEL: Record<ProbeState, string> = {
  active: 'Active',
  degraded: 'Degraded',
  exhausted: 'Quota out',
  invalid: 'Invalid',
  missing: 'Not set',
  offline: 'Offline',
  unknown: 'Unknown',
};
