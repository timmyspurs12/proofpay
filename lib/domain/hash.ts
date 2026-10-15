import { createHash, randomUUID } from 'crypto';

/** SHA-256 content hash for evidence integrity metadata. */
export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Stable snapshot hash of adjudication inputs (criteria + evidence refs). */
export function snapshotHash(payload: unknown): string {
  return sha256Hex(stableStringify(payload));
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

/** Demo/simulated identifiers are unmistakable by construction. */
export function demoTxId(): string {
  return `demo-tx-${randomUUID().slice(0, 8)}`;
}

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
export function isWalletAddress(v: string): boolean {
  return WALLET_RE.test(v.trim());
}

export function shortHash(h: string, n = 10): string {
  return h.length > n * 2 + 3 ? `${h.slice(0, n)}…${h.slice(-n)}` : h;
}
