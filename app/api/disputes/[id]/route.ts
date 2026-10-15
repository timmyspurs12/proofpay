import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError } from '@/lib/server/api';
import { parseSnapshot } from '@/lib/server/agreements';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const dispute = await prisma.dispute.findUnique({
      where: { id: params.id },
      include: {
        agreement: {
          include: {
            client: { select: { id: true, name: true } },
            provider: { select: { id: true, name: true } },
            funding: true,
            versions: true,
          },
        },
        submissions: { orderBy: { createdAt: 'asc' } },
        adjudications: { include: { result: true }, orderBy: { createdAt: 'desc' } },
        settlements: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!dispute) throw new HttpError('Dispute not found', 404, 'NOT_FOUND');
    if (dispute.agreement.clientId !== me.id && dispute.agreement.providerId !== me.id) {
      throw new AuthError('You are not a party to this dispute', 403);
    }
    const evidence = await prisma.evidence.findMany({
      where: { agreementId: dispute.agreementId },
      include: { submittedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const version = dispute.agreement.versions.find((v) => v.id === dispute.versionId);
    const chainTxs = await prisma.blockchainTransaction.findMany({ where: { agreementId: dispute.agreementId }, orderBy: { createdAt: 'asc' } });
    return ok({
      dispute,
      version: version ? { ...version, snapshotParsed: parseSnapshot(version.snapshot) } : null,
      evidence: evidence.map((e) => ({
        ...e,
        role: e.submittedById === dispute.agreement.clientId ? 'CLIENT' : e.submittedById === dispute.agreement.providerId ? 'PROVIDER' : 'OTHER',
      })),
      chainTxs,
      myRole: dispute.agreement.clientId === me.id ? 'CLIENT' : 'PROVIDER',
    });
  });
}
