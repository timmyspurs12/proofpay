import type { DecisionCategory } from './stateMachine';

/**
 * Deterministic settlement rules.
 * An LLM verdict NEVER moves funds directly: it only produces a
 * DecisionCategory (+ optional split). The amounts are computed here,
 * bounded by the funded amount, and require an explicit authorize step.
 * Amounts are integer minor units (e.g. cents).
 */

export interface SettlementComputation {
  toProviderMinor: number;
  toClientMinor: number;
  basis: string;
}

export function computeSettlement(params: {
  decision: DecisionCategory;
  fundedMinor: number;
  /** Provider share in basis points (0–10000). Required for PARTIAL_SETTLEMENT. */
  providerShareBps?: number;
}): SettlementComputation {
  const { decision, fundedMinor, providerShareBps } = params;
  if (!Number.isInteger(fundedMinor) || fundedMinor < 0) {
    throw new Error('fundedMinor must be a non-negative integer (minor units)');
  }
  switch (decision) {
    case 'BUYER_WINS':
      return { toProviderMinor: 0, toClientMinor: fundedMinor, basis: 'Full refund to client per agreement terms.' };
    case 'SELLER_WINS':
      return { toProviderMinor: fundedMinor, toClientMinor: 0, basis: 'Full release to provider per agreement terms.' };
    case 'PARTIAL_SETTLEMENT': {
      if (providerShareBps === undefined || !Number.isInteger(providerShareBps) || providerShareBps < 0 || providerShareBps > 10000) {
        throw new Error('PARTIAL_SETTLEMENT requires providerShareBps in [0, 10000]');
      }
      const toProviderMinor = Math.floor((fundedMinor * providerShareBps) / 10000);
      return {
        toProviderMinor,
        toClientMinor: fundedMinor - toProviderMinor,
        basis: `Authorized split: ${providerShareBps / 100}% to provider, remainder refunded to client.`,
      };
    }
    case 'INSUFFICIENT_EVIDENCE':
      throw new Error('INSUFFICIENT_EVIDENCE cannot authorize a settlement');
  }
}

/** Guard used before any settlement execution. */
export function assertSettlementAllowed(params: {
  agreementStatus: string;
  decision: DecisionCategory;
  fundedMinor: number;
  toProviderMinor: number;
  toClientMinor: number;
  alreadySettled: boolean;
}): void {
  if (params.alreadySettled) throw new Error('Agreement already settled — duplicate settlement blocked');
  if (params.decision === 'INSUFFICIENT_EVIDENCE') throw new Error('Cannot settle on INSUFFICIENT_EVIDENCE');
  if (!['DECIDED', 'UNDER_REVIEW', 'SETTLEMENT_FAILED'].includes(params.agreementStatus)) {
    throw new Error(`Settlement not authorized from status ${params.agreementStatus}`);
  }
  const total = params.toProviderMinor + params.toClientMinor;
  if (total !== params.fundedMinor) {
    throw new Error(`Settlement total ${total} does not equal funded amount ${params.fundedMinor}`);
  }
  if (params.toProviderMinor < 0 || params.toClientMinor < 0) throw new Error('Negative settlement leg');
}
