import type { Verdict, CriterionFinding } from '../domain/verdict';

/**
 * DEMO Adjudication engine — used only when GenLayer live mode is not
 * configured. It is a deterministic, inspectable evidence-scoring rule set.
 * It is NOT an LLM and NOT a blockchain execution; every record it produces
 * is persisted with mode = DEMO_SIMULATED and labelled in the UI.
 *
 * Rules (also shown to the reviewer in the dispute centre):
 *  - A criterion is MET when the provider linked evidence to it and the
 *    client linked no disputing evidence to it.
 *  - NOT_MET when the client linked disputing evidence and the provider none.
 *  - UNCERTAIN when both or neither linked evidence.
 *  - No provider deliverable evidence at all, or fewer than 2 evidence items
 *    in total → INSUFFICIENT_EVIDENCE (never a fabricated definitive verdict).
 */

export interface DemoEvidenceItem {
  id: string;
  criterionId: string;
  submittedByRole: 'CLIENT' | 'PROVIDER';
  type: string;
  title: string;
}

export function runDemoAdjudication(input: {
  criteria: { id: string; text: string }[];
  evidence: DemoEvidenceItem[];
  allowPartial: boolean;
}): Verdict {
  const { criteria, evidence, allowPartial } = input;
  const providerEvidence = evidence.filter((e) => e.submittedByRole === 'PROVIDER');

  if (evidence.length < 2 || providerEvidence.length === 0) {
    return {
      decision: 'INSUFFICIENT_EVIDENCE',
      providerShareBps: null,
      rationale:
        'Demo adjudication (simulated): the evidence register does not contain enough material to decide. At least one provider deliverable item and one counterparty position are required before any definitive outcome can be considered.',
      evidenceRefs: evidence.map((e) => e.id),
      uncertainties: ['Insufficient evidence submitted by the parties.'],
      criterionFindings: criteria.map((c) => ({
        criterionId: c.id,
        finding: 'UNCERTAIN' as const,
        note: 'No determinate finding possible on the current register.',
      })),
    };
  }

  const findings: CriterionFinding[] = criteria.map((c) => {
    const p = evidence.filter((e) => e.criterionId === c.id && e.submittedByRole === 'PROVIDER');
    const cl = evidence.filter((e) => e.criterionId === c.id && e.submittedByRole === 'CLIENT');
    if (p.length > 0 && cl.length === 0)
      return { criterionId: c.id, finding: 'MET', note: `Provider evidence (${p.map((e) => e.title).join('; ')}) is unrebutted for this criterion.` };
    if (cl.length > 0 && p.length === 0)
      return { criterionId: c.id, finding: 'NOT_MET', note: `Client disputing evidence (${cl.map((e) => e.title).join('; ')}) stands without provider evidence for this criterion.` };
    if (p.length > 0 && cl.length > 0)
      return { criterionId: c.id, finding: 'UNCERTAIN', note: 'Both parties submitted evidence for this criterion; the demo rule set cannot weigh credibility.' };
    return { criterionId: c.id, finding: 'UNCERTAIN', note: 'Neither party linked evidence to this criterion.' };
  });

  const met = findings.filter((f) => f.finding === 'MET').length;
  const notMet = findings.filter((f) => f.finding === 'NOT_MET').length;
  const uncertain = findings.filter((f) => f.finding === 'UNCERTAIN').length;
  const refs = evidence.map((e) => e.id);

  if (uncertain === findings.length) {
    return {
      decision: 'INSUFFICIENT_EVIDENCE',
      providerShareBps: null,
      rationale: 'Demo adjudication (simulated): every criterion is contested or unevidenced, so no definitive outcome is justified. Additional evidence is required.',
      evidenceRefs: refs,
      uncertainties: ['All criteria uncertain on the current register.'],
      criterionFindings: findings,
    };
  }
  if (notMet === 0 && uncertain === 0) {
    return {
      decision: 'SELLER_WINS',
      providerShareBps: null,
      rationale: 'Demo adjudication (simulated): provider evidence covers every acceptance criterion and is unrebutted. Release is authorized under the agreement rules.',
      evidenceRefs: refs,
      uncertainties: [],
      criterionFindings: findings,
    };
  }
  if (met === 0 && uncertain === 0) {
    return {
      decision: 'BUYER_WINS',
      providerShareBps: null,
      rationale: 'Demo adjudication (simulated): the client\'s disputing evidence stands for every criterion and the provider linked no evidence to any criterion. Refund is authorized under the agreement rules.',
      evidenceRefs: refs,
      uncertainties: [],
      criterionFindings: findings,
    };
  }
  if (!allowPartial) {
    return {
      decision: 'INSUFFICIENT_EVIDENCE',
      providerShareBps: null,
      rationale: 'Demo adjudication (simulated): findings are mixed but the agreement does not authorize a partial settlement, so the case requires additional evidence or a party-agreed amendment rather than an imposed split.',
      evidenceRefs: refs,
      uncertainties: ['Mixed findings with partial settlement disabled by the agreement.'],
      criterionFindings: findings,
    };
  }
  const decided = met + notMet;
  const bps = decided === 0 ? 0 : Math.round((met / decided) * 10000);
  return {
    decision: 'PARTIAL_SETTLEMENT',
    providerShareBps: bps,
    rationale: `Demo adjudication (simulated): ${met} of ${decided} decidable criteria are met on unrebutted provider evidence. An authorized split of ${(bps / 100).toFixed(0)}% to the provider reflects the decided criteria.`,
    evidenceRefs: refs,
    uncertainties: uncertain > 0 ? [`${uncertain} criterion/criteria remain uncertain and were excluded from the split base.`] : [],
    criterionFindings: findings,
  };
}
