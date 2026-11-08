/**
 * Client-side encrypted vault for user-supplied API keys (BYOK).
 *
 * Threat model: keys never leave the device except as a direct request to the
 * provider the user chose. They are encrypted at rest with AES-GCM-256, keyed
 * by PBKDF2-SHA256 from a passphrase the user types. Nothing here replaces a
 * server-side secret manager — it removes the *plaintext* copy from disk.
 *
 * Persistence is either `local` (survives reload) or `session` (cleared when
 * the tab closes). Session mode is the default in the UI.
 */

const PBKDF2_ITERATIONS = 210_000;
const STORAGE_KEY = 'recap-studio.vault.v1';
const SESSION_KEY = 'recap-studio.vault.session.v1';

type VaultScope = 'local' | 'session';

interface VaultEnvelope {
  v: 1;
  scope: VaultScope;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64 ciphertext
  updatedAt: number;
}

function getStore(scope: VaultScope): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return scope === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function storageKeyFor(scope: VaultScope) {
  return scope === 'session' ? SESSION_KEY : STORAGE_KEY;
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export type VaultPayload = Record<string, string>;

/**
 * Passphrase-gated encrypted store. Call `unlock()` before any read/write.
 */
export class SecureVault {
  private key: CryptoKey | null = null;
  private scope: VaultScope;
  private cache: VaultPayload | null = null;

  constructor(scope: VaultScope = 'session') {
    this.scope = scope;
  }

  get unlocked() {
    return this.key !== null;
  }

  getScope() {
    return this.scope;
  }

  /** True when a ciphertext envelope already exists for this scope. */
  exists(scope: VaultScope = this.scope): boolean {
    const store = getStore(scope);
    return Boolean(store?.getItem(storageKeyFor(scope)));
  }

  private readEnvelope(scope: VaultScope): VaultEnvelope | null {
    const store = getStore(scope);
    const raw = store?.getItem(storageKeyFor(scope));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as VaultEnvelope;
      if (parsed?.v !== 1 || !parsed.ct || !parsed.iv || !parsed.salt) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** Create a brand-new vault protected by `passphrase`. */
  async create(passphrase: string, scope: VaultScope = this.scope, initial: VaultPayload = {}) {
    this.scope = scope;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    this.key = await deriveKey(passphrase, salt);
    this.cache = { ...initial };
    await this.persist(salt);
  }

  /** Open an existing vault. Resolves false when the passphrase is wrong. */
  async unlock(passphrase: string, scope: VaultScope = this.scope): Promise<boolean> {
    this.scope = scope;
    const envelope = this.readEnvelope(scope);
    if (!envelope) {
      // No vault yet — treat the passphrase as a new vault creation.
      await this.create(passphrase, scope);
      return true;
    }
    try {
      const key = await deriveKey(passphrase, fromBase64(envelope.salt));
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(envelope.iv) as unknown as BufferSource },
        key,
        fromBase64(envelope.ct) as unknown as BufferSource,
      );
      this.key = key;
      this.cache = JSON.parse(new TextDecoder().decode(plaintext)) as VaultPayload;
      return true;
    } catch {
      this.key = null;
      this.cache = null;
      return false;
    }
  }

  lock() {
    this.key = null;
    this.cache = null;
  }

  private requireKey(): CryptoKey {
    if (!this.key) throw new Error('Vault is locked. Call unlock() first.');
    return this.key;
  }

  private async persist(salt?: Uint8Array) {
    const store = getStore(this.scope);
    if (!store) return;
    const envelope = this.readEnvelope(this.scope);
    const useSalt = salt ?? (envelope ? fromBase64(envelope.salt) : crypto.getRandomValues(new Uint8Array(16)));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = this.requireKey();
    const encoded = new TextEncoder().encode(JSON.stringify(this.cache ?? {}));
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      encoded as unknown as BufferSource,
    );
    const next: VaultEnvelope = {
      v: 1,
      scope: this.scope,
      salt: toBase64(useSalt),
      iv: toBase64(iv),
      ct: toBase64(ct),
      updatedAt: Date.now(),
    };
    store.setItem(storageKeyFor(this.scope), JSON.stringify(next));
  }

  /** All key/value pairs currently held (empty object when locked). */
  entries(): VaultPayload {
    return { ...(this.cache ?? {}) };
  }

  get(name: string): string | undefined {
    return this.cache?.[name];
  }

  async set(name: string, value: string) {
    this.requireKey();
    this.cache = { ...(this.cache ?? {}), [name]: value };
    await this.persist();
  }

  async setMany(patch: VaultPayload) {
    this.requireKey();
    this.cache = { ...(this.cache ?? {}), ...patch };
    await this.persist();
  }

  async remove(name: string) {
    this.requireKey();
    if (!this.cache) return;
    const next = { ...this.cache };
    delete next[name];
    this.cache = next;
    await this.persist();
  }

  /** Wipe the ciphertext from storage and drop the in-memory key. */
  destroy(scope: VaultScope = this.scope) {
    getStore(scope)?.removeItem(storageKeyFor(scope));
    this.key = null;
    this.cache = null;
  }
}

export const vault = new SecureVault('session');

/** Change the active persistence scope, re-encrypting the current contents. */
export async function switchScope(next: VaultScope): Promise<void> {
  if (!vault.unlocked) {
    (vault as unknown as { scope: VaultScope }).scope = next;
    return;
  }
  const payload = vault.entries();
  const key = (vault as unknown as { key: CryptoKey }).key;
  (vault as unknown as { scope: VaultScope }).scope = next;
  (vault as unknown as { key: CryptoKey }).key = key;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoded as unknown as BufferSource,
  );
  const store = getStore(next);
  store?.setItem(
    storageKeyFor(next),
    JSON.stringify({
      v: 1,
      scope: next,
      salt: toBase64(salt),
      iv: toBase64(iv),
      ct: toBase64(ct),
      updatedAt: Date.now(),
    } satisfies VaultEnvelope),
  );
  // Drop the previous scope's copy so only one lives at a time.
  const other: VaultScope = next === 'session' ? 'local' : 'session';
  getStore(other)?.removeItem(storageKeyFor(other));
}

/**
 * Derive a short, stable fingerprint of a secret for display ("sk-…a91f").
 * Never renders enough material to reconstruct the key.
 */
export function maskSecret(secret: string): string {
  const trimmed = secret.trim();
  if (!trimmed) return '—';
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}${'•'.repeat(4)}`;
  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-4);
  return `${head}${'•'.repeat(Math.min(12, trimmed.length - 8))}${tail}`;
}

/** Cheap, synchronous FNV-1a hash used for the on-screen fingerprint only. */
export function fingerprint(secret: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < secret.length; i += 1) {
    h ^= secret.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
