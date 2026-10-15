# ProofPay — Evidence Finance

Evidence-based escrow and dispute resolution. Parties freeze objective acceptance
criteria before funding, build a shared evidence register, and let a **GenLayer
Intelligent Contract** adjudicate disagreements into a structured verdict.
Settlement is executed by deterministic code — never by an AI rationale alone.

## Quick start (demo mode, no credentials)

```bash
npm install
cp .env.example .env
npm run db:setup     # prisma generate + db push (SQLite) + seed 3 scenarios
npm run dev          # http://localhost:3000
```

Open the workspace, sign in with a demo persona (Elena Vasquez = client, Kwame Mensah =
provider, Alex Chen = both), and follow `docs/DEMO_GUIDE.md`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server on 0.0.0.0:3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest unit + rule tests (state machine, settlement, verdict schema, demo engine, nonce replay) |
| `npm run contract:test` | Python static/structural tests for the Intelligent Contract |
| `npm run db:setup` | Generate client, create DB, seed demo scenarios |
| `npm run db:seed` | Reseed demo data |

## Required environment variables

See `.env.example`. Demo mode needs only `DATABASE_URL` (SQLite default) and
`SESSION_SECRET`. Live GenLayer mode additionally needs
`GENLAYER_CONTRACT_ADDRESS` + `GENLAYER_PRIVATE_KEY` (funded testnet key) —
see `docs/GENLAYER.md`. Without them the app runs **clearly labelled simulated
adjudication**; simulated records are never presented as chain transactions.

## Implemented features

- **Public entry** (`/`) — problem statement, interactive 4-stage demo (Agree →
  Evidence → Adjudicate → Settle), Agree/Adjudicate/Settle explainer, honest
  GenLayer status panel.
- **Workspace overview** (`/app`) — funded value, awaiting-action, disputes,
  recent settlements, state distribution, activity feed; all computed from data.
- **Agreement builder** (`/app/agreements/new`) — 4-step builder with live
  preview, inline validation, local draft saving, create-vs-fund separation.
- **Case file** (`/app/agreements/[id]`) — frozen terms + sha256 terms hash,
  parties, funding, interactive lifecycle timeline, evidence summary,
  transaction history, guarded actions (fund / submit / accept / dispute /
  execute / retry).
- **Evidence studio** (`/app/agreements/[id]/evidence`) — GitHub/deployment/
  screenshot/document/file/note evidence, criterion linking, sha256 hashing,
  duplicate warnings, link validation, honest “hash ≠ authorship” labelling.
- **Dispute centre** (`/app/disputes/[id]`) — disputed criterion highlighted,
  side-by-side per-criterion evidence, claims/rebuttals timeline, GenLayer
  execution panel (contract, network, tx, state), structured verdict with
  criterion findings, evidence refs and uncertainties, authorized settlement.
- **Decision & settlement receipt** (`/app/receipts/[id]`) — print-friendly,
  JSON export, copyable identifiers; decision vs executed payment separated.
- **Activity explorer** (`/app/activity`) — search + filters (type, role,
  status) over persisted audit/transaction/settlement records.
- **Settings** (`/app/settings`) — account, wallet identity, live-vs-simulated
  GenLayer configuration status.
- **Backend** — Next.js API routes with server-side auth (demo persona session),
  object-level authorization on every route, input validation, rate limits,
  idempotency keys, audit events, notifications.
- **GenLayer** — real Intelligent Contract (`contracts/proofpay_adjudicator.py`)
  with Equivalence-Principle validation, deterministic guards and an evidence
  floor; server-side `genlayer-js` adapter; live polling until finality.
- **Demo scenarios (seeded)** — 1) successful delivery → accepted → settled,
  2) contested booking API → dispute centre ready to adjudicate,
  3) insufficient evidence → INSUFFICIENT_EVIDENCE, no fabricated verdict.

## Architecture & docs

- `ARCHITECTURE.md` — research findings (verified doc URLs), stack, state machine.
- `docs/API.md` — endpoints and payloads.
- `docs/GENLAYER.md` — contract design, deployment to Studionet/Bradbury, testing.
- `docs/DEPLOYMENT.md` — PostgreSQL, env, production notes.
- `docs/DEMO_GUIDE.md` — click-by-click reviewer journeys.
- `docs/SECURITY.md` — threat model, safeguards, known limitations.

## Honest status

- **GenLayer network/deployment:** the contract **is deployed and verified** on
  GenLayer Bradbury (chain 4221) at
  `0xA9199502C11C897a8550273Bcb7d8B1816DF4669` — deployment tx FINALIZED with
  `FINISHED_WITH_RETURN`, on-chain code hash identical to
  `contracts/proofpay_adjudicator.py`. With the `GENLAYER_*` env vars set the
  app adjudicates live (`GENLAYER_TESTNET`); without them it runs clearly
  labelled simulated adjudication. Full evidence: `docs/SUBMISSION_CHECKPOINT.md`.
  Note: app-submitted adjudications depend on Bradbury validator activity;
  four recorded attempts reached finality **without an adopted verdict**
  (idle/disagreement) and the app correctly recorded no decision for them.
- **Payments:** demo ledger only. No real assets move; simulated funding/
  settlement references use `demo-tx-…` ids and `SIMULATED` status.
- **Database:** SQLite for the local demo; PostgreSQL is a provider switch away
  (`docs/DEPLOYMENT.md`, `docker-compose.yml` included).
