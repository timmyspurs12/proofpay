import { prisma } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/auth';
import { ok, handle, AuthError, HttpError, rateLimit } from '@/lib/server/api';
import { parseSnapshot } from '@/lib/server/agreements';
import { newId, demoTxId, snapshotHash } from '@/lib/domain/hash';
import { validateVerdict, enforceEvidenceFloor } from '@/lib/domain/verdict';
import { computeSettlement } from '@/lib/domain/settlement';
import { runDemoAdjudication } from '@/lib/server/demoEngine';
import { genLayerConfig } from '@/lib/genlayer/config';
import { submitAdjudicationOnChain, readVerdictOnChain, fetchTxStatus } from '@/lib/genlayer/client';
import { audit, notify } from '@/lib/server/audit';

async function loadDisputeForUser(id: string, userId: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: { agreement: { include: { versions: true, funding: true } }, submissions: { orderBy: { createdAt: 'asc' } } },
  });
  if (!dispute) throw new HttpError('Dispute not found', 404, 'NOT_FOUND');
  if (dispute.agreement.clientId !== userId && dispute.agreement.providerId !== userId) throw new AuthError('Not a party', 403);
  return dispute;
}

function buildInputs(dispute: Awaited<ReturnType<typeof loadDisputeForUser>>, evidence: { id: string; criterionId: string; type: string; title: string; contentHash: string; submittedById: string; url: string; contentText: string }[]) {
  const version = dispute.agreement.versions.find((v) => v.id === dispute.versionId);
  if (!version) throw new HttpError('Dispute agreement version missing', 500, 'INTERNAL');
  const snap = parseSnapshot(version.snapshot);
  const roleOf = (uid: string) => (uid === dispute.agreement.clientId ? 'CLIENT' : 'PROVIDER') as 'CLIENT' | 'PROVIDER';
  const claimsOf = (uid: string) =>
    dispute.submissions.filter((s) => s.authorId === uid).map((s) => `[${s.kind}] ${s.body}`).join('\n');
  const clientClaim = dispute.openedById === dispute.agreement.clientId ? dispute.reason : claimsOf(dispute.agreement.clientId);
  const providerClaim = claimsOf(dispute.agreement.providerId);
  return { version, snap, roleOf, clientClaim: clientClaim || dispute.reason, providerClaim };
}

