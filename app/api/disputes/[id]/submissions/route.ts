import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError } from '@/lib/server/api';
import { validate, isString, isEnum } from '@/lib/server/validate';
import { newId } from '@/lib/domain/hash';
import { audit, notify } from '@/lib/server/audit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const dispute = await prisma.dispute.findUnique({ where: { id: params.id }, include: { agreement: true } });
    if (!dispute) throw new HttpError('Dispute not found', 404, 'NOT_FOUND');
    if (dispute.agreement.clientId !== me.id && dispute.agreement.providerId !== me.id) throw new AuthError('Not a party', 403);
    const body = validate<{ kind: 'CLAIM' | 'REBUTTAL'; body: string }>((await req.json().catch(() => ({}))) as Record<string, unknown>, {
      kind: isEnum(['CLAIM', 'REBUTTAL'] as const),
      body: isString(3, 6000),
    });
    const sub = await prisma.disputeSubmission.create({
      data: { id: newId('sub'), disputeId: params.id, authorId: me.id, kind: body.kind, body: body.body },
    });
    if (dispute.status === 'OPEN') await prisma.dispute.update({ where: { id: params.id }, data: { status: 'EVIDENCE' } });
    await audit({ actorId: me.id, entityType: 'dispute', entityId: params.id, action: `${body.kind}_SUBMITTED`, detail: sub.id });
    const otherId = dispute.agreement.clientId === me.id ? dispute.agreement.providerId : dispute.agreement.clientId;
    await notify(otherId, `New ${body.kind.toLowerCase()} in dispute`, `A ${body.kind.toLowerCase()} was added on “${dispute.agreement.title}”.`, `/app/disputes/${params.id}`);
    return ok(sub, 201);
  });
}
