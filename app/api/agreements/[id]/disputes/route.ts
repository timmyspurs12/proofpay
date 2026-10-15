import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError, rateLimit } from '@/lib/server/api';
import { loadAgreementForUser, transitionAgreement, currentVersion } from '@/lib/server/agreements';
import { validate, isString, optional } from '@/lib/server/validate';
import { newId } from '@/lib/domain/hash';
import { audit, notify } from '@/lib/server/audit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    rateLimit(`dispute:${me.id}`, 10);
    const agreement = await loadAgreementForUser(params.id, me.id);
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const body = validate<{ reason: string }>(raw, { reason: isString(10, 4000) });
    const criterionId = optional<string>(raw, 'criterionId', isString(0, 80)) ?? '';
    const version = currentVersion(agreement); // dispute pins the CURRENT funded version
    const dispute = await prisma.dispute.create({
      data: {
        id: newId('dsp'),
        agreementId: params.id,
        versionId: version.id,
        openedById: me.id,
        reason: body.reason,
        criterionId,
        status: 'OPEN',
      },
    });
    await transitionAgreement(params.id, agreement.status, 'DISPUTED', me.id, 'DISPUTE_OPENED', `${dispute.id} on version v${version.version}`);
    await audit({ actorId: me.id, entityType: 'dispute', entityId: dispute.id, action: 'DISPUTE_OPENED', detail: body.reason.slice(0, 500) });
    const otherId = agreement.clientId === me.id ? agreement.providerId : agreement.clientId;
    await notify(otherId, 'Dispute opened', `A dispute was opened on “${agreement.title}”. Review the evidence and respond.`, `/app/disputes/${dispute.id}`);
    return ok(dispute, 201);
  });
}
