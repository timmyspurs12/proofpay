#!/usr/bin/env node
/**
 * End-to-end LIVE verification through the ProofPay API (not the SDK):
 *   login → POST adjudication (expect 202 PENDING + real GenLayer txId)
 *   → PATCH poll until the app imports the on-chain verdict
 *   → execute the authorized settlement via the API
 *   → record everything to deployments/app-live-verification.json
 * Requires the app running in GENLAYER_TESTNET mode (see .env).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.APP_URL || 'http://localhost:3000';
const DISPUTE = 'dsp_contested';
let cookie = '';
const record = { startedAt: new Date().toISOString(), dispute: DISPUTE, steps: [] };
const say = (m) => { console.log(m); record.steps.push(`${new Date().toISOString()} ${m}`); };

async function call(method, path, body, expect) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const json = await res.json().catch(() => ({}));
  if (expect && res.status !== expect) throw new Error(`${method} ${path} → ${res.status} (expected ${expect}): ${JSON.stringify(json).slice(0, 300)}`);
  return { status: res.status, data: json.data ?? json };
}

await call('POST', '/api/auth/login', { userId: 'usr_lena' }, 200);
say('logged in as Elena Vasquez (client, party to agr_contested)');

const sub = await call('POST', `/api/disputes/${DISPUTE}/adjudications`, { idempotencyKey: process.argv[2] || process.env.IDEMPOTENCY_KEY || 'live-verify:2026-10-15' }, 202);
const reqId = sub.data.request.id;
const txId = sub.data.request.txId;
record.requestId = reqId; record.txId = txId; record.mode = sub.data.mode;
say(`adjudication submitted via app: request=${reqId} mode=${sub.data.mode}`);
say(`GenLayer tx: ${txId}`);
say(`explorer: https://explorer-bradbury.genlayer.com/tx/${txId}`);
if (!txId || String(txId).startsWith('demo-tx-')) throw new Error('txId is not a real GenLayer transaction — app is not in live mode');

let verdict = null; let settlement = null;
const deadline = Date.now() + 50 * 60_000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 60_000));
  const poll = await call('PATCH', `/api/disputes/${DISPUTE}/adjudications`, { requestId: reqId }, 200);
  const st = poll.data.request?.status;
  say(`poll: request status=${st}${poll.data.note ? ` (${poll.data.note})` : ''}`);
  if (poll.data.verdict) { verdict = poll.data.verdict; settlement = poll.data.settlement; break; }
  if (st === 'FAILED') throw new Error('adjudication request FAILED on-chain');
}
if (!verdict) throw new Error('verdict not imported within 50 minutes');
record.verdict = verdict;
say(`verdict imported by app: ${verdict.decision} providerShareBps=${verdict.providerShareBps}`);

if (settlement) {
  record.settlementAuthorized = settlement;
  const exec = await call('POST', `/api/settlements/${settlement.id}/execute`, {}, 200);
  record.settlementExecuted = exec.data;
  say(`settlement executed via app: ${settlement.id} → ${exec.data.status ?? 'EXECUTED'}`);
  const dup = await call('POST', `/api/settlements/${settlement.id}/execute`, {}, 200);
  say(`duplicate execute safely handled: ${JSON.stringify(dup.data).slice(0, 160)}`);
} else {
  say('no settlement authorized (INSUFFICIENT_EVIDENCE path) — nothing to execute');
}

const final = await call('GET', `/api/disputes/${DISPUTE}`, null, 200);
record.finalDisputeStatus = final.data.dispute?.status ?? final.data.status;
record.finishedAt = new Date().toISOString();
mkdirSync(join(root, 'deployments'), { recursive: true });
writeFileSync(join(root, 'deployments', 'app-live-verification.json'), JSON.stringify(record, null, 2));
say(`DONE — dispute status: ${record.finalDisputeStatus}. Record: deployments/app-live-verification.json`);
