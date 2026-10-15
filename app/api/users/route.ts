import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError } from '@/lib/server/api';

export async function GET() {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, wallets: { select: { address: true } } },
      orderBy: { name: 'asc' },
    });
    return ok(users);
  });
}
