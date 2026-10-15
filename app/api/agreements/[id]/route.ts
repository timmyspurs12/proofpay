import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError } from '@/lib/server/api';
import { loadAgreementForUser, parseSnapshot } from '@/lib/server/agreements';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const base = await loadAgreementForUser(params.id, me.id);
    const [evidence, disputes, settlements, chainTxs, events] = await Promise.all([
      prisma.evidence.findMany({
        where: { agreementId: params.id },
        include: { submittedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.dispute.findMany({
        where: { agreementId: params.id },
        include: {
          submissions: { orderBy: { createdAt: 'asc' } },
          adjudications: { include: { result: true }, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.settlementInstruction.findMany({ where: { agreementId: params.id }, orderBy: { createdAt: 'desc' } }),
      prisma.blockchainTransaction.findMany({ where: { agreementId: params.id }, orderBy: { createdAt: 'asc' } }),
      prisma.auditEvent.findMany({
        where: {
          OR: [
            { entityType: 'agreement', entityId: params.id },
            { entityType: 'dispute', entityId: { in: await prisma.dispute.findMany({ where: { agreementId: params.id }, select: { id: true } }).then((d) => d.map((x) => x.id)) } },
          ],
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const myRole = base.clientId === me.id ? 'CLIENT' : 'PROVIDER';
    return ok({
      agreement: base,
      versions: base.versions.map((v) => ({ ...v, snapshotParsed: parseSnapshot(v.snapshot), approvedByParsed: JSON.parse(v.approvedBy || '[]') })),
      evidence,
      disputes,
      settlements,
      chainTxs,
      events,
      myRole,
    });
  });
}
