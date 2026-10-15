import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const stable = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
};
const daysAgo = (n: number, h = 0) => new Date(Date.now() - n * 86400_000 - h * 3600_000);

async function main() {
  // Wipe in dependency order (demo reseed is explicit and local-only).
  await prisma.notification.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.blockchainTransaction.deleteMany();
  await prisma.settlementInstruction.deleteMany();
  await prisma.adjudicationResult.deleteMany();
  await prisma.adjudicationRequest.deleteMany();
  await prisma.disputeSubmission.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.fundingRecord.deleteMany();
  await prisma.agreementVersion.deleteMany();
  await prisma.agreement.deleteMany();
  await prisma.walletIdentity.deleteMany();
  await prisma.user.deleteMany();

  const amara = await prisma.user.create({ data: { id: 'usr_amara', name: 'Elena Vasquez', email: 'amara@northwind.example', role: 'CLIENT' } });
  const Kwame = await prisma.user.create({ data: { id: 'usr_Kwame', name: 'Kwame Mensah', email: 'Kwame@studio.example', role: 'PROVIDER' } });
  const lena = await prisma.user.create({ data: { id: 'usr_lena', name: 'Alex Chen', email: 'lena@helio.example', role: 'BOTH' } });
  await prisma.walletIdentity.createMany({
    data: [
      { id: 'wal_amara', userId: amara.id, address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', chainId: 4221 },
      { id: 'wal_Kwame', userId: Kwame.id, address: '0xB04B8a4f325E1cB2e2A03D4F5A6B7C8D9E0F1A2B', chainId: 4221 },
      { id: 'wal_lena', userId: lena.id, address: '0xC15D6B5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B9C', chainId: 4221 },
    ],
  });

  async function agreement(opts: {
    id: string; title: string; description: string; clientId: string; providerId: string;
    amountMinor: number; status: string; deadline: Date; reviewDays?: number;
    snapshot: object; createdAt: Date;
  }) {
    const meta = { title: opts.title, amountMinor: opts.amountMinor, currency: 'USD', clientId: opts.clientId, providerId: opts.providerId, deadline: opts.deadline.toISOString() };
    const termsHash = sha(stable({ snapshot: opts.snapshot, meta }));
    const a = await prisma.agreement.create({
      data: {
        id: opts.id, title: opts.title, description: opts.description, status: opts.status,
        clientId: opts.clientId, providerId: opts.providerId, amountMinor: opts.amountMinor,
        currency: 'USD', deadline: opts.deadline, reviewDays: opts.reviewDays ?? 7, isDemo: true,
        createdAt: opts.createdAt, updatedAt: opts.createdAt,
      },
    });
    const v = await prisma.agreementVersion.create({
      data: { id: `ver_${opts.id}`, agreementId: opts.id, version: 1, termsHash, snapshot: JSON.stringify(opts.snapshot), approvedBy: JSON.stringify([opts.clientId, opts.providerId]), changeNote: 'Initial terms — approved by both parties', createdAt: opts.createdAt },
    });
    await prisma.agreement.update({ where: { id: opts.id }, data: { currentVersionId: v.id } });
    await prisma.auditEvent.create({ data: { id: `evt_${opts.id}_created`, actorId: opts.clientId, entityType: 'agreement', entityId: opts.id, action: 'AGREEMENT_CREATED', detail: `v1 terms hash ${termsHash.slice(0, 12)}…`, createdAt: opts.createdAt } });
    return { agreement: a, version: v, termsHash };
  }

  // ---------- Scenario 1: successful delivery → accepted → settled ----------
  const s1snapshot = {
    deliverables: [
      { id: 'del_1', title: 'Brand identity system', description: 'Logo suite, colour and type system, 20-page brand guidelines PDF.' },
      { id: 'del_2', title: 'Launch landing page', description: 'Responsive landing page deployed to production with analytics.' },
    ],
    criteria: [
      { id: 'crit_1', deliverableId: 'del_1', text: 'Brand guidelines PDF contains logo suite, colour palette with hex values, and typography scale.' },
      { id: 'crit_2', deliverableId: 'del_2', text: 'Landing page is live at the production URL, responsive at 360px and 1440px, with analytics verified.' },
    ],
    evidenceRequirements: 'PDF deliverable file plus live deployment URL and screenshots at both breakpoints.',
    settlementTerms: { allowPartial: true, notes: 'Partial settlement permitted only by explicit adjudication split.' },
  };
  const s1 = await agreement({
    id: 'agr_success', title: 'Northwind Studio — brand & launch site', description: 'Brand identity and launch landing page for Northwind Studio.',
    clientId: amara.id, providerId: Kwame.id, amountMinor: 480000, status: 'SETTLED', deadline: daysAgo(-14), snapshot: s1snapshot, createdAt: daysAgo(21),
  });
  await prisma.fundingRecord.create({ data: { id: 'fund_s1', agreementId: s1.agreement.id, amountMinor: 480000, currency: 'USD', method: 'DEMO_LEDGER', status: 'RECORDED', reference: 'demo-tx-s1fund01', createdAt: daysAgo(20) } });
  await prisma.blockchainTransaction.create({ data: { id: 'tx_s1_fund', agreementId: s1.agreement.id, kind: 'FUNDING', network: 'Demo ledger (simulated)', txId: 'demo-tx-s1fund01', status: 'SIMULATED', detail: 'Demo funding recorded. No real assets moved.', createdAt: daysAgo(20) } });
  await prisma.evidence.createMany({
    data: [
      { id: 'ev_s1_1', agreementId: s1.agreement.id, criterionId: 'crit_1', type: 'DELIVERABLE_FILE', title: 'northwind-brand-guidelines.pdf', fileName: 'northwind-brand-guidelines.pdf', fileSize: 2481204, contentHash: sha('DELIVERABLE_FILE||northwind brand guidelines v1'), submittedById: Kwame.id, createdAt: daysAgo(9) },
      { id: 'ev_s1_2', agreementId: s1.agreement.id, criterionId: 'crit_2', type: 'DEPLOYMENT_URL', title: 'Production landing page', url: 'https://northwind.example.com/launch', contentHash: sha('DEPLOYMENT_URL|https://northwind.example.com/launch|'), submittedById: Kwame.id, createdAt: daysAgo(9) },
      { id: 'ev_s1_3', agreementId: s1.agreement.id, criterionId: 'crit_2', type: 'NOTE', title: 'Analytics verification note', contentText: 'Analytics tag verified in production build; events firing for pageview and signup click.', contentHash: sha('NOTE||Analytics tag verified in production build'), submittedById: Kwame.id, createdAt: daysAgo(8) },
    ],
  });
  await prisma.settlementInstruction.create({ data: { id: 'set_s1', agreementId: s1.agreement.id, decision: 'SELLER_WINS', toProviderMinor: 480000, toClientMinor: 0, currency: 'USD', status: 'EXECUTED', mode: 'DEMO_LEDGER', reference: 'demo-tx-s1setl01', idempotencyKey: 'accept:agr_success', createdAt: daysAgo(7), executedAt: daysAgo(7) } });
  await prisma.blockchainTransaction.create({ data: { id: 'tx_s1_set', agreementId: s1.agreement.id, kind: 'SETTLEMENT', network: 'Demo ledger (simulated)', txId: 'demo-tx-s1setl01', status: 'SIMULATED', detail: 'Demo settlement executed in full to provider. No real assets moved.', createdAt: daysAgo(7) } });
  for (const [id, action, at, actor] of [
    ['evt_s1_funded', 'AGREEMENT_FUNDED', daysAgo(20), amara.id],
    ['evt_s1_submitted', 'WORK_SUBMITTED', daysAgo(9), Kwame.id],
    ['evt_s1_accepted', 'WORK_ACCEPTED', daysAgo(7), amara.id],
    ['evt_s1_settled', 'SETTLEMENT_EXECUTED', daysAgo(7), amara.id],
  ] as const) {
    await prisma.auditEvent.create({ data: { id, actorId: actor, entityType: 'agreement', entityId: s1.agreement.id, action, detail: 'Demo scenario 1 — successful delivery', createdAt: at } });
  }

  // ---------- Scenario 2: contested delivery → dispute centre ----------
  const s2snapshot = {
    deliverables: [
      { id: 'del_1', title: 'Booking API', description: 'REST API with availability, reservation and cancellation endpoints, deployed with docs.' },
      { id: 'del_2', title: 'Test & quality pack', description: 'Automated test suite covering booking flows with CI passing.' },
    ],
    criteria: [
      { id: 'crit_1', deliverableId: 'del_1', text: 'Availability, reservation and cancellation endpoints are live and documented in the deployed API docs.' },
      { id: 'crit_2', deliverableId: 'del_1', text: 'Cancellation refunds the hold within the same request and is covered by an automated test.' },
      { id: 'crit_3', deliverableId: 'del_2', text: 'CI pipeline passes on the delivered commit with booking-flow tests included.' },
    ],
    evidenceRequirements: 'Repository + commit link, deployment URL, CI run link, and written mapping of evidence to each criterion.',
    settlementTerms: { allowPartial: true, notes: 'Partial settlement permitted only by explicit adjudication split.' },
  };
  const s2 = await agreement({
    id: 'agr_contested', title: 'Helio Health — booking API', description: 'Booking API for Helio Health clinics, milestone 2.',
    clientId: lena.id, providerId: Kwame.id, amountMinor: 1250000, status: 'DISPUTED', deadline: daysAgo(-3), snapshot: s2snapshot, createdAt: daysAgo(16),
  });
  await prisma.fundingRecord.create({ data: { id: 'fund_s2', agreementId: s2.agreement.id, amountMinor: 1250000, currency: 'USD', method: 'DEMO_LEDGER', status: 'RECORDED', reference: 'demo-tx-s2fund01', createdAt: daysAgo(15) } });
  await prisma.blockchainTransaction.create({ data: { id: 'tx_s2_fund', agreementId: s2.agreement.id, kind: 'FUNDING', network: 'Demo ledger (simulated)', txId: 'demo-tx-s2fund01', status: 'SIMULATED', detail: 'Demo funding recorded. No real assets moved.', createdAt: daysAgo(15) } });
  const dispute2 = await prisma.dispute.create({
    data: { id: 'dsp_contested', agreementId: s2.agreement.id, versionId: s2.version.id, openedById: lena.id, criterionId: 'crit_2', status: 'EVIDENCE', reason: 'Cancellation endpoint returns success but the card hold is not released in the same request. Our QA log shows the hold persisting for 24h, which fails criterion 2. Endpoints and docs (criterion 1) look complete, and CI is green (criterion 3).', createdAt: daysAgo(2) },
  });
  await prisma.disputeSubmission.createMany({
    data: [
      { id: 'sub_s2_client', disputeId: dispute2.id, authorId: lena.id, kind: 'CLAIM', body: 'Cancellation returns 200 but does not release the authorization hold in the same request (see QA log ev). Criterion 2 is explicit: "within the same request". Requesting adjudication on criterion 2 only.', createdAt: daysAgo(2) },
      { id: 'sub_s2_provider', disputeId: dispute2.id, authorId: Kwame.id, kind: 'REBUTTAL', body: 'The hold release is issued in the same request to the payment sandbox; the 24h persistence is the sandbox settlement delay, not our code. The cancellation test (ev) asserts the release call. Asking the adjudicator to weigh the test + code link against the QA log.', createdAt: daysAgo(1) },
    ],
  });
  await prisma.evidence.createMany({
    data: [
      { id: 'ev_s2_repo', agreementId: s2.agreement.id, disputeId: dispute2.id, criterionId: 'crit_1', type: 'GITHUB', title: 'Booking API repository @ a3f9c1e', url: 'https://github.com/example/helio-booking/commit/a3f9c1e', contentHash: sha('GITHUB|https://github.com/example/helio-booking/commit/a3f9c1e|'), submittedById: Kwame.id, createdAt: daysAgo(4) },
      { id: 'ev_s2_docs', agreementId: s2.agreement.id, disputeId: dispute2.id, criterionId: 'crit_1', type: 'DEPLOYMENT_URL', title: 'Deployed API docs', url: 'https://api.helio.example.com/docs', contentHash: sha('DEPLOYMENT_URL|https://api.helio.example.com/docs|'), submittedById: Kwame.id, createdAt: daysAgo(4) },
      { id: 'ev_s2_test', agreementId: s2.agreement.id, disputeId: dispute2.id, criterionId: 'crit_2', type: 'NOTE', title: 'Cancellation test — release asserted', contentText: 'Automated test test_cancel_releases_hold asserts the payment release call fires inside the cancellation request handler (see repo, tests/booking/test_cancel.py).', contentHash: sha('NOTE||test_cancel_releases_hold asserts release'), submittedById: Kwame.id, createdAt: daysAgo(3) },
      { id: 'ev_s2_ci', agreementId: s2.agreement.id, disputeId: dispute2.id, criterionId: 'crit_3', type: 'DEPLOYMENT_URL', title: 'CI run — green', url: 'https://github.com/example/helio-booking/actions/runs/90210', contentHash: sha('DEPLOYMENT_URL|https://github.com/example/helio-booking/actions/runs/90210|'), submittedById: Kwame.id, createdAt: daysAgo(3) },
      { id: 'ev_s2_qa', agreementId: s2.agreement.id, disputeId: dispute2.id, criterionId: 'crit_2', type: 'DOCUMENT', title: 'QA log — hold persisted 24h', fileName: 'qa-cancellation-log.txt', fileSize: 4211, contentText: 'QA 2026-10-11: cancel booking BK-1042 at 10:02 — API 200. Card hold still present at 10:02 next day. Expected release within the same request per criterion 2.', contentHash: sha('DOCUMENT||QA cancel BK-1042 hold persisted'), submittedById: lena.id, createdAt: daysAgo(2) },
    ],
  });
  for (const [id, action, at, actor, entity] of [
    ['evt_s2_funded', 'AGREEMENT_FUNDED', daysAgo(15), lena.id, s2.agreement.id],
    ['evt_s2_submitted', 'WORK_SUBMITTED', daysAgo(4), Kwame.id, s2.agreement.id],
    ['evt_s2_dispute', 'DISPUTE_OPENED', daysAgo(2), lena.id, dispute2.id],
    ['evt_s2_rebuttal', 'REBUTTAL_SUBMITTED', daysAgo(1), Kwame.id, dispute2.id],
  ] as const) {
    await prisma.auditEvent.create({ data: { id, actorId: actor, entityType: entity === s2.agreement.id ? 'agreement' : 'dispute', entityId: entity, action, detail: 'Demo scenario 2 — contested delivery', createdAt: at } });
  }
  await prisma.notification.create({ data: { id: 'ntf_s2_Kwame', userId: Kwame.id, title: 'Dispute opened', body: 'A dispute was opened on “Helio Health — booking API”. Review the evidence and respond.', href: `/app/disputes/${dispute2.id}`, createdAt: daysAgo(2) } });

  // ---------- Scenario 3: insufficient evidence ----------
  const s3snapshot = {
    deliverables: [{ id: 'del_1', title: 'Data migration script', description: 'Idempotent migration of legacy orders with a dry-run report.' }],
    criteria: [
      { id: 'crit_1', deliverableId: 'del_1', text: 'Migration runs idempotently: a second run changes zero rows, proven by before/after counts.' },
      { id: 'crit_2', deliverableId: 'del_1', text: 'Dry-run report lists every transformed table with row counts.' },
    ],
    evidenceRequirements: 'Repository link plus dry-run report file with row counts.',
    settlementTerms: { allowPartial: false, notes: 'No partial settlement for this agreement.' },
  };
  const s3 = await agreement({
    id: 'agr_insufficient', title: 'Northwind — legacy orders migration', description: 'Migrate legacy orders to the new schema.',
    clientId: amara.id, providerId: Kwame.id, amountMinor: 320000, status: 'ADDITIONAL_EVIDENCE_REQUIRED', deadline: daysAgo(5), snapshot: s3snapshot, createdAt: daysAgo(12),
  });
  await prisma.fundingRecord.create({ data: { id: 'fund_s3', agreementId: s3.agreement.id, amountMinor: 320000, currency: 'USD', method: 'DEMO_LEDGER', status: 'RECORDED', reference: 'demo-tx-s3fund01', createdAt: daysAgo(11) } });
  const dispute3 = await prisma.dispute.create({
    data: { id: 'dsp_insufficient', agreementId: s3.agreement.id, versionId: s3.version.id, openedById: amara.id, criterionId: 'crit_1', status: 'NEEDS_EVIDENCE', reason: 'No dry-run report or row counts were delivered, so idempotency cannot be checked. Only a chat message claims the migration "ran fine".', createdAt: daysAgo(3) },
  });
  await prisma.evidence.create({ data: { id: 'ev_s3_chat', agreementId: s3.agreement.id, disputeId: dispute3.id, criterionId: '', type: 'NOTE', title: 'Chat excerpt — "migration ran fine"', contentText: 'Provider message: "Migration ran fine last night, zero errors." No report, counts or repository link attached.', contentHash: sha('NOTE||Migration ran fine last night'), submittedById: Kwame.id, createdAt: daysAgo(4) } });
  const adj3 = await prisma.adjudicationRequest.create({
    data: { id: 'adj_s3', disputeId: dispute3.id, agreementId: s3.agreement.id, versionId: s3.version.id, snapshotHash: sha('s3-snapshot'), mode: 'DEMO_SIMULATED', network: 'Demo adjudication (simulated — no chain execution)', txId: 'demo-tx-s3adj01', status: 'FINALIZED', idempotencyKey: 'seed:adj_s3', createdAt: daysAgo(2) },
  });
  await prisma.adjudicationResult.create({
    data: {
      id: 'res_s3', requestId: adj3.id, decision: 'INSUFFICIENT_EVIDENCE', providerShareBps: null,
      rationale: 'Demo adjudication (simulated): the evidence register contains a single unattributed chat excerpt. No dry-run report, row counts or repository evidence exists for either criterion, so no definitive outcome is justified.',
      verdictJson: JSON.stringify({ decision: 'INSUFFICIENT_EVIDENCE', providerShareBps: null, rationale: 'Demo adjudication (simulated): only a chat excerpt exists; criteria cannot be assessed.', evidenceRefs: ['ev_s3_chat'], uncertainties: ['No dry-run report submitted.', 'No before/after row counts.'], criterionFindings: [{ criterionId: 'crit_1', finding: 'UNCERTAIN', note: 'No idempotency evidence.' }, { criterionId: 'crit_2', finding: 'UNCERTAIN', note: 'No dry-run report.' }] }),
      createdAt: daysAgo(2),
    },
  });
  await prisma.blockchainTransaction.create({ data: { id: 'tx_s3_adj', agreementId: s3.agreement.id, kind: 'ADJUDICATION', network: 'Demo adjudication (simulated)', txId: 'demo-tx-s3adj01', status: 'SIMULATED', detail: 'Simulated adjudication. No GenLayer transaction was submitted.', createdAt: daysAgo(2) } });
  await prisma.auditEvent.create({ data: { id: 'evt_s3_verdict', actorId: amara.id, entityType: 'dispute', entityId: dispute3.id, action: 'VERDICT_INSUFFICIENT_EVIDENCE', detail: 'No settlement authorized', createdAt: daysAgo(2) } });
  await prisma.notification.create({ data: { id: 'ntf_s3_Kwame', userId: Kwame.id, title: 'Additional evidence required', body: '“Northwind — legacy orders migration” needs a dry-run report and row counts before adjudication can decide.', href: `/app/disputes/${dispute3.id}`, createdAt: daysAgo(2) } });

  console.log('Seeded: 3 users, 3 agreements (SETTLED / DISPUTED / ADDITIONAL_EVIDENCE_REQUIRED)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
