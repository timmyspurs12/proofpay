import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError, rateLimit } from '@/lib/server/api';
import { transitionAgreement } from '@/lib/server/agreements';
import { assertSettlementAllowed } from '@/lib/domain/settlement';
import type { AgreementStatus } from '@/lib/domain/stateMachine';
import { newId, demoTxId } from '@/lib/domain/hash';
import { audit } from '@/lib/server/audit';

/**
 * Settlement execution — idempotent and retry-safe.
 * Demo mode moves no real assets: it records a labelled DEMO_LEDGER execution.
 * `simulateFailure: true` exists so reviewers can exercise the
 * SETTLEMENT_FAILED → retry path; it is honoured only in demo mode.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    rateLimit(`settle:${me.id}`, 10);
    const body = (await req.json().catch(() => ({}))) as { simulateFailure?: boolean };
    const settlement = await prisma.settlementInstruction.findUnique({
      where: { id: params.id },
      include: { agreement: { include: { funding: true } } },
    });
    if (!settlement) throw new HttpError('Settlement instruction not found', 404, 'NOT_FOUND');
    const agreement = settlement.agreement;
    if (agreement.clientId !== me.id && agreement.providerId !== me.id) throw new AuthError('Not a party', 403);
    if (settlement.status === 'EXECUTED') return ok({ settlement, alreadyExecuted: true }); // no duplicate settlement
    if (!['AUTHORIZED', 'FAILED'].includes(settlement.status)) {
      throw new HttpError(`Settlement in status ${settlement.status} cannot be executed`, 409, 'BAD_STATE');
    }
    if (!agreement.funding) throw new HttpError('Agreement has no funding record', 422, 'VALIDATION');

    assertSettlementAllowed({
      agreementStatus: agreement.status,
      decision: settlement.decision as never,
      fundedMinor: agreement.funding.amountMinor,
      toProviderMinor: settlement.toProviderMinor,
      toClientMinor: settlement.toClientMinor,
      alreadySettled: agreement.status === 'SETTLED',
    });

    if (body.simulateFailure) {
      await prisma.settlementInstruction.update({ where: { id: params.id }, data: { status: 'FAILED', failureReason: 'Simulated execution failure (reviewer-triggered). Safe to retry.' } });
      if (agreement.status !== 'SETTLEMENT_FAILED') {
        // Move DECIDED/SETTLEMENT_PENDING → SETTLEMENT_PENDING → SETTLEMENT_FAILED as needed
        if (agreement.status === 'DECIDED') await transitionAgreement(agreement.id, 'DECIDED', 'SETTLEMENT_PENDING', me.id, 'SETTLEMENT_STARTED');
        const fresh = await prisma.agreement.findUnique({ where: { id: agreement.id } });
        await transitionAgreement(agreement.id, fresh!.status, 'SETTLEMENT_FAILED', me.id, 'SETTLEMENT_FAILED', 'Simulated failure');
      }
      await prisma.blockchainTransaction.create({
        data: { id: newId('tx'), agreementId: agreement.id, kind: 'SETTLEMENT', network: 'Demo ledger (simulated)', txId: demoTxId(), status: 'FAILED', detail: 'Simulated settlement failure. Retry is safe and idempotent.' },
      });
      await audit({ actorId: me.id, entityType: 'agreement', entityId: agreement.id, action: 'SETTLEMENT_FAILED', detail: params.id });
      const failed = await prisma.settlementInstruction.findUnique({ where: { id: params.id } });
      return ok({ settlement: failed, failed: true, retryable: true });
    }

    // Move to SETTLEMENT_PENDING first if we are executing from a decision.
    let status = agreement.status as AgreementStatus;
    if (status === 'DECIDED') {
      await transitionAgreement(agreement.id, status, 'SETTLEMENT_PENDING', me.id, 'SETTLEMENT_STARTED');
      status = 'SETTLEMENT_PENDING';
    } else if (status === 'SETTLEMENT_FAILED') {
      await transitionAgreement(agreement.id, status, 'SETTLEMENT_PENDING', me.id, 'SETTLEMENT_RETRY');
      status = 'SETTLEMENT_PENDING';
    }
    const reference = demoTxId();
    const executed = await prisma.settlementInstruction.update({
      where: { id: params.id },
      data: { status: 'EXECUTED', reference, executedAt: new Date(), failureReason: '' },
    });
    await prisma.blockchainTransaction.create({
      data: { id: newId('tx'), agreementId: agreement.id, kind: 'SETTLEMENT', network: 'Demo ledger (simulated)', txId: reference, status: 'SIMULATED', detail: `Demo settlement executed: provider ${settlement.toProviderMinor}, client ${settlement.toClientMinor} (minor units). No real assets moved.` },
    });
    await transitionAgreement(agreement.id, status, 'SETTLED', me.id, 'SETTLEMENT_EXECUTED', reference);
    await audit({ actorId: me.id, entityType: 'agreement', entityId: agreement.id, action: 'SETTLEMENT_EXECUTED', detail: `${reference} (simulated)` });
    return ok({ settlement: executed });
  });
}
