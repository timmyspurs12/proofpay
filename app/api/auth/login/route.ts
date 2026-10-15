import { prisma } from '@/lib/server/db';
import { setSessionCookie } from '@/lib/server/auth';
import { ok, fail, handle, rateLimit } from '@/lib/server/api';

export async function POST(req: Request) {
  return handle(async () => {
    rateLimit('login', 20);
    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    if (!body.userId) return fail('userId is required', 422, 'VALIDATION');
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) return fail('Unknown demo user. Seed the workspace first.', 404, 'NOT_FOUND');
    setSessionCookie(user.id);
    return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });
}
