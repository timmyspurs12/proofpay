import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError } from '@/lib/server/api';

export async function GET() {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const mine = { OR: [{ clientId: me.id }, { providerId: me.id }] };
    const [agreements, notifications] = await Promise.all([
      prisma.agreement.findMany({
        where: mine,
        include: {
          client: { select: { id: true, name: true } },
          provider: { select: { id: true, name: true } },
          disputes: { select: { id: true, status: true } },
          settlements: { select: { id: true, status: true, toProviderMinor: true, toClientMinor: true, currency: true, createdAt: true } },
          _count: { select: { evidence: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'desc' }, take: 12 }),
    ]);
    const myAgreementIds = agreements.map((a) => a.id);
    const events = await prisma.auditEvent.findMany({
      where: { OR: [{ entityId: { in: myAgreementIds } }, { actorId: me.id }] },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const fundedStatuses = ['FUNDED', 'SUBMITTED', 'UNDER_REVIEW', 'DISPUTED', 'ADJUDICATING', 'DECIDED', 'ADDITIONAL_EVIDENCE_REQUIRED', 'SETTLEMENT_PENDING', 'SETTLED', 'SETTLEMENT_FAILED'];
    const totalValueMinor = agreements.filter((a) => fundedStatuses.includes(a.status)).reduce((s, a) => s + a.amountMinor, 0);
    const awaitingMyAction = agreements.filter((a) => {
      if (a.status === 'CREATED' && a.clientId === me.id) return true;
      if (a.status === 'FUNDED' && a.providerId === me.id) return true;
      if (a.status === 'UNDER_REVIEW' && a.clientId === me.id) return true;
      if (a.status === 'ADDITIONAL_EVIDENCE_REQUIRED') return true;
      if (a.status === 'SETTLEMENT_FAILED') return true;
      return false;
    });
    const awaitingAcceptance = agreements.filter((a) => a.status === 'UNDER_REVIEW');
    const activeDisputes = agreements.flatMap((a) => a.disputes.filter((d) => ['OPEN', 'EVIDENCE', 'ADJUDICATING', 'NEEDS_EVIDENCE'].includes(d.status)).map((d) => ({ ...d, agreementTitle: a.title, agreementId: a.id })));
    const completedSettlements = agreements.flatMap((a) => a.settlements.filter((s) => s.status === 'EXECUTED').map((s) => ({ ...s, agreementTitle: a.title }))).sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt)).slice(0, 6);
    const distribution = agreements.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {});
    return ok({
      me: { id: me.id, name: me.name, role: me.role },
      metrics: {
        totalValueMinor,
        currency: 'USD',
        awaitingMyAction: awaitingMyAction.length,
        awaitingAcceptance: awaitingAcceptance.length,
        activeDisputes: activeDisputes.length,
        agreementsCount: agreements.length,
      },
      awaitingMyAction,
      activeDisputes,
      completedSettlements,
      distribution,
      agreements: agreements.slice(0, 8),
      events,
      notifications,
    });
  });
}
