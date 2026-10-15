# ProofPay — 3–5 minute demonstration script

Reproducible, based only on verified live evidence. Does **not** depend on a
new adjudication transaction. Contract: `ProofPayAdjudicator` on GenLayer
Bradbury (chain 4221), `0xA9199502C11C897a8550273Bcb7d8B1816DF4669`.

## 0:00 — The deployed contract (45s)
- Open https://explorer-bradbury.genlayer.com/address/0xA9199502C11C897a8550273Bcb7d8B1816DF4669
- Say: "ProofPay freezes acceptance criteria before funding. When a delivery
  is disputed, this GenLayer Intelligent Contract compares both parties'
  hashed evidence against the frozen wording and records a criterion-level
  verdict. It never holds funds — it authorizes; the application settles."
- Point at the deployment tx: FINALIZED, `FINISHED_WITH_RETURN`.

## 0:45 — A genuine completed decision (60s)
- Run (or show output of):
  `readContract get_verdict('live1-b')` against the address above, and open
  tx `0x002e761f99830a1ba16bb1259028824158bbb09142238bd093586c2fc9b0c26d`.
- Show: decision **BUYER_WINS**, `crit_1=MET`, `crit_2=NOT_MET` — the provider
  delivered the API but the cancellation-refund criterion failed, so the
  client wins. Contrast scenario C (`live1-c` → `INSUFFICIENT_EVIDENCE`):
  with an empty evidence register the contract's deterministic evidence
  floor makes a definitive verdict impossible — no verdict, no settlement.

## 1:45 — The product around the contract (60s)
- Open the app (`/app/disputes/dsp_contested`): frozen criterion `crit_2`,
  provider evidence vs client objection in one register, each hash-recorded.
- Open **Settings**: mode **GENLAYER_TESTNET · Bradbury · 0xA919…4669**.
  "With no `GENLAYER_*` env vars this same UI says DEMO_SIMULATED everywhere —
  simulated records are never dressed as chain activity."

## 2:45 — Honest failure handling (60s)
- Show the adjudication requests for the seeded dispute: four **real**
  app-submitted transactions. Walk the outcomes: leader timeout → finalized
  with **no adopted verdict**; one **UNDETERMINED**; app imported **nothing**
  (database: 0 results, 0 settlements).
- Say: "Pending is shown as pending. An undecided consensus is a safe
  outcome, not an error to paper over — the case stays resumable via
  Refresh, and only an eligible finalized verdict can authorize a settlement."

## 3:45 — Settlement integrity & audit (45s)
- Show the audit trail / activity stream and the settlement panel:
  settlement is an **off-chain application record** (authorized ≠ executed),
  executed exactly once under an idempotency key — duplicate execution is
  rejected (proven in the demo-mode e2e and domain tests). No on-chain asset
  transfer is claimed anywhere; real-asset settlement would need a dedicated
  escrow adapter (see `docs/SECURITY.md`).

## Close (15s)
"Deployed and verified on Bradbury today: contract, five scenario checks,
and a live-integrated app. Open items are named, not hidden: app-level
decided-verdict import awaits active validators, and the repo/site await
publication." Point to `docs/SUBMISSION_CHECKPOINT.md` for every hash.
