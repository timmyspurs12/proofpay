import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition } from '@/lib/domain/stateMachine';
import { computeSettlement, assertSettlementAllowed } from '@/lib/domain/settlement';
import { validateVerdict, enforceEvidenceFloor } from '@/lib/domain/verdict';
import { sha256Hex, snapshotHash, isWalletAddress } from '@/lib/domain/hash';
import { runDemoAdjudication } from '@/lib/server/demoEngine';
import { issueNonce, consumeNonceAndVerify } from '@/lib/server/walletAuth';

describe('state machine', () => {
  it('allows the happy path and rejects skips', () => {
    expect(canTransition('CREATED', 'FUNDED')).toBe(true);
    expect(canTransition('FUNDED', 'SUBMITTED')).toBe(true);
    expect(canTransition('UNDER_REVIEW', 'DISPUTED')).toBe(true);
    expect(canTransition('DISPUTED', 'ADJUDICATING')).toBe(true);
    expect(canTransition('DECIDED', 'SETTLEMENT_PENDING')).toBe(true);
    expect(canTransition('SETTLEMENT_PENDING', 'SETTLED')).toBe(true);
    expect(canTransition('CREATED', 'SETTLED')).toBe(false);
    expect(canTransition('SETTLED', 'FUNDED')).toBe(false);
    expect(() => assertTransition('SETTLED', 'DISPUTED')).toThrow(/Illegal agreement transition/);
  });
  it('supports failure and additional-evidence branches', () => {
    expect(canTransition('SETTLEMENT_PENDING', 'SETTLEMENT_FAILED')).toBe(true);
    expect(canTransition('SETTLEMENT_FAILED', 'SETTLEMENT_PENDING')).toBe(true);
    expect(canTransition('ADJUDICATING', 'ADDITIONAL_EVIDENCE_REQUIRED')).toBe(true);
    expect(canTransition('ADDITIONAL_EVIDENCE_REQUIRED', 'ADJUDICATING')).toBe(true);
  });
});

describe('settlement rules (deterministic)', () => {
  it('computes bounded outcomes', () => {
    expect(computeSettlement({ decision: 'BUYER_WINS', fundedMinor: 10000 })).toEqual({ toProviderMinor: 0, toClientMinor: 10000, basis: expect.any(String) });
    expect(computeSettlement({ decision: 'SELLER_WINS', fundedMinor: 10000 }).toProviderMinor).toBe(10000);
    const p = computeSettlement({ decision: 'PARTIAL_SETTLEMENT', fundedMinor: 10001, providerShareBps: 5000 });
    expect(p.toProviderMinor + p.toClientMinor).toBe(10001);
  });
  it('refuses settlement on insufficient evidence and on bad splits', () => {
    expect(() => computeSettlement({ decision: 'INSUFFICIENT_EVIDENCE', fundedMinor: 100 })).toThrow();
    expect(() => computeSettlement({ decision: 'PARTIAL_SETTLEMENT', fundedMinor: 100 })).toThrow(/providerShareBps/);
    expect(() => computeSettlement({ decision: 'PARTIAL_SETTLEMENT', fundedMinor: 100, providerShareBps: 10001 })).toThrow();
  });
  it('blocks duplicates, wrong states and unbalanced totals', () => {
    const base = { decision: 'SELLER_WINS' as const, fundedMinor: 100, toProviderMinor: 100, toClientMinor: 0, alreadySettled: false, agreementStatus: 'DECIDED' };
    expect(() => assertSettlementAllowed(base)).not.toThrow();
    expect(() => assertSettlementAllowed({ ...base, alreadySettled: true })).toThrow(/duplicate/);
    expect(() => assertSettlementAllowed({ ...base, agreementStatus: 'FUNDED' })).toThrow(/not authorized/);
    expect(() => assertSettlementAllowed({ ...base, toClientMinor: 5 })).toThrow(/does not equal/);
  });
});

