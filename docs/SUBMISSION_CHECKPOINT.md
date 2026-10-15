# ProofPay — Submission Checkpoint (live, verified)

**Checkpoint date:** 2026-10-15 (re-verified same day — all values unchanged) · **Status: deployment verified; minimum viable live demonstration complete.**
All values below were re-read through the GenLayer SDK at checkpoint time. Nothing here is simulated, and no transaction was resubmitted to produce this report.

## 1. Deployment checkpoint

| Field | Value |
|---|---|
| Network | GenLayer Testnet **Bradbury** |
| Chain ID | **4221** (`eth_chainId` = `0x107d`, verified on both RPC endpoints) |
| GenLayer RPC | `https://rpc-bradbury.genlayer.com` |
| Contract | `ProofPayAdjudicator` — `contracts/proofpay_adjudicator.py` |
| Source SHA-256 | `9b90bd1eadd2ee82cfa98398c5613229d06fe17f4bb0084735f4433c46baa6bf` |
| On-chain code SHA-256 | **identical to source** (`getContractCode` re-verified at checkpoint) |
| Deployer (dedicated testnet account) | `0x52d3784dF7cdAB983aAE340150fd3757ACaEFCA0` |
| Constructor args | none (`owner` = deployer) |
| **Contract address** | **`0xA9199502C11C897a8550273Bcb7d8B1816DF4669`** |
| **Contract explorer (address page)** | https://explorer-bradbury.genlayer.com/address/0xA9199502C11C897a8550273Bcb7d8B1816DF4669 |
| **Deployment transaction** | `0x2ab58f01bf8a5371dad5a8c6d32612dcfbc8f2e10c9f010e83bfebc294e8f623` |
| **Deployment explorer** | https://explorer-bradbury.genlayer.com/tx/0x2ab58f01bf8a5371dad5a8c6d32612dcfbc8f2e10c9f010e83bfebc294e8f623 |
| **Verified deployment status** | **FINALIZED** · consensus **AGREE** · execution **`FINISHED_WITH_RETURN`** |
| Machine-readable records | `deployments/testnetBradbury-2026-10-15T07-46-41-753Z.json`, `deployments/CHECKPOINT-latest.json` |

The contract holds **no funds** by design: it stores a bounded settlement authorization; the ProofPay backend executes settlement off-chain after deterministic re-validation, under idempotency keys. No portal text should describe on-chain escrow custody.

## 2. Minimum viable live demonstration (complete)

Reads through the SDK at checkpoint: schema returns the 4 expected methods; deployed code hash matches source; view calls answer correctly.

**One genuine decided interaction (the core ProofPay outcome — valid delivery evidence → recorded decision):**

| Scenario | Transaction | Final state (re-verified) | Verdict |
|---|---|---|---|
| **A — accepted delivery** | `0x55c81b6570759706a6e615917c9ae403a5031134a9f27ee9fea1faf0f97b9481` | FINALIZED · AGREE · FINISHED_WITH_RETURN | **SELLER_WINS** (read back live in the original run; case id was `<run>-a` — SDK tx views expose no call args and the contract has no key enumeration, so the exact prefix is not recoverable on-chain; the decision was recorded contemporaneously) |
| **B — disputed delivery** | `0x002e761f99830a1ba16bb1259028824158bbb09142238bd093586c2fc9b0c26d` | FINALIZED · AGREE · FINISHED_WITH_RETURN | **BUYER_WINS** — crit_1=MET, crit_2=NOT_MET (case `live1-b`, re-read at checkpoint) |

Explorer pattern: `https://explorer-bradbury.genlayer.com/tx/<hash>`.

## 3. Scenario-by-scenario status

