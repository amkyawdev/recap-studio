'use client';

import { create } from 'zustand';
import {
  ClientRouter,
  PROVIDERS,
  PROVIDER_ORDER,
  type ProbeResult,
  type ProviderId,
} from '@/lib/api/client-router';
import { vault, type VaultPayload } from '@/lib/utils/secure-storage';

/**
 * Global state for user-provided API credentials.
 *
 * Keys live in the encrypted vault and are mirrored here in memory so React
 * can render masked previews. `keys` is the single source of truth for the
 * router — nothing else may read a key from anywhere.
 */

export type VaultScope = 'session' | 'local';

export interface ApiKeysState {
  hydrated: boolean;
  unlocked: boolean;
  scope: VaultScope;
  keys: Partial<Record<ProviderId, string>>;
  probes: Partial<Record<ProviderId, ProbeResult>>;
  probing: boolean;
  lastProbedAt: number | null;
  error: string | null;
  notice: string | null;

  /** True when a vault already exists on this device. */
  hasVault: (scope?: VaultScope) => boolean;
  unlock: (passphrase: string, scope?: VaultScope) => Promise<boolean>;
  lock: () => void;
  setScope: (scope: VaultScope) => Promise<void>;
  setKey: (provider: ProviderId, value: string) => Promise<void>;
  removeKey: (provider: ProviderId) => Promise<void>;
  clearAll: () => Promise<void>;
  probeAll: () => Promise<void>;
  probeOne: (provider: ProviderId) => Promise<ProbeResult>;
  getRouter: () => ClientRouter;
  dismissMessages: () => void;
}

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL;

export const useApiKeysStore = create<ApiKeysState>((set, get) => ({
  hydrated: false,
  unlocked: false,
  scope: 'session',
  keys: {},
  probes: {},
  probing: false,
  lastProbedAt: null,
  error: null,
  notice: null,

  hasVault: (scope) => vault.exists(scope ?? get().scope),

  unlock: async (passphrase, scope) => {
    const target = scope ?? get().scope;
    try {
      const ok = await vault.unlock(passphrase, target);
      if (!ok) {
        set({ error: 'Wrong passphrase for the existing vault.', unlocked: false });
        return false;
      }
      const entries = vault.entries() as VaultPayload;
      set({
        unlocked: true,
        scope: target,
        keys: pickProviders(entries),
        hydrated: true,
        error: null,
        notice: 'Vault unlocked. Keys are held in memory only.',
      });
      return true;
    } catch (error) {
      set({ error: (error as Error).message, unlocked: false });
      return false;
    }
  },

  lock: () => {
    vault.lock();
    set({ unlocked: false, keys: {}, probes: {}, notice: 'Vault locked.' });
  },

  setScope: async (scope) => {
    const { switchScope } = await import('@/lib/utils/secure-storage');
    await switchScope(scope);
    set({ scope });
  },

  setKey: async (provider, value) => {
    const trimmed = value.trim();
    if (!vault.unlocked) {
      set({ error: 'Unlock the vault before saving keys.' });
      return;
    }
    try {
      if (trimmed) await vault.set(PROVIDERS[provider].slot, trimmed);
      else await vault.remove(PROVIDERS[provider].slot);
      set((state) => {
        const keys = { ...state.keys };
        if (trimmed) keys[provider] = trimmed;
        else delete keys[provider];
        return { keys, error: null };
      });
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  removeKey: async (provider) => {
    try {
      await vault.remove(PROVIDERS[provider].slot);
    } catch {
      /* vault may be locked; still drop the in-memory copy */
    }
    set((state) => {
      const keys = { ...state.keys };
      delete keys[provider];
      const probes = { ...state.probes };
      delete probes[provider];
      return { keys, probes };
    });
  },

  clearAll: async () => {
    vault.destroy(get().scope);
    set({ keys: {}, probes: {}, unlocked: false, lastProbedAt: null, notice: 'All stored keys were destroyed.' });
  },

  probeOne: async (provider) => {
    const result = await get().getRouter().probe(provider);
    set((state) => ({
      probes: { ...state.probes, [provider]: result },
      lastProbedAt: Date.now(),
    }));
    return result;
  },

  probeAll: async () => {
    set({ probing: true });
    try {
      const results = await get().getRouter().probeAll();
      const probes: Partial<Record<ProviderId, ProbeResult>> = {};
      for (const result of results) probes[result.provider] = result;
      set({ probes, lastProbedAt: Date.now(), probing: false });
    } finally {
      set({ probing: false });
    }
  },

  getRouter: () => {
    const { keys } = get();
    return new ClientRouter({
      resolve: (slot) => {
        const entry = (Object.keys(PROVIDERS) as ProviderId[]).find((id) => PROVIDERS[id].slot === slot);
        return entry ? keys[entry] : undefined;
      },
      relayUrl: RELAY_URL,
    });
  },

  dismissMessages: () => set({ error: null, notice: null }),
}));

/** Keep only the vault entries that map onto a known provider. */
function pickProviders(entries: VaultPayload): Partial<Record<ProviderId, string>> {
  const keys: Partial<Record<ProviderId, string>> = {};
  for (const id of PROVIDER_ORDER) {
    const value = entries[PROVIDERS[id].slot];
    if (value) keys[id] = value;
  }
  return keys;
}

/** Convenience selector: how many providers have a key stored. */
export function countConfigured(keys: Partial<Record<ProviderId, string>>): number {
  return PROVIDER_ORDER.filter((id) => Boolean(keys[id])).length;
}