describe('verdict schema validation', () => {
  const good = { decision: 'SELLER_WINS', providerShareBps: null, rationale: 'Evidence covers every criterion.', evidenceRefs: ['ev1'], uncertainties: [], criterionFindings: [{ criterionId: 'crit_1', finding: 'MET', note: 'ok' }] };
  it('accepts a well-formed verdict', () => {
    expect(validateVerdict(good).ok).toBe(true);
  });
  it('rejects verdicts outside the permitted schema (#6)', () => {
    expect(validateVerdict({ ...good, decision: 'PROVIDER_PARTIALLY_RIGHT' }).ok).toBe(false);
    expect(validateVerdict({ ...good, rationale: 'short' }).ok).toBe(false);
    expect(validateVerdict({ decision: 'PARTIAL_SETTLEMENT', providerShareBps: 99999, rationale: 'x'.repeat(20), evidenceRefs: [], uncertainties: [], criterionFindings: [] }).ok).toBe(false);
    expect(validateVerdict('BUYER_WINS').ok).toBe(false);
    expect(validateVerdict(null).ok).toBe(false);
  });
  it('forces INSUFFICIENT_EVIDENCE when no evidence is cited (#5)', () => {
    const downgraded = enforceEvidenceFloor(
      { decision: 'SELLER_WINS', providerShareBps: null, rationale: 'Trust me.', evidenceRefs: [], uncertainties: [], criterionFindings: [{ criterionId: 'crit_1', finding: 'MET', note: '' }] },
      ['ev1'],
    );
    expect(downgraded.decision).toBe('INSUFFICIENT_EVIDENCE');
    const uncited = enforceEvidenceFloor(
      { decision: 'BUYER_WINS', providerShareBps: null, rationale: 'Cites a fake id.', evidenceRefs: ['ev_fake'], uncertainties: [], criterionFindings: [{ criterionId: 'crit_1', finding: 'NOT_MET', note: '' }] },
      ['ev1'],
    );
    expect(uncited.decision).toBe('INSUFFICIENT_EVIDENCE');
  });
});

describe('demo adjudication engine', () => {
  const criteria = [{ id: 'crit_1', text: 'A' }, { id: 'crit_2', text: 'B' }];
  it('returns INSUFFICIENT_EVIDENCE on an empty register', () => {
    const v = runDemoAdjudication({ criteria, evidence: [], allowPartial: true });
    expect(v.decision).toBe('INSUFFICIENT_EVIDENCE');
  });
  it('awards the seller when provider evidence is unrebutted', () => {
    const v = runDemoAdjudication({
      criteria,
      allowPartial: true,
      evidence: [
        { id: 'e1', criterionId: 'crit_1', submittedByRole: 'PROVIDER', type: 'NOTE', title: 'a' },
        { id: 'e2', criterionId: 'crit_2', submittedByRole: 'PROVIDER', type: 'NOTE', title: 'b' },
      ],
    });
    expect(v.decision).toBe('SELLER_WINS');
  });
  it('splits only when authorized and mixed', () => {
    const ev = [
      { id: 'e1', criterionId: 'crit_1', submittedByRole: 'PROVIDER' as const, type: 'NOTE', title: 'a' },
      { id: 'e2', criterionId: 'crit_2', submittedByRole: 'CLIENT' as const, type: 'NOTE', title: 'b' },
    ];
    expect(runDemoAdjudication({ criteria, evidence: ev, allowPartial: false }).decision).toBe('INSUFFICIENT_EVIDENCE');
    const v = runDemoAdjudication({ criteria, evidence: ev, allowPartial: true });
    expect(v.decision).toBe('PARTIAL_SETTLEMENT');
    expect(v.providerShareBps).toBe(5000);
  });
});

describe('hashing & snapshot integrity', () => {
  it('is stable regardless of key order', () => {
    expect(snapshotHash({ b: 1, a: [1, 2] })).toBe(snapshotHash({ a: [1, 2], b: 1 }));
    expect(sha256Hex('proofpay')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('validates wallet addresses', () => {
    expect(isWalletAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe(true);
    expect(isWalletAddress('not-a-wallet')).toBe(false);
  });
});

describe('wallet nonce replay protection', () => {
  it('burns nonces and rejects replays', async () => {
    const { nonce } = issueNonce('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
    const verify = async () => true;
    const first = await consumeNonceAndVerify({ address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', nonce, signature: 'sig', verifySignature: verify });
    expect(first.ok).toBe(true);
    const replay = await consumeNonceAndVerify({ address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', nonce, signature: 'sig', verifySignature: verify });
    expect(replay.ok).toBe(false);
  });
});
