import { prisma } from '@/lib/server/db';
import { getSessionUser, roleInAgreement } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError, rateLimit } from '@/lib/server/api';
import { loadAgreementForUser, currentVersion, parseSnapshot } from '@/lib/server/agreements';
import { validate, isString, isEnum, optional } from '@/lib/server/validate';
import { newId, sha256Hex } from '@/lib/domain/hash';
import { audit, notify } from '@/lib/server/audit';

const TYPES = ['GITHUB', 'DEPLOYMENT_URL', 'SCREENSHOT', 'DOCUMENT', 'DELIVERABLE_FILE', 'NOTE'] as const;
const MAX_TEXT = 20000;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    await loadAgreementForUser(params.id, me.id); // 403 for non-parties — protected evidence
    const rows = await prisma.evidence.findMany({
      where: { agreementId: params.id },
      include: { submittedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return ok(rows);
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    rateLimit(`evidence:${me.id}`, 30);
    const agreement = await loadAgreementForUser(params.id, me.id);
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const body = validate<{ type: string; title: string }>(raw, {
      type: isEnum(TYPES),
      title: isString(2, 200),
    });
    const url = optional<string>(raw, 'url', isString(0, 2000)) ?? '';
    const contentText = (optional<string>(raw, 'contentText', isString(0, MAX_TEXT)) ?? '').slice(0, MAX_TEXT);
    const criterionId = optional<string>(raw, 'criterionId', isString(0, 80)) ?? '';
    const disputeId = optional<string>(raw, 'disputeId', isString(0, 80)) ?? '';
    const fileName = optional<string>(raw, 'fileName', isString(0, 200)) ?? '';
    const fileSizeRaw = raw.fileSize;
    const fileSize = typeof fileSizeRaw === 'number' && Number.isInteger(fileSizeRaw) && fileSizeRaw >= 0 && fileSizeRaw <= 25_000_000 ? fileSizeRaw : 0;

    if ((body.type === 'GITHUB' || body.type === 'DEPLOYMENT_URL') && !/^https:\/\//.test(url)) {
      throw new HttpError('Link evidence must be an https:// URL', 422, 'VALIDATION');
    }
    if (body.type === 'NOTE' && contentText.trim().length < 3) throw new HttpError('Written evidence needs content', 422, 'VALIDATION');

    if (criterionId) {
      const snap = parseSnapshot(currentVersion(agreement).snapshot);
      if (!snap.criteria.some((c) => c.id === criterionId)) throw new HttpError('Unknown criterion for the current agreement version', 422, 'VALIDATION');
    }
    if (disputeId) {
      const dispute = await prisma.dispute.findFirst({ where: { id: disputeId, agreementId: params.id } });
      if (!dispute) throw new HttpError('Dispute not found on this agreement', 404, 'NOT_FOUND');
    }

    // Integrity snapshot: hash of the URL + content as submitted. This proves
    // what was submitted, NOT authorship or correctness (surfaced in UI).
    const contentHash = sha256Hex(`${body.type}|${url}|${contentText}|${fileName}`);
    const duplicate = await prisma.evidence.findFirst({ where: { agreementId: params.id, contentHash } });

    const evidence = await prisma.evidence.create({
      data: {
        id: newId('ev'),
        agreementId: params.id,
        disputeId: disputeId || null,
        criterionId,
        type: body.type,
        title: body.title,
        url,
        contentText,
        fileName,
        fileSize,
        contentHash,
        submittedById: me.id,
      },
      include: { submittedBy: { select: { id: true, name: true } } },
    });
    await audit({ actorId: me.id, entityType: 'agreement', entityId: params.id, action: 'EVIDENCE_SUBMITTED', detail: `${evidence.id} (${body.type}) sha256:${contentHash.slice(0, 12)}…` });
    const otherId = agreement.clientId === me.id ? agreement.providerId : agreement.clientId;
    await notify(otherId, 'New evidence submitted', `“${body.title}” was added to “${agreement.title}”.`, `/app/agreements/${params.id}/evidence`);
    void roleInAgreement;
    return ok({ evidence, duplicateWarning: duplicate ? `Identical content hash already recorded as ${duplicate.id} (${duplicate.title}).` : null }, 201);
  });
}
