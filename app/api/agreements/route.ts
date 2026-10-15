import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError } from '@/lib/server/api';
import { validate, isString, isInt, isEnum, isBool } from '@/lib/server/validate';
import { newId } from '@/lib/domain/hash';
import { termsHashOf, type TermsSnapshot } from '@/lib/server/agreements';
import { audit } from '@/lib/server/audit';
import { CURRENCIES } from '@/lib/domain/money';

export async function GET(req: Request) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const status = url.searchParams.get('status') ?? '';
    const rows = await prisma.agreement.findMany({
      where: { OR: [{ clientId: me.id }, { providerId: me.id }] },
      include: {
        client: { select: { id: true, name: true } },
        provider: { select: { id: true, name: true } },
        disputes: { select: { id: true, status: true } },
        _count: { select: { evidence: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const filtered = rows.filter(
      (a) =>
        (!status || a.status === status) &&
        (!q || a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)),
    );
    return ok(filtered);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const body = validate<{
      title: string; description: string; counterpartyId: string; counterpartyRole: 'CLIENT' | 'PROVIDER';
      amountMinor: number; deadline: string; reviewDays: number; evidenceRequirements: string; allowPartial: boolean;
    }>(raw, {
      title: isString(3, 160),
      description: isString(0, 4000),
      counterpartyId: isString(3, 80),
      counterpartyRole: isEnum(['CLIENT', 'PROVIDER'] as const),
      amountMinor: isInt(1, 1_000_000_000_00),
      deadline: isString(8, 40),
      reviewDays: isInt(1, 90),
      evidenceRequirements: isString(0, 2000),
      allowPartial: isBool,
    });
    if (body.counterpartyId === me.id) throw new HttpError('You cannot create an agreement with yourself', 422, 'VALIDATION');
    const counterparty = await prisma.user.findUnique({ where: { id: body.counterpartyId } });
    if (!counterparty) throw new HttpError('Counterparty not found', 404, 'NOT_FOUND');

    const deliverablesIn = Array.isArray(raw.deliverables) ? (raw.deliverables as Record<string, unknown>[]) : [];
    const criteriaIn = Array.isArray(raw.criteria) ? (raw.criteria as Record<string, unknown>[]) : [];
    if (deliverablesIn.length === 0) throw new HttpError('Add at least one deliverable', 422, 'VALIDATION');
    if (criteriaIn.length === 0) throw new HttpError('Add at least one objective acceptance criterion', 422, 'VALIDATION');

    const snapshot: TermsSnapshot = {
      deliverables: deliverablesIn.map((d, i) => ({
        id: String(d.id || `del_${i + 1}`),
        title: String(d.title || '').slice(0, 200),
        description: String(d.description || '').slice(0, 1000),
      })),
      criteria: criteriaIn.map((c, i) => ({
        id: String(c.id || `crit_${i + 1}`),
        deliverableId: String(c.deliverableId || ''),
        text: String(c.text || '').slice(0, 500),
      })),
      evidenceRequirements: body.evidenceRequirements,
      settlementTerms: { allowPartial: body.allowPartial, notes: String(raw.settlementNotes ?? '').slice(0, 1000) },
    };
    if (snapshot.deliverables.some((d) => !d.title)) throw new HttpError('Every deliverable needs a title', 422, 'VALIDATION');
    if (snapshot.criteria.some((c) => !c.text)) throw new HttpError('Every criterion needs text', 422, 'VALIDATION');

    const deadline = new Date(body.deadline);
    if (Number.isNaN(deadline.getTime())) throw new HttpError('Deadline is not a valid date', 422, 'VALIDATION');

    const clientId = body.counterpartyRole === 'CLIENT' ? body.counterpartyId : me.id;
    const providerId = body.counterpartyRole === 'PROVIDER' ? body.counterpartyId : me.id;
    const currency = typeof raw.currency === 'string' && (CURRENCIES as readonly string[]).includes(raw.currency) ? raw.currency : 'USD';

    const agreementId = newId('agr');
    const meta = { title: body.title, amountMinor: body.amountMinor, currency, clientId, providerId, deadline: deadline.toISOString() };
    const termsHash = termsHashOf(snapshot, meta);

    const agreement = await prisma.agreement.create({
      data: {
        id: agreementId,
        title: body.title,
        description: body.description,
        status: 'CREATED',
        clientId,
        providerId,
        amountMinor: body.amountMinor,
        currency,
        deadline,
        reviewDays: body.reviewDays,
        isDemo: true,
      },
    });
    const version = await prisma.agreementVersion.create({
      data: {
        id: newId('ver'),
        agreementId,
        version: 1,
        termsHash,
        snapshot: JSON.stringify(snapshot),
        approvedBy: JSON.stringify([me.id]),
        changeNote: 'Initial terms',
      },
    });
    await prisma.agreement.update({ where: { id: agreementId }, data: { currentVersionId: version.id } });
    await audit({ actorId: me.id, entityType: 'agreement', entityId: agreementId, action: 'AGREEMENT_CREATED', detail: `v1 terms hash ${termsHash.slice(0, 12)}…` });
    return ok({ ...agreement, currentVersionId: version.id }, 201);
  });
}
