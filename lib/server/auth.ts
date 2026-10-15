import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from './db';

/**
 * Demo persona session: httpOnly, HMAC-signed cookie containing only a user id
 * and expiry. Production deployments should replace this with wallet-signature
 * auth (see lib/server/walletAuth.ts) or an OIDC provider — the authorization
 * checks below stay identical because they only depend on `getSessionUser`.
 */

const COOKIE = 'proofpay_session';
const SECRET: string = (process.env.SESSION_SECRET as string | undefined) || 'dev-only-secret-change-me';
const TTL_MS = 1000 * 60 * 60 * 12;

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.uid !== 'string' || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const uid = verifySessionToken(cookies().get(COOKIE)?.value);
  if (!uid) return null;
  return prisma.user.findUnique({ where: { id: uid }, include: { wallets: true } });
}

export function setSessionCookie(userId: string) {
  cookies().set(COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_MS / 1000,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

/** Object-level authorization: only the two agreement parties (or their own records). */
export function isParty(userId: string, agreement: { clientId: string; providerId: string }): boolean {
  return agreement.clientId === userId || agreement.providerId === userId;
}

export function roleInAgreement(userId: string, agreement: { clientId: string; providerId: string }): 'CLIENT' | 'PROVIDER' | null {
  if (agreement.clientId === userId) return 'CLIENT';
  if (agreement.providerId === userId) return 'PROVIDER';
  return null;
}
