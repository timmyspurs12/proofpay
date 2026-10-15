import { randomBytes } from 'crypto';

/**
 * Wallet-signature login boundary.
 *
 * Flow: client requests a nonce → signs `ProofPay login\nnonce:…\nexpires:…`
 * with the wallet → server verifies the signature, checks expiry and that the
 * nonce was never used (replay protection), then issues the session cookie.
 *
 * The verifier is intentionally isolated: plug in `viem`'s
 * `verifyMessage({ address, message, signature })` (viem is already a
 * transitive dependency of genlayer-js) as `verifySignature`. Until a
 * verifier is configured the endpoint refuses wallet login rather than
 * pretending to verify — demo persona login remains available and labelled.
 */

interface NonceRecord { address: string; expiresAt: number; used: boolean }
const nonces = new Map<string, NonceRecord>();
const NONCE_TTL_MS = 5 * 60 * 1000;

export function issueNonce(address: string): { nonce: string; message: string; expiresAt: number } {
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonces.set(nonce, { address: address.toLowerCase(), expiresAt, used: false });
  return { nonce, message: `ProofPay login\naddress:${address.toLowerCase()}\nnonce:${nonce}\nexpires:${expiresAt}`, expiresAt };
}

export async function consumeNonceAndVerify(params: {
  address: string;
  nonce: string;
  signature: string;
  verifySignature: (args: { address: string; message: string; signature: string }) => Promise<boolean>;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rec = nonces.get(params.nonce);
  if (!rec) return { ok: false, reason: 'Unknown nonce — request a new one.' };
  if (rec.used) return { ok: false, reason: 'Nonce already used (replay rejected).' };
  if (rec.expiresAt < Date.now()) return { ok: false, reason: 'Nonce expired — request a new one.' };
  if (rec.address !== params.address.toLowerCase()) return { ok: false, reason: 'Address does not match the nonce.' };
  rec.used = true; // burn before verification so a bad signature cannot be retried with the same nonce
  const message = `ProofPay login\naddress:${rec.address}\nnonce:${params.nonce}\nexpires:${rec.expiresAt}`;
  const valid = await params.verifySignature({ address: params.address, message, signature: params.signature });
  if (!valid) return { ok: false, reason: 'Signature verification failed.' };
  return { ok: true };
}
