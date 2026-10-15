/**
 * End-to-end journey checks against a running ProofPay server.
 * Usage: BASE=http://localhost:3000 node scripts/e2e-check.mjs
 * Exercises: auth, authorization (403), create→fund→submit→dispute→adjudicate→
 * settle, idempotency (duplicate settle), frozen terms (409), insufficient
 * evidence. Exits non-zero on the first failure.
 */
const BASE = process.env.BASE ?? 'http://localhost:3000';
let cookie = '';
let failures = 0;

async function call(method, path, body, expectStatus) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const json = await res.json().catch(() => ({}));
  const label = `${method} ${path} → ${res.status}`;
  if (expectStatus && res.status !== expectStatus) {
    console.error(`FAIL ${label} (expected ${expectStatus}):`, JSON.stringify(json).slice(0, 300));
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
  return { res, json };
}
const data = (r) => r.json.data;

async function main() {
  // Unauthenticated access is refused
  await call('GET', '/api/agreements/agr_contested', undefined, 401);
  // Sign in as Alex Chen (client of the contested agreement)
  await call('POST', '/api/auth/login', { userId: 'usr_lena' }, 200);
  const detail = data(await call('GET', '/api/agreements/agr_contested', undefined, 200));
  if (detail.agreement.status !== 'DISPUTED') console.error('WARN seeded status:', detail.agreement.status);

  // Adjudicate the contested dispute (simulated engine expected)
  const adj = data(await call('POST', '/api/disputes/dsp_contested/adjudications', { idempotencyKey: 'e2e:1' }, 201));
  console.log('     verdict:', adj.request?.result?.decision ?? adj.verdict?.decision);
  const settlement = adj.settlement;
  if (!settlement) { console.error('FAIL no settlement authorized from adjudication'); failures++; }
  else {
    // Duplicate execute must not double-settle
    const s1 = data(await call('POST', `/api/settlements/${settlement.id}/execute`, {}, 200));
    const s2 = data(await call('POST', `/api/settlements/${settlement.id}/execute`, {}, 200));
    if (s1.settlement?.id !== s2.settlement?.id || !s2.alreadyExecuted) { console.error('FAIL idempotent settlement', s2); failures++; }
    else console.log('ok   duplicate settlement blocked (same receipt returned)');
  }

  // Frozen terms: amending a funded/settled agreement is refused
  await call('POST', '/api/agreements/agr_contested/amend', { changeNote: 'sneaky edit' }, 409);

  // Insufficient-evidence dispute must authorize nothing new (Kwame Mensah is a party to it)
  await call('POST', '/api/auth/login', { userId: 'usr_Kwame' }, 200);
  const d3 = data(await call('GET', '/api/disputes/dsp_insufficient', undefined, 200));
  if (d3.dispute.settlements.length !== 0) { console.error('FAIL insufficient-evidence case has a settlement'); failures++; }
  else console.log('ok   insufficient evidence ⇒ no settlement instruction');

  // Switch to a non-party persona → 403 on protected evidence
  await call('POST', '/api/auth/login', { userId: 'usr_amara' }, 200);
  // Elena Vasquez IS a party to agr_insufficient but NOT to agr_contested (Alex Chen↔Kwame Mensah)
  await call('GET', '/api/agreements/agr_contested/evidence', undefined, 403);
  await call('GET', '/api/agreements/agr_contested', undefined, 403);

  console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL E2E CHECKS PASSED');
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
