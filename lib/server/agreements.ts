import { prisma } from './db';
import { AuthError, HttpError } from './api';
import { isParty } from './auth';
import { assertTransition, type AgreementStatus } from '../domain/stateMachine';
import { audit } from './audit';
import { newId, sha256Hex, stableStringify } from '../domain/hash';

export interface TermsSnapshot {
  deliverables: { id: string; title: string; description: string }[];
  criteria: { id: string; deliverableId: string; text: string }[];
  evidenceRequirements: string;
  settlementTerms: { allowPartial: boolean; notes: string };
}

export function termsHashOf(snapshot: TermsSnapshot, meta: Record<string, unknown>): string {
  return sha256Hex(stableStringify({ snapshot, meta }));
}

export async function loadAgreementForUser(id: string, userId: string) {
  const agreement = await prisma.agreement.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, email: true } },
      provider: { select: { id: true, name: true, email: true } },
      versions: { orderBy: { version: 'asc' } },
      funding: true,
    },
  });
  if (!agreement) throw new HttpError('Agreement not found', 404, 'NOT_FOUND');
  if (!isParty(userId, agreement)) throw new AuthError('You are not a party to this agreement', 403);
  return agreement;
}

export async function transitionAgreement(
  agreementId: string,
  from: string,
  to: AgreementStatus,
  actorId: string,
  action: string,
  detail = '',
) {
  assertTransition(from as AgreementStatus, to);
  const updated = await prisma.agreement.update({ where: { id: agreementId }, data: { status: to } });
  await audit({ actorId, entityType: 'agreement', entityId: agreementId, action, detail: detail || `${from} → ${to}` });
  return updated;
}

export function currentVersion<V extends { id: string; version: number; snapshot: string }>(a: { versions: V[]; currentVersionId: string | null }): V {
  const found = a.versions.find((v) => v.id === a.currentVersionId) ?? a.versions[a.versions.length - 1];
  if (!found) throw new Error('Agreement has no terms version');
  return found;
}

export function parseSnapshot(json: string): TermsSnapshot {
  try {
    const s = JSON.parse(json);
    return {
      deliverables: Array.isArray(s.deliverables) ? s.deliverables : [],
      criteria: Array.isArray(s.criteria) ? s.criteria : [],
      evidenceRequirements: String(s.evidenceRequirements ?? ''),
      settlementTerms: {
        allowPartial: Boolean(s.settlementTerms?.allowPartial),
        notes: String(s.settlementTerms?.notes ?? ''),
      },
    };
  } catch {
    return { deliverables: [], criteria: [], evidenceRequirements: '', settlementTerms: { allowPartial: false, notes: '' } };
  }
}

export { newId };