async function finalizeWithVerdict(disputeId: string, agreementId: string, requestId: string, rawVerdict: unknown, actorId: string) {
  const checked = validateVerdict(rawVerdict);
  if (!checked.ok) {
    // A verdict outside the permitted schema is REJECTED, never settled on.
    await prisma.adjudicationRequest.update({ where: { id: requestId }, data: { status: 'FAILED' } });
    await audit({ actorId, entityType: 'dispute', entityId: disputeId, action: 'VERDICT_REJECTED', detail: checked.errors.join('; ') });
    throw new HttpError(`Verdict rejected by deterministic validation: ${checked.errors.join('; ')}`, 422, 'VERDICT_INVALID');
  }
  const evidence = await prisma.evidence.findMany({ where: { agreementId } });
  const verdict = enforceEvidenceFloor(checked.verdict, evidence.map((e) => e.id));

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { agreement: { include: { funding: true } } } });
  if (!dispute) throw new HttpError('Dispute not found', 404, 'NOT_FOUND');

  await prisma.adjudicationResult.create({
    data: {
      id: newId('res'),
      requestId,
      decision: verdict.decision,
      providerShareBps: verdict.providerShareBps,
      rationale: verdict.rationale,
      verdictJson: JSON.stringify(verdict),
    },
  });
  await prisma.adjudicationRequest.update({ where: { id: requestId }, data: { status: 'FINALIZED' } });

  if (verdict.decision === 'INSUFFICIENT_EVIDENCE') {
    await prisma.dispute.update({ where: { id: disputeId }, data: { status: 'NEEDS_EVIDENCE' } });
    if (dispute.agreement.status === 'ADJUDICATING') {
      await prisma.agreement.update({ where: { id: agreementId }, data: { status: 'ADDITIONAL_EVIDENCE_REQUIRED' } });
    }
    await audit({ actorId, entityType: 'dispute', entityId: disputeId, action: 'VERDICT_INSUFFICIENT_EVIDENCE', detail: 'No settlement authorized' });
    return { verdict, settlement: null };
  }

  await prisma.dispute.update({ where: { id: disputeId }, data: { status: 'DECIDED' } });
  if (dispute.agreement.status === 'ADJUDICATING' || dispute.agreement.status === 'DISPUTED') {
    await prisma.agreement.update({ where: { id: agreementId }, data: { status: 'DECIDED' } });
  }
  let settlement = null;
  if (dispute.agreement.funding) {
    const amounts = computeSettlement({
      decision: verdict.decision,
      fundedMinor: dispute.agreement.funding.amountMinor,
      providerShareBps: verdict.providerShareBps ?? undefined,
    });
    settlement = await prisma.settlementInstruction.create({
      data: {
        id: newId('set'),
        agreementId,
        disputeId,
        decision: verdict.decision,
        toProviderMinor: amounts.toProviderMinor,
        toClientMinor: amounts.toClientMinor,
        currency: dispute.agreement.currency,
        status: 'AUTHORIZED',
        mode: 'DEMO_LEDGER',
        idempotencyKey: `adj:${requestId}`,
      },
    });
    await audit({ actorId, entityType: 'dispute', entityId: disputeId, action: 'SETTLEMENT_AUTHORIZED', detail: `${settlement.id} ${amounts.basis}` });
  }
  await audit({ actorId, entityType: 'dispute', entityId: disputeId, action: 'VERDICT_RECORDED', detail: verdict.decision });
  await notify(dispute.agreement.clientId, 'Adjudication decision recorded', `Decision: ${verdict.decision} on “${dispute.agreement.title}”.`, `/app/disputes/${disputeId}`);
  await notify(dispute.agreement.providerId, 'Adjudication decision recorded', `Decision: ${verdict.decision} on “${dispute.agreement.title}”.`, `/app/disputes/${disputeId}`);
  return { verdict, settlement };
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    rateLimit(`adjudicate:${me.id}`, 6, 60_000);
    const dispute = await loadDisputeForUser(params.id, me.id);
    const body = (await req.json().catch(() => ({}))) as { idempotencyKey?: string };
    const idempotencyKey = body.idempotencyKey || `adjudicate:${params.id}:${dispute.updatedAt.getTime()}`;

    const existing = await prisma.adjudicationRequest.findUnique({ where: { idempotencyKey }, include: { result: true } });
    if (existing) return ok({ request: existing, alreadyExisted: true }); // duplicate-safe

    const evidence = await prisma.evidence.findMany({ where: { agreementId: dispute.agreementId }, orderBy: { createdAt: 'asc' } });
    const { version, snap, roleOf, clientClaim, providerClaim } = buildInputs(dispute, evidence);
    const hash = snapshotHash({
      versionHash: version.termsHash,
      criteria: snap.criteria,
      evidence: evidence.map((e) => ({ id: e.id, hash: e.contentHash, criterionId: e.criterionId })),
    });
    const cfg = genLayerConfig();

    if (cfg.mode === 'GENLAYER_TESTNET') {
      // Live path: submit the real write, persist PENDING, never block on finality.
      if (dispute.agreement.status === 'DISPUTED') {
        await prisma.agreement.update({ where: { id: dispute.agreementId }, data: { status: 'ADJUDICATING' } });
      }
      await prisma.dispute.update({ where: { id: params.id }, data: { status: 'ADJUDICATING' } });
      const request = await prisma.adjudicationRequest.create({
        data: {
          id: newId('adj'),
          disputeId: params.id,
          agreementId: dispute.agreementId,
          versionId: version.id,
          snapshotHash: hash,
          mode: 'GENLAYER_TESTNET',
          contractAddress: cfg.contractAddress,
          network: cfg.network.label,
          status: 'QUEUED',
          idempotencyKey,
        },
      });
      try {
        const { txId } = await submitAdjudicationOnChain({
          caseId: request.id,
          agreementId: dispute.agreementId,
          versionHash: version.termsHash,
          criteriaJson: JSON.stringify(snap.criteria.map((c) => ({ id: c.id, text: c.text }))),
          evidenceJson: JSON.stringify(
            evidence.map((e) => ({ id: e.id, criterionId: e.criterionId, role: roleOf(e.submittedById), type: e.type, title: e.title, summary: (e.contentText || e.url).slice(0, 1200), contentHash: e.contentHash })),
          ),
          clientClaim,
          providerClaim,
          allowPartial: snap.settlementTerms.allowPartial,
        });
        await prisma.adjudicationRequest.update({ where: { id: request.id }, data: { txId, status: 'PENDING' } });
        await prisma.blockchainTransaction.create({
          data: { id: newId('tx'), agreementId: dispute.agreementId, kind: 'ADJUDICATION', network: cfg.network.label, txId, status: 'PENDING', detail: 'Awaiting GenLayer consensus/finality. Not yet a decision.' },
        });
        await audit({ actorId: me.id, entityType: 'dispute', entityId: params.id, action: 'ADJUDICATION_SUBMITTED', detail: txId });
        return ok({ request: { ...request, txId, status: 'PENDING' }, mode: cfg.mode }, 202);
      } catch (e) {
        await prisma.adjudicationRequest.update({ where: { id: request.id }, data: { status: 'FAILED' } });
        await audit({ actorId: me.id, entityType: 'dispute', entityId: params.id, action: 'ADJUDICATION_SUBMIT_FAILED', detail: String(e).slice(0, 500) });
        throw new HttpError('GenLayer submission failed. No decision was recorded; you can retry safely with the same idempotency key.', 502, 'GENLAYER_SUBMIT_FAILED');
      }
    }

    // Demo path: deterministic simulated adjudication, clearly labelled.
    if (dispute.agreement.status === 'DISPUTED' || dispute.agreement.status === 'ADDITIONAL_EVIDENCE_REQUIRED') {
      await prisma.agreement.update({ where: { id: dispute.agreementId }, data: { status: 'ADJUDICATING' } });
    }
    const txId = demoTxId();
    const request = await prisma.adjudicationRequest.create({
      data: {
        id: newId('adj'),
        disputeId: params.id,
        agreementId: dispute.agreementId,
        versionId: version.id,
        snapshotHash: hash,
        mode: 'DEMO_SIMULATED',
        contractAddress: '',
        network: 'Demo adjudication (simulated — no chain execution)',
        txId,
        status: 'PENDING',
        idempotencyKey,
      },
    });
    await prisma.blockchainTransaction.create({
      data: { id: newId('tx'), agreementId: dispute.agreementId, kind: 'ADJUDICATION', network: 'Demo adjudication (simulated)', txId, status: 'SIMULATED', detail: 'Simulated adjudication. No GenLayer transaction was submitted.' },
    });
    const verdict = runDemoAdjudication({
      criteria: snap.criteria,
      evidence: evidence.map((e) => ({ id: e.id, criterionId: e.criterionId, submittedByRole: roleOf(e.submittedById), type: e.type, title: e.title })),
      allowPartial: snap.settlementTerms.allowPartial,
    });
    const result = await finalizeWithVerdict(params.id, dispute.agreementId, request.id, verdict, me.id);
    const finalRequest = await prisma.adjudicationRequest.findUnique({ where: { id: request.id }, include: { result: true } });
    return ok({ request: finalRequest, ...result, mode: cfg.mode }, 201);
  });
}

