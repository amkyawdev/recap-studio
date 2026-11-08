'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ExternalLink,
  Fingerprint,
  KeyRound,
  Lock,
  LockOpen,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageShell, PageHeader } from '@/components/common/page-shell';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Button } from '@/components/ui/button';
import { SecureInput } from '@/components/ui/secure-input';
import { StatusPill } from '@/components/ui/status-pill';
import { Segmented } from '@/components/ui/segmented';
import { AnimatedModal } from '@/components/ui/animated-modal';
import { useApiKeysStore, countConfigured } from '@/store/use-api-keys-store';
import { PROVIDER_ORDER, PROVIDERS, type ProbeResult } from '@/lib/api/client-router';
import { fingerprint, maskSecret } from '@/lib/utils/secure-storage';
import { cn } from '@/lib/utils/cn';

/**
 * BYOK management hub.
 *
 * Keys are held in an AES-GCM vault; this page is the only place that writes
 * to it. Each provider row shows a live connection pill plus, where the
 * provider reports it, a quota-health bar.
 */

export default function ApiSettingsPage() {
  const unlocked = useApiKeysStore((s) => s.unlocked);
  const keys = useApiKeysStore((s) => s.keys);
  const probes = useApiKeysStore((s) => s.probes);
  const probing = useApiKeysStore((s) => s.probing);
  const scope = useApiKeysStore((s) => s.scope);
  const error = useApiKeysStore((s) => s.error);
  const notice = useApiKeysStore((s) => s.notice);
  const unlock = useApiKeysStore((s) => s.unlock);
  const lock = useApiKeysStore((s) => s.lock);
  const setKey = useApiKeysStore((s) => s.setKey);
  const removeKey = useApiKeysStore((s) => s.removeKey);
  const clearAll = useApiKeysStore((s) => s.clearAll);
  const probeAll = useApiKeysStore((s) => s.probeAll);
  const probeOne = useApiKeysStore((s) => s.probeOne);
  const setScope = useApiKeysStore((s) => s.setScope);
  const dismissMessages = useApiKeysStore((s) => s.dismissMessages);
  const hasVault = useApiKeysStore((s) => s.hasVault);

  const [passphrase, setPassphrase] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const configured = countConfigured(keys);
  const vaultExists = useMemo(() => hasVault(scope), [hasVault, scope]);

  const onUnlock = useCallback(async () => {
    if (passphrase.length < 8) return;
    setWorking(true);
    await unlock(passphrase, scope);
    setWorking(false);
    setPassphrase('');
  }, [passphrase, scope, unlock]);

  useEffect(() => {
    if (error || notice) {
      const timer = window.setTimeout(dismissMessages, 4000);
      return () => window.clearTimeout(timer);
    }
  }, [error, notice, dismissMessages]);

  return (
    <PageShell>
      <PageHeader
        kicker="Bring Your Own Key"
        title="API Settings"
        description="Your keys are encrypted in the browser and sent only to the provider you choose. Nothing is proxied through our servers."
        actions={
          <>
            <StatusPill
              state={configured > 0 ? 'active' : 'missing'}
              message={`${configured} of ${PROVIDER_ORDER.length} providers configured`}
            />
            <Button
              size="sm"
              variant="glass"
              icon={RefreshCw}
              loading={probing}
              disabled={!unlocked || configured === 0}
              onClick={() => void probeAll()}
            >
              Test all
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {/* Vault gate */}
          <AnimatePresence initial={false} mode="wait">
            {!unlocked ? (
              <motion.div
                key="locked"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <VaultGate
                  exists={vaultExists}
                  passphrase={passphrase}
                  setPassphrase={setPassphrase}
                  scope={scope}
                  setScope={setScope}
                  onUnlock={onUnlock}
                  working={working}
                />
              </motion.div>
            ) : (
              <motion.div
                key="unlocked"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                {PROVIDER_ORDER.map((id, index) => (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ProviderCard
                      id={id}
                      value={keys[id] ?? ''}
                      probe={probes[id]}
                      onSave={(value) => void setKey(id, value)}
                      onRemove={() => void removeKey(id)}
                      onTest={() => void probeOne(id)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GlassPanel padding="md" className="space-y-3">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <ShieldCheck className="size-4 text-signal-green" />
              Vault status
            </h3>
            <dl className="space-y-2 text-2xs">
              <Row label="State" value={unlocked ? 'Unlocked' : 'Locked'} tone={unlocked ? 'green' : 'muted'} />
              <Row label="Storage" value={scope === 'session' ? 'Session only' : 'This device'} />
              <Row label="Cipher" value="AES-GCM-256" />
              <Row label="Derivation" value="PBKDF2 · 210k" />
              <Row label="Keys stored" value={`${configured} / ${PROVIDER_ORDER.length}`} />
            </dl>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {unlocked ? (
                <Button size="sm" variant="glass" icon={Lock} onClick={lock}>
                  Lock vault
                </Button>
              ) : null}
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmOpen(true)}>
                Wipe all
              </Button>
            </div>
          </GlassPanel>

          <GlassPanel padding="md" grid className="space-y-2">
            <h3 className="kicker flex items-center gap-1.5">
              <Fingerprint className="size-3 text-violet-400" />
              Threat model
            </h3>
            <ul className="space-y-1.5 text-2xs leading-relaxed text-white/45">
              <li>• Keys never touch Recap Studio infrastructure.</li>
              <li>• Ciphertext sits in storage; the passphrase is never persisted.</li>
              <li>• Session scope clears the vault when the tab closes.</li>
              <li>• Provider calls go directly from your browser.</li>
              <li>• Prefer a scoped key with a spend cap where the provider allows it.</li>
            </ul>
          </GlassPanel>

          <GlassPanel padding="md" className="space-y-2">
            <h3 className="kicker">Need a key?</h3>
            <div className="space-y-1.5">
              {PROVIDER_ORDER.map((id) => (
                <a
                  key={id}
                  href={PROVIDERS[id].docs}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-2xs text-white/60 transition-colors hover:border-white/[0.12] hover:text-white"
                >
                  {PROVIDERS[id].label}
                  <ExternalLink className="size-3" />
                </a>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {(error || notice) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              'fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl border px-3.5 py-2.5 text-xs backdrop-blur-xl md:bottom-6',
              error
                ? 'border-signal-red/30 bg-signal-red/[0.12] text-signal-red'
                : 'border-signal-green/30 bg-signal-green/[0.12] text-signal-green',
            )}
          >
            {error ?? notice}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatedModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Destroy the key vault?"
        description="This permanently deletes every stored key from this browser. It cannot be undone."
        footer={
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={Trash2}
              onClick={async () => {
                await clearAll();
                setConfirmOpen(false);
              }}
            >
              Wipe vault
            </Button>
          </div>
        }
      >
        <p className="text-xs leading-relaxed text-white/55">
          You will need to re-enter your provider keys to render or narrate again. Existing renders and
          exports on this device are unaffected.
        </p>
      </AnimatedModal>
    </PageShell>
  );
}

function VaultGate({
  exists,
  passphrase,
  setPassphrase,
  scope,
  setScope,
  onUnlock,
  working,
}: {
  exists: boolean;
  passphrase: string;
  setPassphrase: (value: string) => void;
  scope: 'session' | 'local';
  setScope: (scope: 'session' | 'local') => void;
  onUnlock: () => void;
  working: boolean;
}) {
  const strong = passphrase.length >= 8;
  return (
    <GlassPanel glow="violet" padding="lg" className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-violet-500/25 bg-violet-500/10">
          <KeyRound className="size-5 text-violet-300" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">
            {exists ? 'Unlock your key vault' : 'Create your key vault'}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            {exists
              ? 'Enter the passphrase you set for this device to decrypt your provider keys.'
              : 'Choose a passphrase. It encrypts your provider keys locally — we never see it and cannot reset it.'}
          </p>
        </div>
      </div>

      <SecureInput
        label="Vault passphrase"
        icon={LockOpen}
        value={passphrase}
        placeholder="At least 8 characters"
        onChange={(e) => setPassphrase(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && strong) onUnlock();
        }}
        hint={
          strong ? (
            <span className="text-signal-green">Passphrase length is acceptable.</span>
          ) : (
            'Use 8+ characters. A memorable phrase beats a short password.'
          )
        }
      />

      <div className="space-y-1.5">
        <span className="kicker">Persistence</span>
        <Segmented
          value={scope}
          onChange={(next) => setScope(next)}
          options={[
            { value: 'session', label: 'Session only' },
            { value: 'local', label: 'This device' },
          ]}
        />
      </div>

      <Button
        variant="primary"
        icon={exists ? LockOpen : ShieldCheck}
        loading={working}
        disabled={!strong}
        onClick={onUnlock}
        className="w-full"
        size="lg"
      >
        {exists ? 'Unlock vault' : 'Create vault'}
      </Button>
    </GlassPanel>
  );
}

function ProviderCard({
  id,
  value,
  probe,
  onSave,
  onRemove,
  onTest,
}: {
  id: (typeof PROVIDER_ORDER)[number];
  value: string;
  probe: ProbeResult | undefined;
  onSave: (value: string) => void;
  onRemove: () => void;
  onTest: () => void;
}) {
  const spec = PROVIDERS[id];
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(value);
    setDirty(false);
  }, [value]);

  const valid = draft.trim().length === 0 || draft.trim().length >= 16;
  const quotaPercent =
    probe?.quota?.remaining !== undefined && probe?.quota?.limit
      ? ((probe.quota.limit - probe.quota.remaining) / probe.quota.limit) * 100
      : undefined;

  return (
    <GlassPanel padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.03] font-mono text-2xs text-white/60">
            {spec.label.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h3 className="text-[13px] font-semibold text-white">{spec.label}</h3>
            <p className="text-2xs text-white/40">{spec.hint}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill
            state={probe?.state ?? (value ? 'unknown' : 'missing')}
            latencyMs={probe?.latencyMs}
            message={probe?.message}
            quotaPercent={quotaPercent}
          />
        </div>
      </div>

      <SecureInput
        value={draft}
        placeholder={spec.placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          setDirty(true);
          setSaved(false);
        }}
        fingerprint={value ? `fp ${fingerprint(value)} · ${maskSecret(value)}` : undefined}
        error={!valid ? 'That key looks too short to be valid.' : undefined}
        hint={`Stored locally, sent only to ${spec.label}.`}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="primary"
          disabled={!dirty || !valid}
          icon={CheckCircle2}
          onClick={() => {
            onSave(draft);
            setDirty(false);
            setSaved(true);
          }}
        >
          Save key
        </Button>
        <Button size="sm" variant="glass" icon={RefreshCw} disabled={!value} onClick={onTest}>
          Test connection
        </Button>
        {value && (
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            onClick={() => {
              setDraft('');
              onRemove();
            }}
          >
            Remove
          </Button>
        )}
        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-2xs text-signal-green"
            >
              Saved to vault
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {probe?.state === 'invalid' && (
        <p className="flex items-start gap-1.5 text-2xs text-signal-red">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          {probe.message}
        </p>
      )}
    </GlassPanel>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'muted' }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/40">{label}</dt>
      <dd
        className={cn(
          'mono-num',
          tone === 'green' ? 'text-signal-green' : tone === 'muted' ? 'text-white/60' : 'text-white/75',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
