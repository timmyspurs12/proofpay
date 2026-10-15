import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError, rateLimit } from '@/lib/server/api';
import { loadAgreementForUser, transitionAgreement, currentVersion, parseSnapshot } from '@/lib/server/agreements';
import { newId, demoTxId } from '@/lib/domain/hash';
import { audit } from '@/lib/server/audit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    rateLimit(`fund:${me.id}`, 10);
    const agreement = await loadAgreementForUser(params.id, me.id);
    if (agreement.clientId !== me.id) throw new AuthError('Only the client can fund this agreement', 403);
    if (!agreement.currentVersionId) throw new HttpError('Agreement has no valid terms version — funding blocked', 422, 'VALIDATION');
    const version = currentVersion(agreement);
    const snapshot = parseSnapshot(version.snapshot);
    if (snapshot.criteria.length === 0 || snapshot.deliverables.length === 0) {
      throw new HttpError('Cannot fund: terms must include deliverables and acceptance criteria', 422, 'VALIDATION');
    }
    const existing = await prisma.fundingRecord.findUnique({ where: { agreementId: params.id } });
    if (existing) return ok({ funding: existing, alreadyFunded: true }); // idempotent

    const reference = demoTxId();
    const funding = await prisma.fundingRecord.create({
      data: {
        id: newId('fund'),
        agreementId: params.id,
        amountMinor: agreement.amountMinor,
        currency: agreement.currency,
        method: 'DEMO_LEDGER',
        status: 'RECORDED',
        reference,
      },
    });
    await prisma.blockchainTransaction.create({
      data: { id: newId('tx'), agreementId: params.id, kind: 'FUNDING', network: 'Demo ledger (simulated)', txId: reference, status: 'SIMULATED', detail: 'Demo funding recorded. No real assets moved.' },
    });
    await transitionAgreement(params.id, agreement.status, 'FUNDED', me.id, 'AGREEMENT_FUNDED', `Demo ledger ref ${reference}`);
    await audit({ actorId: me.id, entityType: 'agreement', entityId: params.id, action: 'FUNDING_RECORDED', detail: reference });
    return ok({ funding }, 201);
  });
}
