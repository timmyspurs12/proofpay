import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle } from '@/lib/server/api';

export async function GET() {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) {
      // Public demo sign-in gate: synthetic personas only. Expose the minimum
      // needed to render the picker (id, name, role) — emails and wallet
      // addresses require an authenticated session (below).
      const users = await prisma.user.findMany({
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      });
      return ok(users.map((u) => ({ ...u, email: '', wallets: [] as { address: string }[] })));
    }
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, wallets: { select: { address: true } } },
      orderBy: { name: 'asc' },
    });
    return ok(users);
  });
}
