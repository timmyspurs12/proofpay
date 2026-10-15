/**
 * ProofPay agreement lifecycle state machine.
 * Single source of truth for guarded transitions — used by API routes,
 * the demo engine and the unit tests. Settlement guards live in
 * lib/domain/settlement.ts.
 */

export const AGREEMENT_STATUSES = [
  'DRAFT',
  'CREATED',
  'FUNDED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'DISPUTED',
  'ADJUDICATING',
  'DECIDED',
  'ADDITIONAL_EVIDENCE_REQUIRED',
  'SETTLEMENT_PENDING',
  'SETTLED',
  'CANCELLED',
  'EXPIRED',
  'SETTLEMENT_FAILED',
] as const;

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

const TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  DRAFT: ['CREATED', 'CANCELLED'],
  CREATED: ['FUNDED', 'CANCELLED', 'EXPIRED'],
  FUNDED: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['DISPUTED', 'SETTLEMENT_PENDING', 'FUNDED'], // accept → settle; reject → back to funded work
  DISPUTED: ['ADJUDICATING', 'ADDITIONAL_EVIDENCE_REQUIRED', 'CANCELLED'],
  ADJUDICATING: ['DECIDED', 'ADDITIONAL_EVIDENCE_REQUIRED', 'DISPUTED'], // undetermined → back to disputed
  DECIDED: ['SETTLEMENT_PENDING', 'ADDITIONAL_EVIDENCE_REQUIRED'],
  ADDITIONAL_EVIDENCE_REQUIRED: ['DISPUTED', 'ADJUDICATING', 'EXPIRED'],
  SETTLEMENT_PENDING: ['SETTLED', 'SETTLEMENT_FAILED'],
  SETTLEMENT_FAILED: ['SETTLEMENT_PENDING', 'CANCELLED'],
  SETTLED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: AgreementStatus, to: AgreementStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: AgreementStatus, to: AgreementStatus): void {
  if (!canTransition(from, to)) {
    throw new StateTransitionError(from, to);
  }
}

export class StateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal agreement transition: ${from} → ${to}`);
    this.name = 'StateTransitionError';
  }
}

/** Terminal states never leave. */
export const TERMINAL: AgreementStatus[] = ['SETTLED', 'CANCELLED', 'EXPIRED'];

export type DecisionCategory =
  | 'BUYER_WINS'
  | 'SELLER_WINS'
  | 'PARTIAL_SETTLEMENT'
  | 'INSUFFICIENT_EVIDENCE';

export const DECISION_CATEGORIES: DecisionCategory[] = [
  'BUYER_WINS',
  'SELLER_WINS',
  'PARTIAL_SETTLEMENT',
  'INSUFFICIENT_EVIDENCE',
];