| Scenario | Status | Evidence |
|---|---|---|
| A accepted delivery | ✅ **Passed** (FINALIZED) | Table above |
| B disputed delivery | ✅ **Passed** (FINALIZED) | BUYER_WINS with criterion findings, case `live1-b` |
| C insufficient evidence | ✅ **Passed** (FINALIZED) | Case `live1-c` → `INSUFFICIENT_EVIDENCE` (evidence floor; tx `0x1ef8f4bb59bd038ab438cb635cc4fb1ae9afb14b16f92209fb5e40365b2d0749`) |
| D malformed (empty criteria) | ✅ **Rejected as designed** (FINALIZED, `FINISHED_WITH_ERROR`) | tx `0x50023f995b96b1be9c0e7024456ab7d3fdbc7e4d2254329d813497be93e799a3` |
| D duplicate adjudication | ✅ **Rejected as designed** (`FINISHED_WITH_ERROR`) | tx `0xbdc846ed55d3cd363a9193f09db64d25f5d796a170375b428837274d7631121a` ("case already decided") |
| E duplicate settlement | ✅ **By design** | Contract stores one stable authorization per case (verified by repeated reads of `live1-b`); settlement executes off-chain idempotently — there is deliberately no on-chain settlement function |
| App attempt 1 (`adj_5d0c…`, tx `0x7932d8…`) | ⚠️ Finalized, **no decision adopted** (result IDLE, no verdict stored) | App imported nothing; no settlement |
| App attempt 2 (`adj_97cd…`, tx `0xc4aa77…`) | ⚠️ **UNDETERMINED→FINALIZED/DISAGREE** | App restored dispute to EVIDENCE; case UNKNOWN on-chain |
| App attempt 3 (`adj_0713…`, tx `0xc4cfdb…`) | ⚠️ Finalized IDLE / NOT_VOTED | No verdict stored |
| App attempt 4 (`adj_c02f…`, tx `0x7407c8…`) | ⏳ **LEADER_TIMEOUT** (only non-final item) | Resumable; **do not resubmit blindly** |

App attempts were submitted through the ProofPay API itself (HTTP 202 + real tx IDs). Bradbury's validator set stopped voting after the morning session; the app reported PENDING honestly throughout and never recorded a decision that consensus did not make (database: 0 results, 0 settlements for the dispute).

## 4. Frontend honesty (verified at checkpoint)

- `GET /api/auth/me` → `GENLAYER_TESTNET`, Bradbury (4221), contract `0xA9199502C11C897a8550273Bcb7d8B1816DF4669`.
- Simulated mode (`DEMO_SIMULATED`, `demo-tx-…`) appears only when the `GENLAYER_*` env vars are absent; simulated records are never presented as on-chain.
- Website URL: **not yet public** (local/demo hosting only) — required before portal submission links it.
- Repository URL: **not yet published** (local git repo only; commits `0d96679 → 61e5923 → 8fda6bf → 411ff5d`, no secrets — `.env` ignored).

## 5. Reproduce the verified live demonstration

```bash
npm install && npx prisma generate && npm run build
python3 -m pytest contracts/tests -v          # static suite: 9 passed
genvm-lint check contracts/proofpay_adjudicator.py   # passed (genvm-linter 0.11.0)
# Read-only verification against the live contract (any genlayer-js client):
#   getContractSchema(0xA9199502C11C897a8550273Bcb7d8B1816DF4669)  → 4 methods
#   getContractCode(...)  → sha256 == 9b90bd1eadd2ee82cfa98398c5613229d06fe17f4bb0084735f4433c46baa6bf
#   readContract get_verdict('live1-b') → BUYER_WINS, crit_1=MET, crit_2=NOT_MET
#   readContract get_verdict('live1-c') → INSUFFICIENT_EVIDENCE
# Full app in live mode: set .env GENLAYER_NETWORK=testnetBradbury,
# GENLAYER_CONTRACT_ADDRESS=0xA9199502C11C897a8550273Bcb7d8B1816DF4669,
# GENLAYER_PRIVATE_KEY=<your funded testnet key — never commit>, then npm start.
```

## 6. Remaining blockers → next action each