/** Poll a live GenLayer adjudication; imports the verdict once finalized. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const me = await getSessionUser();
    if (!me) throw new AuthError();
    const dispute = await loadDisputeForUser(params.id, me.id);
    const body = (await req.json().catch(() => ({}))) as { requestId?: string };
    const request = await prisma.adjudicationRequest.findFirst({ where: { id: body.requestId, disputeId: params.id } });
    if (!request) throw new HttpError('Adjudication request not found', 404, 'NOT_FOUND');
    if (request.mode !== 'GENLAYER_TESTNET') return ok({ request, note: 'Simulated requests finalize immediately.' });
    const { status } = await fetchTxStatus(request.txId);
    if (status === 'UNDETERMINED') {
      await prisma.adjudicationRequest.update({ where: { id: request.id }, data: { status: 'UNDETERMINED' } });
      await prisma.dispute.update({ where: { id: params.id }, data: { status: 'EVIDENCE' } });
      await prisma.agreement.update({ where: { id: dispute.agreementId }, data: { status: 'DISPUTED' } });
      return ok({ request: { ...request, status }, note: 'Consensus undetermined — no state was decided. Parties may add evidence and retry.' });
    }
    if (status !== 'FINALIZED' && status !== 'ACCEPTED') {
      await prisma.adjudicationRequest.update({ where: { id: request.id }, data: { status } });
      return ok({ request: { ...request, status }, note: 'Still awaiting finality. Pending is not a decision.' });
    }
    const verdictJson = await readVerdictOnChain(request.id);
    if (!verdictJson) return ok({ request, note: 'Finalized but verdict not readable yet — retry refresh.' });
    let parsed: unknown;
    try {
      const raw = JSON.parse(verdictJson) as Record<string, unknown>;
      parsed = {
        decision: raw.decision,
        providerShareBps: raw.provider_share_bps ?? null,
        rationale: raw.rationale,
        evidenceRefs: raw.evidence_refs ?? [],
        uncertainties: raw.uncertainties ?? [],
        criterionFindings: ((raw.criterion_findings as Record<string, unknown>[]) ?? []).map((f) => ({ criterionId: f.criterion_id, finding: f.finding, note: f.note })),
      };
    } catch {
      throw new HttpError('On-chain verdict was not valid JSON — rejected, no settlement authorized', 422, 'VERDICT_INVALID');
    }
    const result = await finalizeWithVerdict(params.id, dispute.agreementId, request.id, parsed, me.id);
    void dispute;
    const finalRequest = await prisma.adjudicationRequest.findUnique({ where: { id: request.id }, include: { result: true } });
    return ok({ request: finalRequest, ...result });
  });
}
