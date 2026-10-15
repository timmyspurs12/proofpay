import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError } from '@/lib/server/api';
import { loadAgreementForUser, transitionAgreement } from '@/lib/server/agreements';
import { audit } from '@/lib/server/audit';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const agreement = await loadAgreementForUser(params.id, me.id);
    if (agreement.providerId !== me.id) throw new AuthError('Only the provider can submit work', 403);
    const body = (await req.json().catch(() => ({}))) as { note?: string };
    await transitionAgreement(params.id, agreement.status, 'SUBMITTED', me.id, 'WORK_SUBMITTED', String(body.note ?? '').slice(0, 1000));
    const updated = await transitionAgreement(params.id, 'SUBMITTED', 'UNDER_REVIEW', me.id, 'REVIEW_STARTED', 'Awaiting client acceptance');
    await audit({ actorId: me.id, entityType: 'agreement', entityId: params.id, action: 'SUBMISSION_NOTE', detail: String(body.note ?? '').slice(0, 500) });
    return ok(updated);
  });
}
