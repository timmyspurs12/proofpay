import { clearSessionCookie } from '@/lib/server/auth';
import { ok, handle } from '@/lib/server/api';

export async function POST() {
  return handle(async () => {
    clearSessionCookie();
    return ok({ signedOut: true });
  });
}
