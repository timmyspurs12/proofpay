#!/usr/bin/env node
/**
 * On-chain scenario tests against the DEPLOYED ProofPayAdjudicator.
 *
 * Prerequisites: .env has GENLAYER_CONTRACT_ADDRESS (from a verified
 * deployment record in deployments/) and a funded GENLAYER_PRIVATE_KEY
 * on the configured network. Every scenario submits REAL testnet writes;
 * each is polled until a decided state (ACCEPTED/FINALIZED) and verified
 * with txExecutionResultName, then the stored verdict is read back.
 * Results are appended to deployments/onchain-tests-<run>.json AFTER EACH
 * scenario (crash-safe). Set ONLY=A,B,C,D,E to run a subset.
 * Nothing here is simulated.
 *
 * Scenarios:
 *   A accepted delivery   — evidence satisfies criteria → definitive verdict
 *   B disputed delivery   — evidence contradicts criteria → structured outcome
 *   C insufficient        — empty evidence register → INSUFFICIENT_EVIDENCE
 *                           (guaranteed by the contract's deterministic
 *                           evidence floor: with no evidence, cited refs are
 *                           always empty, so any definitive verdict is
 *                           downgraded before storage)
 *   D invalid requests    — empty criteria (deterministic reject) and a
 *                           duplicate adjudication of a decided case
 *   E duplicate settlement — the contract deliberately has NO settlement
 *                           function: it stores an authorization record only.
 *                           Settlement executes off-chain in the backend,
 *                           idempotency-protected (see scripts/e2e-check.mjs).
 *                           On-chain, E verifies the verdict record is stable
 *                           and a decided case cannot be re-decided.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const ADDRESS = env.GENLAYER_CONTRACT_ADDRESS;
if (!ADDRESS) { console.error('GENLAYER_CONTRACT_ADDRESS is not set — deploy first (scripts/deploy-contract.mjs).'); process.exit(1); }
if (!env.GENLAYER_PRIVATE_KEY) { console.error('GENLAYER_PRIVATE_KEY is not set.'); process.exit(1); }

const { createClient, createAccount } = await import('genlayer-js');
const chains = await import('genlayer-js/chains');
const netKey = env.GENLAYER_NETWORK || 'testnetBradbury';
const chain = netKey === 'testnetBradbury' ? chains.testnetBradbury : chains.studionet;
const explorer = netKey === 'testnetBradbury' ? 'https://explorer-bradbury.genlayer.com' : 'https://explorer-studio.genlayer.com';
const account = createAccount(env.GENLAYER_PRIVATE_KEY);
const client = createClient({ chain, account });
const run = process.env.RUN_ID || `t${Date.now().toString(36)}`;
const ONLY = (process.env.ONLY || 'A,B,C,D,E').split(',').map((s) => s.trim());
mkdirSync(join(root, 'deployments'), { recursive: true });
const outFile = join(root, 'deployments', `onchain-tests-${run}.json`);
const results = [];
const decidedCase = { id: null };

function persist() {
  writeFileSync(outFile, JSON.stringify({ contract: ADDRESS, network: netKey, explorer, run, ranAt: new Date().toISOString(), results }, null, 2));
}
function log(s, name, ok, detail, txHash) {
  results.push({ scenario: s, name, ok, detail, txHash: txHash ?? null, explorerTxUrl: txHash ? `${explorer}/tx/${txHash}` : null });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${s}] ${name} — ${detail}${txHash ? `\n   tx: ${txHash}` : ''}`);
  persist();
}

async function waitDecided(txHash, minutes = 25) {
  const deadline = Date.now() + minutes * 60_000;
  for (;;) {
    const tx = await client.getTransaction({ hash: txHash });
    const decided = ['ACCEPTED', 'FINALIZED', 'UNDETERMINED'].includes(tx.statusName ?? '');
    if (decided || Date.now() > deadline) return tx;
    await new Promise((r) => setTimeout(r, 10_000));
  }
}
async function submit(args) {
  const txHash = String(await client.writeContract({ address: ADDRESS, functionName: 'adjudicate', args, value: 0n }));
  const tx = await waitDecided(txHash);
  return { txHash, status: tx.statusName ?? 'UNKNOWN', execution: tx.txExecutionResultName ?? 'UNKNOWN' };
}
const read = (fn, caseId) => client.readContract({ address: ADDRESS, functionName: fn, args: [caseId] });

const CRITERIA = JSON.stringify([
  { id: 'crit_1', text: 'Booking API endpoint is live and documented in the repository.' },
  { id: 'crit_2', text: 'Cancellation refunds the hold within the same request, covered by an automated test.' },
]);
const HASH = 'sha256:demo-testnet-record';

async function scenario(key, fn) {
  if (!ONLY.includes(key)) return;
  try { await fn(); } catch (e) { log(key, 'scenario error', false, String(e?.message ?? e).slice(0, 300), null); }
}

// ---- A: accepted delivery --------------------------------------------------
await scenario('A', async () => {
  const caseId = `${run}-a`;
  const evidence = JSON.stringify([
    { id: 'ev_a1', criterionId: 'crit_1', role: 'PROVIDER', type: 'GITHUB', title: 'Booking API repository', summary: 'Endpoint implemented and documented; README shows booking flow.', contentHash: HASH },
    { id: 'ev_a2', criterionId: 'crit_2', role: 'PROVIDER', type: 'GITHUB', title: 'Cancellation test', summary: 'Automated test asserts hold refund within the same request; test passes.', contentHash: HASH },
  ]);
  const r = await submit([caseId, 'agr_testnet', HASH, CRITERIA, evidence, 'Please review.', 'Delivered as agreed with tests.', true]);
  const verdict = JSON.parse((await read('get_verdict', caseId)) || '{}');
  decidedCase.id = caseId;
  log('A', 'accepted delivery → definitive verdict', r.execution === 'FINISHED_WITH_RETURN' && ['SELLER_WINS', 'PARTIAL_SETTLEMENT'].includes(verdict.decision), `decision=${verdict.decision ?? '(none)'} status=${r.status} execution=${r.execution}`, r.txHash);
});
// ---- B: disputed delivery --------------------------------------------------
await scenario('B', async () => {
  const caseId = `${run}-b`;
  const evidence = JSON.stringify([
    { id: 'ev_b1', criterionId: 'crit_1', role: 'PROVIDER', type: 'GITHUB', title: 'Booking API repository', summary: 'Endpoint implemented and documented.', contentHash: HASH },
    { id: 'ev_b2', criterionId: 'crit_2', role: 'CLIENT', type: 'DOCUMENT', title: 'QA log', summary: 'Cancellation left the hold in place for 24 hours; no automated cancellation test found in the repository.', contentHash: HASH },
  ]);
  const r = await submit([caseId, 'agr_testnet', HASH, CRITERIA, evidence, 'Cancellation does not refund as agreed.', 'Endpoint delivered; test evidence attached.', true]);
  const verdict = JSON.parse((await read('get_verdict', caseId)) || '{}');
  const structured = Array.isArray(verdict.criterion_findings) && verdict.criterion_findings.length > 0;
  if (!decidedCase.id) decidedCase.id = caseId;
  log('B', 'disputed delivery → structured outcome', r.execution === 'FINISHED_WITH_RETURN' && structured && ['BUYER_WINS', 'PARTIAL_SETTLEMENT', 'INSUFFICIENT_EVIDENCE'].includes(verdict.decision), `decision=${verdict.decision ?? '(none)'} findings=${verdict.criterion_findings?.length ?? 0} status=${r.status} execution=${r.execution}`, r.txHash);
});
// ---- C: insufficient evidence ----------------------------------------------
await scenario('C', async () => {
  const caseId = `${run}-c`;
  const r = await submit([caseId, 'agr_testnet', HASH, CRITERIA, '[]', 'Not delivered.', 'Delivered.', true]);
  const verdict = JSON.parse((await read('get_verdict', caseId)) || '{}');
  log('C', 'empty evidence → INSUFFICIENT_EVIDENCE (evidence floor)', verdict.decision === 'INSUFFICIENT_EVIDENCE', `decision=${verdict.decision ?? '(none)'} status=${r.status} execution=${r.execution}`, r.txHash);
});
// ---- D: invalid / duplicate -------------------------------------------------
await scenario('D', async () => {
  const bad = await submit([`${run}-d1`, 'agr_testnet', HASH, '[]', '[]', 'x', 'y', true]);
  log('D', 'empty criteria rejected deterministically', bad.execution === 'FINISHED_WITH_ERROR', `status=${bad.status} execution=${bad.execution}`, bad.txHash);
  const target = decidedCase.id ?? `${run}-a`;
  const dupe = await submit([target, 'agr_testnet', HASH, CRITERIA, '[]', 'again', 'again', true]);
  log('D', 'duplicate adjudication of decided case rejected', dupe.execution === 'FINISHED_WITH_ERROR', `case=${target} status=${dupe.status} execution=${dupe.execution}`, dupe.txHash);
});
// ---- E: verdict/settlement-authorization stability ---------------------------
await scenario('E', async () => {
  const target = decidedCase.id ?? `${run}-a`;
  const status = await read('get_case_status', target);
  const v1 = await read('get_verdict', target);
  const v2 = await read('get_verdict', target);
  log('E', 'decided case stable; one authorization record only (settlement off-chain, idempotent)', status === 'DECIDED' && v1 !== '' && v1 === v2, `case=${target} status=${status}`, null);
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenario checks passed · record: deployments/onchain-tests-${run}.json`);
process.exit(failed.length ? 2 : 0);
