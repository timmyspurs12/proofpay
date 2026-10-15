import { NextResponse } from 'next/server';
import { ZodError } from './validate';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, code = 'BAD_REQUEST') {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ZodError) return fail(e.message, 422, 'VALIDATION');
    if (e instanceof AuthError) return fail(e.message, e.status, e.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN');
    if (e instanceof HttpError) return fail(e.message, e.status, e.code);
    console.error('[api]', e);
    return fail('Internal error. The operation was not completed; no state was changed on your behalf.', 500, 'INTERNAL');
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message = 'Authentication required', status = 401) {
    super(message);
    this.status = status;
  }
}

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Simple in-memory rate limit (per key). Use Redis in multi-instance production. */
export function rateLimit(key: string, limit = 30, windowMs = 60_000): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  if (b.count > limit) throw new HttpError('Rate limit exceeded. Please retry shortly.', 429, 'RATE_LIMITED');
}