| Blocker | Next action |
|---|---|
| App attempt 4 still `LEADER_TIMEOUT` | Wait; then `PATCH /api/disputes/dsp_contested/adjudications` (or Refresh in UI). **Import only the latest decided request** — do not submit another tx while this one may still decide |
| App-level decided verdict import + API settlement execution not yet observed | Retry adjudication from the app when Bradbury validators are active (morning conditions decided 6/6 txs); all other live-path behaviours already proven |
| Contract direct-mode tests blocked | Upstream GenVM v0.3.0-rc7 binary returns HTTP 404 in `genlayer-test 0.29.2` (latest); rerun `pytest contracts/tests/test_direct.py` when the pinned asset is restored. Lint + on-chain execution already cover correctness |
| No public website / GitHub repo | `git push` the committed repo; deploy the app to a public URL; then submit portal evidence (contract address page + scenario txs above) per `docs/GENLAYER_DEPLOYMENT_REPORT.md` §11 |
| Deployer balance | ≈0.749 GEN remains — sufficient for further testnet adjudications; top up via https://testnet-faucet.genlayer.foundation if needed |

---

## Latest state — final verification run (2026-10-15, read-only; appended, history preserved)

**Repository:** branch `master`, HEAD `ee22f86` at run start (history: `0d96679 → 61e5923 → 8fda6bf → 411ff5d → ddb4090 → 3f253fc → 7dc7794 → ee22f86`), working tree clean, no remotes, no tracked secrets (`.env` ignored; verified via `git ls-files`).

**Reverified this run (fresh SDK reads):**
- Deployment tx `0x2ab58f01bf8a5371dad5a8c6d32612dcfbc8f2e10c9f010e83bfebc294e8f623`: **FINALIZED · AGREE · FINISHED_WITH_RETURN**; source SHA-256 recomputed from disk `9b90bd1eadd2ee82cfa98398c5613229d06fe17f4bb0084735f4433c46baa6bf`; on-chain `getContractCode` hash **identical**; schema = `adjudicate, get_case_status, get_snapshot_hash, get_verdict`.
- Scenarios: A (`0x55c81b…`) FINALIZED/AGREE/FINISHED_WITH_RETURN; B (`0x002e76…`, case `live1-b` DECIDED → **BUYER_WINS**); C (`0x1ef8f4…`, case `live1-c` DECIDED → **INSUFFICIENT_EVIDENCE**); D1 (`0x50023f…`) and D2 (`0xbdc846…`) FINALIZED with `FINISHED_WITH_ERROR` (rejected as designed); E by-design (single stable authorization record; no on-chain settlement function).
- App attempts: #1 FINALIZED/IDLE (no verdict, case UNKNOWN), #2 FINALIZED/DISAGREE (UNDETERMINED semantics, case UNKNOWN), #3 FINALIZED/IDLE/NOT_VOTED (case UNKNOWN), **#4 still `LEADER_TIMEOUT`** (case UNKNOWN). **No eligible decided verdict exists → nothing imported.** DB audit: 4 persisted requests (3 PENDING, 1 UNDETERMINED), **0 imported results, 0 settlements** — fail-safe and exactly-once behaviour verified. Lifecycle stops at: on-chain consensus (network stage), before verdict import — by design, resumable via Refresh (PATCH the latest request only).
- Frontend: `GET /api/auth/me` → `GENLAYER_TESTNET`, Bradbury 4221, contract `0xA9199502C11C897a8550273Bcb7d8B1816DF4669`. Live vs simulated remain strictly separated.

**Tests this run (fresh):** `npm test` (vitest) **14/14**; contract static pytest **9 passed**; direct-mode pytest **2 failed pre-execution** (upstream GenVM v0.3.0-rc7 binary HTTP 404 in `genlayer-test 0.29.2`, the latest — **non-blocking**: the verified live path, not the mocked direct mode, is the demonstration); `genvm-lint check` **passed**; `npm run build` **success**.

**Public demo / submission:** website **not publicly hosted** (no public URL exists — none claimed); GitHub **not published** (no remotes; ready to push); portal **not submitted**. Account-owner actions unchanged (§6).
