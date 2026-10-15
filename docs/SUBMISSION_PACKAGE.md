# ProofPay — Submission Package

## Problem & users
Freelance and agency work is paid against acceptance criteria that live in
chat threads. When delivery is disputed, neither side can prove what was
agreed, and platforms fall back to opaque, slow mediation. **ProofPay is
evidence-based escrow for clients and independent providers**: criteria are
frozen and hashed before funding, delivery evidence is recorded from both
sides, and disputes are decided against the frozen wording.

## Why GenLayer is central
Acceptance criteria are natural language ("refunds the hold within the same
request, covered by an automated test") — deterministic code alone cannot
judge them. ProofPay's `ProofPayAdjudicator` Intelligent Contract reads the
frozen criteria, both parties' evidence register, and both claims, then —
under Optimistic Democracy — a leader proposes a criterion-level verdict
that validators independently re-derive and must agree on. Deterministic
code guards everything around the judgment: verdict schema and split
bounds, one verdict per case, and an evidence floor (no cited evidence →
`INSUFFICIENT_EVIDENCE`, nothing settleable). Evidence is treated as
untrusted data in the prompt, never as instructions.

## Architecture & lifecycle
Next.js (UI + API, one process) · Prisma (SQLite demo / Postgres-ready) ·
genlayer-js server-side only. Lifecycle: agree (terms v1 hashed) → fund
(simulated ledger in demo) → submit hashed evidence → accept or dispute →
adjudication request persisted with idempotency key → GenLayer write →
Refresh polls chain state → verdict decoded and **deterministically
re-validated** → settlement authorized (exactly once) → executed off-chain →
audit events throughout. The contract is non-custodial: it stores the
authorization; it never holds funds, and "authorized" is always distinct
from "executed."

## Verified live evidence (GenLayer Bradbury, chain 4221)
- **Contract:** `0xA9199502C11C897a8550273Bcb7d8B1816DF4669` —
  https://explorer-bradbury.genlayer.com/address/0xA9199502C11C897a8550273Bcb7d8B1816DF4669
- **Deployment tx:** `0x2ab58f01bf8a5371dad5a8c6d32612dcfbc8f2e10c9f010e83bfebc294e8f623` —
  FINALIZED · AGREE · `FINISHED_WITH_RETURN`; on-chain code hash identical
  to source (`9b90bd1e…`). https://explorer-bradbury.genlayer.com/tx/0x2ab58f01bf8a5371dad5a8c6d32612dcfbc8f2e10c9f010e83bfebc294e8f623
- **Scenarios A–E** (`docs/SUBMISSION_CHECKPOINT.md` §2–3): A accepted →
  SELLER_WINS (`0x55c81b…`); B disputed → BUYER_WINS crit_1=MET/crit_2=NOT_MET
  (`0x002e76…`, case `live1-b`); C insufficient → INSUFFICIENT_EVIDENCE
  (`0x1ef8f4…`, `live1-c`); D malformed + duplicate → rejected
  `FINISHED_WITH_ERROR`; E single stable authorization by design.
- **App-level live submissions:** four real adjudications via the ProofPay
  API (`0x7932d8…`, `0xc4aa77…`, `0xc4cfdb…`, `0x7407c8…`) — all finalized
  **without an adopted verdict** during a validator-inactivity period; the
  app imported nothing (0 results, 0 settlements) and kept cases resumable.

## Tests (fresh, this audit cycle)
`npm test` 14/14 · contract static pytest 9/9 · `genvm-lint` pass ·
production build pass · live-chain reads as above. Direct-mode contract
tests (2) fail **pre-execution**: upstream GenVM v0.3.0-rc7 binary returns
HTTP 404 in `genlayer-test 0.29.2` (latest) — mocked/direct testing route
only, non-blocking; live evidence supersedes it here.

## Security & fail-safes
Server-side signer only (never in repo, bundles, or logs); object-level
authorization; frozen-terms immutability (409); verdict schema re-validation
before any settlement; evidence floor on-chain *and* in the app; idempotency
keys on adjudication and settlement (duplicate execution rejected); pending /
idle / disagreement states displayed as-is; simulated mode (`DEMO_SIMULATED`,
`demo-tx-…`) only when live env vars are absent, always labelled.

## Works today vs pending
**Works:** deployed verified contract; criterion-level on-chain decisions
(A–E); full product workflow; live-mode app integration incl. submission and
honest status handling; exactly-once settlement mechanics.
**Pending (external):** a decided verdict imported through the app +
API settlement execution (awaits active Bradbury validators — Refresh
resumes it); public website and GitHub publication (account-owner actions);
portal submission thereafter. Direct-mode tests await an upstream fix.

## Run it
```bash
npm install && npx prisma generate && npm run db:setup && npm run build && npm start
# Live mode: .env → GENLAYER_NETWORK=testnetBradbury
#   GENLAYER_CONTRACT_ADDRESS=0xA9199502C11C897a8550273Bcb7d8B1816DF4669
#   GENLAYER_PRIVATE_KEY=<funded testnet key, server-side only>
```
Demo walkthrough: `docs/DEMO_SCRIPT.md` · Full evidence:
`docs/SUBMISSION_CHECKPOINT.md` · Deployment: `docs/GENLAYER_DEPLOYMENT_REPORT.md`.
**Public demo URL / GitHub URL:** not yet published (no URL claimed).
