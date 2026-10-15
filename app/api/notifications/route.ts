import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError } from '@/lib/server/api';

export async function GET() {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const rows = await prisma.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 30 });
    return ok(rows);
  });
}

export async function POST() {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    await prisma.notification.updateMany({ where: { userId: me.id, read: false }, data: { read: true } });
    return ok({ markedRead: true });
  });
}
