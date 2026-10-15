import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError } from '@/lib/server/api';
import { loadAgreementForUser, parseSnapshot, termsHashOf, type TermsSnapshot } from '@/lib/server/agreements';
import { newId } from '@/lib/domain/hash';
import { audit } from '@/lib/server/audit';

/**
 * Amendments: allowed only BEFORE funding. After funding the criteria are
 * frozen — the API refuses silent changes (acceptance criterion #2). A funded
 * change requires a new agreement version approved by BOTH parties, recorded
 * here as a PENDING proposal that never alters the funded snapshot.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const agreement = await loadAgreementForUser(params.id, me.id);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    if (!['DRAFT', 'CREATED'].includes(agreement.status)) {
      throw new HttpError(
        `Terms are frozen in status ${agreement.status}. Funded criteria cannot be altered; create a new agreement version with both parties' approval or a new agreement.`,
        409,
        'TERMS_FROZEN',
      );
    }
    const current = agreement.versions[agreement.versions.length - 1];
    const prev = parseSnapshot(current.snapshot);
    const snapshot: TermsSnapshot = {
      deliverables: Array.isArray(body.deliverables)
        ? (body.deliverables as Record<string, unknown>[]).map((d, i) => ({ id: String(d.id || `del_${i + 1}`), title: String(d.title || '').slice(0, 200), description: String(d.description || '').slice(0, 1000) }))
        : prev.deliverables,
      criteria: Array.isArray(body.criteria)
        ? (body.criteria as Record<string, unknown>[]).map((c, i) => ({ id: String(c.id || `crit_${i + 1}`), deliverableId: String(c.deliverableId || ''), text: String(c.text || '').slice(0, 500) }))
        : prev.criteria,
      evidenceRequirements: typeof body.evidenceRequirements === 'string' ? body.evidenceRequirements.slice(0, 2000) : prev.evidenceRequirements,
      settlementTerms: prev.settlementTerms,
    };
    const meta = { title: agreement.title, amountMinor: agreement.amountMinor, currency: agreement.currency, clientId: agreement.clientId, providerId: agreement.providerId, deadline: agreement.deadline.toISOString() };
    const version = await prisma.agreementVersion.create({
      data: {
        id: newId('ver'),
        agreementId: params.id,
        version: current.version + 1,
        termsHash: termsHashOf(snapshot, meta),
        snapshot: JSON.stringify(snapshot),
        approvedBy: JSON.stringify([me.id]),
        changeNote: String(body.changeNote ?? 'Amendment').slice(0, 500),
      },
    });
    await prisma.agreement.update({ where: { id: params.id }, data: { currentVersionId: version.id } });
    await audit({ actorId: me.id, entityType: 'agreement', entityId: params.id, action: 'TERMS_AMENDED', detail: `v${version.version}: ${version.changeNote}` });
    return ok(version, 201);
  });
}
