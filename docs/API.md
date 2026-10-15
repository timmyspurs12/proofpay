# ProofPay API

All responses: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.
Auth: `proofpay_session` httpOnly cookie (demo persona). Every object route
enforces party membership server-side; non-parties get 403. Client-supplied
user ids, amounts and outcomes are never trusted — amounts/decisions are
recomputed server-side.

## Auth & directory
- `POST /api/auth/login` `{ userId }` — sign in as a seeded demo user.
- `POST /api/auth/logout`
- `GET /api/auth/me` — session user + GenLayer mode/network status.
- `GET /api/users` — demo directory (requires session).

## Agreements
- `GET /api/agreements?q=&status=` — caller's agreements only.
- `POST /api/agreements` — create (unfunded) with deliverables + criteria;
  writes terms v1 and its sha256 terms hash. Body: `title, description,
  counterpartyId, counterpartyRole (CLIENT|PROVIDER — the counterparty's role),
  amountMinor (int), currency, deadline (ISO), reviewDays, deliverables[],
  criteria[], evidenceRequirements, allowPartial, settlementNotes?`.
- `GET /api/agreements/:id` — full case file (versions, funding, evidence,
  disputes + adjudications, settlements, chain txs, audit events, myRole).
- `POST /api/agreements/:id/fund` — client only; idempotent; blocks funding
  without valid terms.
- `POST /api/agreements/:id/submit` `{ note }` — provider only; FUNDED →
  SUBMITTED → UNDER_REVIEW.
- `POST /api/agreements/:id/accept` `{ idempotencyKey }` — client only;
  authorizes (not executes) a full-release settlement instruction.
- `POST /api/agreements/:id/amend` — pre-funding only. After funding returns
  `409 TERMS_FROZEN`: funded criteria cannot be silently altered.

## Evidence
- `GET /api/agreements/:id/evidence` — parties only.
- `POST /api/agreements/:id/evidence` — `{ type, title, url?, contentText?,
  criterionId?, disputeId?, fileName?, fileSize? }`. Server computes sha256 of
  the submitted snapshot; returns `duplicateWarning` on an identical hash.
  Link types must be `https://`. A hash proves submission content, not authorship.

## Disputes & adjudication
- `POST /api/agreements/:id/disputes` `{ reason, criterionId? }` — pins the
  current agreement version.
- `GET /api/disputes/:id` — dispute, frozen version, evidence (role-tagged),
  submissions, adjudications, settlements, chain transactions.
- `POST /api/disputes/:id/submissions` `{ kind: CLAIM|REBUTTAL, body }`.
- `POST /api/disputes/:id/adjudications` `{ idempotencyKey }` — duplicate-safe.
  Demo mode: runs the deterministic simulated engine, validates the verdict
  schema, enforces the evidence floor, records result + authorizes settlement.
  Live mode: submits `ProofPayAdjudicator.adjudicate` via genlayer-js, stores
  `PENDING` with the real tx id (202). Invalid verdict schemas are rejected
  with `422 VERDICT_INVALID` and authorize nothing.
- `PATCH /api/disputes/:id/adjudications` `{ requestId }` — live-mode poll:
  maps GenLayer status; imports + validates the verdict only at ACCEPTED/
  FINALIZED; UNDETERMINED returns the case to DISPUTED with no decision.

## Settlement
- `POST /api/settlements/:id/execute` `{ simulateFailure? }` — idempotent.
  EXECUTED → returns the existing receipt. Guards: party check, funded total
  must equal provider+client legs, duplicates blocked. `simulateFailure`
  (demo only) exercises SETTLEMENT_FAILED → retry.

## Feeds
- `GET /api/dashboard` — metrics + queues derived from the caller's data.
- `GET /api/activity?q=&type=&role=&from=&to=` — merged audit/transaction/
  settlement explorer over the caller's agreements.
- `GET /api/notifications`, `POST /api/notifications` (mark read).

Rate limits apply to login, funding, evidence, disputes, adjudication and
settlement routes (in-memory; use Redis for multi-instance production).
