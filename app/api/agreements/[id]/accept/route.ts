import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError } from '@/lib/server/api';
import { loadAgreementForUser, transitionAgreement } from '@/lib/server/agreements';
import { computeSettlement, assertSettlementAllowed } from '@/lib/domain/settlement';
import { newId } from '@/lib/domain/hash';
import { audit, notify } from '@/lib/server/audit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const agreement = await loadAgreementForUser(params.id, me.id);
    if (agreement.clientId !== me.id) throw new AuthError('Only the client can accept work', 403);
    const body = (await req.json().catch(() => ({}))) as { idempotencyKey?: string };
    const key = body.idempotencyKey || `accept:${params.id}`;
    const existing = await prisma.settlementInstruction.findUnique({ where: { idempotencyKey: key } });
    if (existing) return ok({ settlement: existing, alreadyExisted: true });

    const funding = await prisma.fundingRecord.findUnique({ where: { agreementId: params.id } });
    if (!funding) throw new HttpError('Agreement is not funded', 422, 'VALIDATION');
    const amounts = computeSettlement({ decision: 'SELLER_WINS', fundedMinor: funding.amountMinor });
    assertSettlementAllowed({
      agreementStatus: agreement.status,
      decision: 'SELLER_WINS',
      fundedMinor: funding.amountMinor,
      ...amounts,
      alreadySettled: agreement.status === 'SETTLED',
    });
    const settlement = await prisma.settlementInstruction.create({
      data: {
        id: newId('set'),
        agreementId: params.id,
        decision: 'SELLER_WINS',
        toProviderMinor: amounts.toProviderMinor,
        toClientMinor: amounts.toClientMinor,
        currency: agreement.currency,
        status: 'AUTHORIZED',
        mode: 'DEMO_LEDGER',
        idempotencyKey: key,
      },
    });
    await transitionAgreement(params.id, agreement.status, 'SETTLEMENT_PENDING', me.id, 'WORK_ACCEPTED', 'Client accepted; settlement authorized (not yet executed)');
    await audit({ actorId: me.id, entityType: 'agreement', entityId: params.id, action: 'SETTLEMENT_AUTHORIZED', detail: settlement.id });
    await notify(agreement.providerId, 'Work accepted', `“${agreement.title}” was accepted. Settlement is authorized and pending execution.`, `/app/agreements/${params.id}`);
    return ok({ settlement }, 201);
  });
}
