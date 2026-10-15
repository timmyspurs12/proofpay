import { DECISION_CATEGORIES, type DecisionCategory } from './stateMachine';

/**
 * Structured adjudication verdict — the ONLY shape accepted from either
 * the GenLayer contract or the demo engine. Anything else is rejected
 * server-side (acceptance criterion #6).
 */

export interface CriterionFinding {
  criterionId: string;
  finding: 'MET' | 'NOT_MET' | 'UNCERTAIN';
  note: string;
}

export interface Verdict {
  decision: DecisionCategory;
  /** Provider share 0–10000 bps; only meaningful for PARTIAL_SETTLEMENT. */
  providerShareBps: number | null;
  rationale: string;
  evidenceRefs: string[];
  uncertainties: string[];
  criterionFindings: CriterionFinding[];
}

const FINDINGS = ['MET', 'NOT_MET', 'UNCERTAIN'];

export function validateVerdict(raw: unknown): { ok: true; verdict: Verdict } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null) return { ok: false, errors: ['verdict is not an object'] };
  const v = raw as Record<string, unknown>;

  if (!DECISION_CATEGORIES.includes(v.decision as DecisionCategory)) {
    errors.push(`decision must be one of ${DECISION_CATEGORIES.join(', ')}`);
  }
  if (typeof v.rationale !== 'string' || v.rationale.trim().length < 10) {
    errors.push('rationale must be a string of at least 10 characters');
  }
  if (!Array.isArray(v.evidenceRefs) || v.evidenceRefs.some((r) => typeof r !== 'string')) {
    errors.push('evidenceRefs must be an array of strings');
  }
  if (!Array.isArray(v.uncertainties) || v.uncertainties.some((r) => typeof r !== 'string')) {
    errors.push('uncertainties must be an array of strings');
  }
  if (!Array.isArray(v.criterionFindings)) {
    errors.push('criterionFindings must be an array');
  } else {
    for (const f of v.criterionFindings as Record<string, unknown>[]) {
      if (typeof f?.criterionId !== 'string' || !FINDINGS.includes(String(f?.finding)) || typeof f?.note !== 'string') {
        errors.push('each criterionFinding needs criterionId, finding (MET|NOT_MET|UNCERTAIN) and note');
        break;
      }
    }
  }
  if (v.decision === 'PARTIAL_SETTLEMENT') {
    if (typeof v.providerShareBps !== 'number' || !Number.isInteger(v.providerShareBps) || v.providerShareBps < 0 || v.providerShareBps > 10000) {
      errors.push('PARTIAL_SETTLEMENT requires integer providerShareBps in [0, 10000]');
    }
  } else if (v.providerShareBps !== null && v.providerShareBps !== undefined && v.providerShareBps !== 0) {
    // Non-partial decisions must not smuggle a split.
    if (v.decision === 'BUYER_WINS' && v.providerShareBps !== 0) errors.push('BUYER_WINS must have providerShareBps 0 or null');
    if (v.decision === 'SELLER_WINS' && v.providerShareBps !== 10000) errors.push('SELLER_WINS must have providerShareBps 10000 or null');
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    verdict: {
      decision: v.decision as DecisionCategory,
      providerShareBps: (v.providerShareBps as number | null) ?? null,
      rationale: v.rationale as string,
      evidenceRefs: v.evidenceRefs as string[],
      uncertainties: v.uncertainties as string[],
      criterionFindings: v.criterionFindings as CriterionFinding[],
    },
  };
}

/**
 * Insufficient-evidence guard: a definitive verdict requires at least one
 * evidence reference and at least one non-UNCERTAIN finding. Otherwise the
 * outcome is forced to INSUFFICIENT_EVIDENCE — never fabricated.
 */
export function enforceEvidenceFloor(v: Verdict, availableEvidenceIds: string[]): Verdict {
  const considered = v.evidenceRefs.filter((id) => availableEvidenceIds.includes(id));
  const hasFinding = v.criterionFindings.some((f) => f.finding !== 'UNCERTAIN');
  if (v.decision !== 'INSUFFICIENT_EVIDENCE' && (considered.length === 0 || !hasFinding)) {
    return {
      ...v,
      decision: 'INSUFFICIENT_EVIDENCE',
      providerShareBps: null,
      uncertainties: [...v.uncertainties, 'Downgraded: verdict cited no verifiable evidence or no determinate criterion finding.'],
    };
  }
  return { ...v, evidenceRefs: considered };
}
