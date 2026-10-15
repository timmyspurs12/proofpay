#!/usr/bin/env node
/**
 * ProofPayAdjudicator deployment — GenLayer Bradbury testnet (chain 4221).
 *
 * Usage:
 *   node scripts/deploy-contract.mjs            # dry-run: verify config, network, balance; submit NOTHING
 *   node scripts/deploy-contract.mjs --execute  # deploy, wait for FINALIZED, verify execution result
 *
 * Safety:
 * - Reads the signer ONLY from .env (GENLAYER_PRIVATE_KEY). Never prints it.
 * - Verifies the live chain ID over RPC before signing anything.
 * - Refuses to deploy twice from the same source hash when a successful
 *   deployment record already exists in deployments/ (override: --force).
 * - Success requires status FINALIZED/ACCEPTED AND txExecutionResultName
 *   FINISHED_WITH_RETURN — a submitted or finalized tx alone is not success.
 * - Records a full deployment record to deployments/<network>-<timestamp>.json.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const execute = process.argv.includes('--execute');
const force = process.argv.includes('--force');

// ---- env (parse .env manually; no secret printing) ------------------------
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const networkKey = env.GENLAYER_NETWORK || 'testnetBradbury';
const NETWORKS = {
  testnetBradbury: { label: 'GenLayer Testnet Bradbury', rpc: 'https://rpc-bradbury.genlayer.com', chainRpc: 'https://rpc.testnet-chain.genlayer.com', chainId: 4221, explorer: 'https://explorer-bradbury.genlayer.com' },
  studionet: { label: 'GenLayer Studionet', rpc: 'https://studio.genlayer.com/api', chainRpc: 'https://studio.genlayer.com/api', chainId: 61999, explorer: 'https://explorer-studio.genlayer.com' },
};
const net = NETWORKS[networkKey];
if (!net) { console.error(`Unknown GENLAYER_NETWORK=${networkKey}`); process.exit(1); }

const sourcePath = 'contracts/proofpay_adjudicator.py';
const code = readFileSync(join(root, sourcePath), 'utf8');
const sourceSha256 = createHash('sha256').update(code).digest('hex');
const sdkPkg = JSON.parse(readFileSync(join(root, 'node_modules/genlayer-js/package.json'), 'utf8'));

async function rpc(url, method, params) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const json = await res.json();
  if (json.error) throw new Error(`${method} -> ${JSON.stringify(json.error)}`);
  return json.result;
}

const { createClient, createAccount } = await import('genlayer-js');
const chains = await import('genlayer-js/chains');
const chain = networkKey === 'testnetBradbury' ? chains.testnetBradbury : chains.studionet;

// ---- preflight -------------------------------------------------------------
const liveChainId = parseInt(await rpc(net.chainRpc, 'eth_chainId', []), 16);
if (liveChainId !== net.chainId) { console.error(`CHAIN MISMATCH: expected ${net.chainId}, RPC reports ${liveChainId}`); process.exit(1); }

const hasKey = Boolean(env.GENLAYER_PRIVATE_KEY);
const account = hasKey ? createAccount(env.GENLAYER_PRIVATE_KEY) : null;
const balanceWei = account ? BigInt(await rpc(net.chainRpc, 'eth_getBalance', [account.address, 'latest'])) : 0n;

console.log('— ProofPayAdjudicator deployment preflight —');
console.log(`network:        ${net.label} (chainId ${net.chainId}, live RPC verified)`);
console.log(`source:         ${sourcePath}`);
console.log(`source sha256:  ${sourceSha256}`);
console.log(`constructor:    no arguments (owner = deployer)`);
console.log(`genlayer-js:    ${sdkPkg.version} · node ${process.version}`);
console.log(`deployer:       ${account ? account.address : '(GENLAYER_PRIVATE_KEY unset)'}`);
console.log(`balance:        ${balanceWei} wei (${(Number(balanceWei) / 1e18).toFixed(6)} GEN)`);
console.log(`existing addr:  ${env.GENLAYER_CONTRACT_ADDRESS || '(none)'}`);

// Duplicate guard: same network + same source already deployed successfully?
const dir = join(root, 'deployments');
const prior = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; } }).filter(Boolean) : [];
const dupe = prior.find((r) => r.network === networkKey && r.sourceSha256 === sourceSha256 && r.executionResult === 'FINISHED_WITH_RETURN');
if (dupe && !force) {
  console.log(`\nDUPLICATE GUARD: this exact source is already deployed on ${networkKey} at ${dupe.contractAddress} (tx ${dupe.txHash}). Not redeploying. Use --force only if you intend a second deployment.`);
  process.exit(0);
}

if (!execute) {
  console.log('\nDRY RUN — nothing submitted. Re-run with --execute to deploy.');
  if (!hasKey) console.log('BLOCKER: GENLAYER_PRIVATE_KEY is not set.');
  else if (balanceWei === 0n) console.log(`BLOCKER: deployer has 0 GEN. Fund ${account.address} via https://testnet-faucet.genlayer.foundation (Bradbury), then re-run.`);
  process.exit(0);
}
if (!hasKey) { console.error('Cannot execute: GENLAYER_PRIVATE_KEY unset.'); process.exit(1); }
if (balanceWei === 0n) { console.error(`Cannot execute: deployer ${account.address} has 0 GEN on ${net.label}. Fund it first: https://testnet-faucet.genlayer.foundation`); process.exit(1); }

// ---- deploy ----------------------------------------------------------------
const client = createClient({ chain, account });
console.log('\nSubmitting deployment transaction…');
const txHash = await client.deployContract({ code, args: [] });
console.log(`tx submitted: ${txHash}`);
console.log('Waiting for a decided state (consensus can take several minutes)…');
// Never blind-redeploy after a timeout: keep tracking THIS transaction.
let tx;
try {
  await client.waitForTransactionReceipt({ hash: txHash, status: 'FINALIZED', interval: 5000, retries: 180 });
  tx = await client.getTransaction({ hash: txHash });
} catch {
  console.log('Wait timed out — resuming tracking of the same transaction…');
  const deadline = Date.now() + 30 * 60_000;
  for (;;) {
    tx = await client.getTransaction({ hash: txHash });
    if (['ACCEPTED', 'FINALIZED', 'UNDETERMINED'].includes(tx.statusName ?? '') || Date.now() > deadline) break;
    await new Promise((r) => setTimeout(r, 10_000));
  }
}
const receipt = tx;
const status = tx.statusName ?? receipt.statusName ?? 'UNKNOWN';
const executionResult = tx.txExecutionResultName ?? receipt.txExecutionResultName ?? 'UNKNOWN';
const contractAddress = tx.to_address ?? tx.recipient ?? null;

const record = {
  project: 'ProofPay',
  contract: 'ProofPayAdjudicator',
  contractVersion: 'proofpay-adjudicator@1.0.0',
  network: networkKey,
  networkLabel: net.label,
  chainId: net.chainId,
  rpc: net.rpc,
  explorer: net.explorer,
  sourcePath,
  sourceSha256,
  sourceRevision: 'no git repository in workspace; source identified by sha256',
  deployer: account.address,
  constructorArgs: [],
  sdk: { 'genlayer-js': sdkPkg.version, node: process.version },
  txHash: String(txHash),
  contractAddress,
  deployedAt: new Date().toISOString(),
  finalStatus: status,
  executionResult,
  explorerContractUrl: contractAddress ? `${net.explorer}/address/${contractAddress}` : null,
  explorerTxUrl: `${net.explorer}/tx/${txHash}`,
};
mkdirSync(dir, { recursive: true });
const file = join(dir, `${networkKey}-${record.deployedAt.replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify(record, null, 2));
console.log(`\nrecord written: deployments/${file.split('/').pop()}`);
console.log(JSON.stringify(record, null, 2));

if (!(status === 'FINALIZED' || status === 'ACCEPTED') || executionResult !== 'FINISHED_WITH_RETURN' || !contractAddress) {
  console.error('\nDEPLOYMENT NOT VERIFIED: status/execution/address incomplete. Treat as failed; do not configure the app with this address.');
  process.exit(2);
}
console.log('\nDEPLOYMENT VERIFIED ✔  (status + FINISHED_WITH_RETURN + contract address)');
console.log('Next: set GENLAYER_CONTRACT_ADDRESS to the address above in .env, restart the app,');
console.log('then run: node scripts/test-onchain.mjs');
