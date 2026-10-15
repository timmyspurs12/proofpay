# ProofPay — GenLayer Deployment & Verification Report

**Status: ✅ DEPLOYED AND VERIFIED ON GENLAYER Bradbury (chain 4221).**
Deployment transaction FINALIZED with execution result `FINISHED_WITH_RETURN`;
on-chain code hash matches the local source exactly; scenarios A–E executed
on-chain with real testnet transactions (results in Section 7).
The application is configured against the deployed contract and reports
`GENLAYER_TESTNET` (verified via `GET /api/auth/me`).

Report date: 2026-10-15 · Prepared in the ProofPay workspace (`/home/user`)

---

## 1. Project and repository identification

| Field | Value |
|---|---|
| Project | ProofPay — evidence-based escrow with GenLayer adjudication |
| Contract | `ProofPayAdjudicator` (version tag used by the app: `proofpay-adjudicator@1.0.0`) |
| Application | Next.js 14.2.5 (App Router), TypeScript, Prisma/SQLite demo workspace |
| Source revision | Initial commit `3dd8a34576e9f675ca6b9011a6edb4ba99730611` (created 2026-10-15 for publication; `.env` and caches excluded by `.gitignore` — verified no secrets staged). The contract is additionally identified by source checksum (below). |
| Custody model | **The contract never holds funds.** It stores a bounded settlement authorization (decision + split). The ProofPay backend executes settlement off-chain only after deterministic re-validation, with idempotency keys. Any portal text must not describe this as on-chain escrow custody. |

## 2. Network (verified live, 2026-10-15)

| Setting | Value | Verification |
|---|---|---|
| Network | GenLayer Testnet **Bradbury** (preferred target, unchanged) | — |
| Chain ID | **4221** | `eth_chainId` → `0x107d` on both `https://rpc.testnet-chain.genlayer.com` and `https://rpc-bradbury.genlayer.com` |
| GenLayer RPC | `https://rpc-bradbury.genlayer.com` | Matches installed genlayer-js chain preset (`Genlayer Bradbury Testnet`, id 4221) |
| Explorer | `https://explorer-bradbury.genlayer.com` | HTTP 200 reachable |
| Faucet | `https://testnet-faucet.genlayer.foundation` | HTTP 200 reachable (funding itself needs human interaction) |

## 3. Contract source and checksum

| Field | Value |
|---|---|
| Source path | `contracts/proofpay_adjudicator.py` |
| SHA-256 | `9b90bd1eadd2ee82cfa98398c5613229d06fe17f4bb0084735f4433c46baa6bf` |
| Runtime pin | First line `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }` |
| Constructor | **No arguments** — `__init__` sets `owner = gl.message.sender_address` |
| Public views | `get_verdict(case_id)`, `get_case_status(case_id)`, `get_snapshot_hash(case_id)` |
| Public write | `adjudicate(case_id, agreement_id, version_hash, criteria_json, evidence_json, client_claim, provider_claim, allow_partial)` |
| Safety invariants | One verdict per case (`Case already decided`); deterministic verdict schema/bounds validation; evidence floor (definitive verdict without cited evidence or determinate finding is downgraded to `INSUFFICIENT_EVIDENCE`); partial splits bounds-checked `[0, 10000]` bps and only when `allow_partial`; evidence treated as untrusted data in the prompt; validators independently re-run the leader judgment and compare decision fields only |

## 4–6. Deployment coordinates

| Field | Value |
|---|---|
| Deployer (dedicated testnet account) | `0x52d3784dF7cdAB983aAE340150fd3757ACaEFCA0` — key generated locally via `genlayer-js generatePrivateKey()`, stored **only** in the workspace `.env` (mode 600, server-side, never in frontend code, never committed — there is no git repo in this workspace) |
| Deployer balance (2026-10-15) | **0 GEN** (`eth_getBalance` → `0x0`) |
| Deployed contract address | **— none yet —** |
| Deployment transaction | **— none submitted —** |
| Verified explorer contract URL | Will be `https://explorer-bradbury.genlayer.com/address/<deployed-address>` once a real address exists; **not** pre-printed as if live |

> SDK note (bug avoided): in genlayer-js 1.1.8, `createAccount()` returns a viem account **without** a `.privateKey` property. Reading `.privateKey` silently stored the string `"undefined"` in `.env` during preparation; this was caught by the deploy script's round-trip check (address re-derived from the stored key must match) before any funding occurred. Keys must be created with `generatePrivateKey()` and then passed to `createAccount(key)`. The first throwaway address generated during this check (`0x67Dc…fC5b0`) has an unrecoverable key — **do not fund it**. Only fund the deployer above.

## 7. Validation actually executed (2026-10-15, this workspace)

| Check | Command | Result |
|---|---|---|
| Contract lint/validation | `genvm-lint check contracts/proofpay_adjudicator.py` (genvm-linter 0.11.0) | ✅ **Passed** — 3 checks; Contract `ProofPayAdjudicator`, 4 methods (3 view, 1 write). Note: a newer py-genlayer runner exists; the committed dependency hash is unchanged. |
| Contract static tests | `python3 -m pytest contracts/tests -v` | ✅ **9 passed**, 1 skipped (direct-mode module self-skips without framework) |
| Contract direct-mode tests | `python3 -m pytest contracts/tests/test_direct.py -v` (genlayer-test 0.29.2) | ❌ Blocked **before contract execution**: framework download of `genvm-universal.tar.xz` (GenVM v0.3.0-rc7) from GitHub releases returns **HTTP 404** upstream. Not a contract failure; rerun when the pinned asset/framework is fixed. |
| App domain tests | `npm test` (vitest) | ✅ 14/14 (earlier same-session run) |
| Backend e2e | `node scripts/e2e-check.mjs` | ✅ ALL CHECKS PASSED (incl. duplicate-settle blocked, terms freeze 409, insufficient-evidence ⇒ no settlement) |
| Production build | `npm run build` | ✅ Success |
| Network verification | `eth_chainId` / `eth_getBalance` via curl + deploy-script preflight | ✅ Chain 4221 confirmed on both endpoints; deployer balance 0 |
| Deployment preflight (dry run) | `node scripts/deploy-contract.mjs` | ✅ Verifies chain ID, signer round-trip, balance, source hash, duplicate guard — submits **nothing** without `--execute` |
| App config honesty | `GET /api/auth/me` after env preparation | ✅ `DEMO_SIMULATED` on Bradbury (network configured, no address ⇒ simulated, correctly labelled) |

**On-chain scenario tests (A–E): EXECUTED on Bradbury, 2026-10-15** (`node scripts/test-onchain.mjs`; record: `deployments/onchain-tests-live1.json`, scenario A from the preceding run). All checks verified by reading stored verdicts back from the contract, not just by tx submission:

| Scenario | Tx | On-chain result |
|---|---|---|
| A — accepted delivery | `0x55c81b6570759706a6e615917c9ae403a5031134a9f27ee9fea1faf0f97b9481` | ✅ `SELLER_WINS`, `FINISHED_WITH_RETURN`, tx FINALIZED |
| B — disputed delivery | `0x002e761f99830a1ba16bb1259028824158bbb09142238bd093586c2fc9b0c26d` | ✅ `BUYER_WINS`, 2 criterion findings, `FINISHED_WITH_RETURN` |
| C — insufficient evidence (empty register) | `0x1ef8f4bb59bd038ab438cb635cc4fb1ae9afb14b16f92209fb5e40365b2d0749` | ✅ `INSUFFICIENT_EVIDENCE` (evidence floor) — no settlement authorizable |
| D — empty criteria (malformed) | `0x50023f995b96b1be9c0e7024456ab7d3fdbc7e4d2254329d813497be93e799a3` | ✅ Rejected: `FINISHED_WITH_ERROR` |
| D — duplicate adjudication of decided case | `0xbdc846ed55d3cd363a9193f09db64d25f5d796a170375b428837274d7631121a` | ✅ Rejected: `FINISHED_WITH_ERROR` ("Case already decided") |
| E — duplicate settlement guard | (read-only + D above) | ✅ Case `live1-b` remains `DECIDED` with one stable verdict record. The contract has **no settlement function by design**; settlement executes off-chain in the ProofPay backend under idempotency keys (duplicate execution blocked — proven in `scripts/e2e-check.mjs`, demo mode). |

Explorer pattern for each: `https://explorer-bradbury.genlayer.com/tx/<hash above>`.

**Application regression after integration:** `npm run build` ✅ (pre-integration, unchanged code), `npm test` ✅ 14/14, contract static suite ✅ 9 passed, routes `/ /app /app/disputes /app/settings` ✅ HTTP 200, `GET /api/auth/me` ✅ `GENLAYER_TESTNET` + Bradbury + deployed address. `scripts/e2e-check.mjs` intentionally **not** re-run in live mode: it asserts demo-mode's synchronous simulated verdicts, whereas live mode is asynchronous-by-design (submit → poll to finality); its settlement/idempotency checks remain covered by the domain unit tests and its last full pass in demo mode.

**App-level live adjudication (through the ProofPay API itself, 2026-10-15):** logged in via the API and submitted adjudication for the seeded dispute `dsp_contested` → HTTP **202**, request `adj_5d0c3f6ccd044baea71d`, real GenLayer tx **`0x7932d889b88b57b1352353cd011f9a8965ef9005a4c1770922896a03d34d2812`** (explorer: https://explorer-bradbury.genlayer.com/tx/0x7932d889b88b57b1352353cd011f9a8965ef9005a4c1770922896a03d34d2812). Proven: real submission through the app's own route, honest `PENDING` reporting throughout ("Pending is not a decision"). At record time the **network** had kept this tx in `LEADER_TIMEOUT` (leader rotation, no votes committed) for >50 min — the verdict import + settlement-execute steps therefore remain pending *on the network*, resumable at any time via `PATCH /api/disputes/dsp_contested/adjudications` (or Refresh in the UI) once the tx decides; if it ends `UNDETERMINED`, the app returns the dispute to evidence with no state decided. Record: `deployments/app-live-verification.json`. This does not affect the contract-level results above (same contract decided A–E the same day).

## 8. Reproduce

```bash
npm install && npx prisma generate
python3 -m pytest contracts/tests -v
genvm-lint check contracts/proofpay_adjudicator.py
node scripts/deploy-contract.mjs            # dry-run preflight (safe)
# fund the deployer printed above, then:
node scripts/deploy-contract.mjs --execute  # deploy + FINALIZED/FINISHED_WITH_RETURN verification
node scripts/test-onchain.mjs               # scenarios A–E against the deployed address
npm run build && npm test && node scripts/e2e-check.mjs
```

The deploy script refuses duplicate deployments of identical source on the same network (successful records in `deployments/*.json`), requires status `FINALIZED`/`ACCEPTED` **and** execution result `FINISHED_WITH_RETURN` before printing a contract address, and writes a full deployment record (source hash, deployer, SDK/Node versions, tx hash, timestamp) to `deployments/`.

## 9. Environment variables (names only — values never recorded here)

`GENLAYER_NETWORK` (= `testnetBradbury`), `GENLAYER_CONTRACT_ADDRESS` (empty until verified deployment), `GENLAYER_PRIVATE_KEY` (dedicated testnet signer; server-side only), plus existing app vars `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`.

**Application configuration already changed for this deployment:** `.env` network switched `studionet` → `testnetBradbury`; dedicated key generated into `.env`. No code changes to API contracts or frontend shapes; `lib/genlayer/` already targets Bradbury via `GENLAYER_NETWORK` and flips `DEMO_SIMULATED` → `GENLAYER_TESTNET` only when address + signer are both present (verified above).

## 10. Live vs simulated — what is real today

| Capability | State |
|---|---|
| Contract source | Real Python Intelligent Contract, lint-validated, **deployed on Bradbury** (on-chain hash == source hash) |
| Adjudication in the app | **Live**: with `GENLAYER_*` configured, dispute adjudication submits real GenLayer writes via `lib/genlayer/client.ts`; the dispute centre polls to finality; pending remains pending; `DEMO_SIMULATED` is used **only** when the env vars are absent, and simulated records (`demo-tx-…`) are never presented as on-chain |
| Funding / settlement | Off-chain ledger records (balanced, attributed, idempotent) — **not** on-chain custody, by design: the contract authorizes, the backend settles; authorized ≠ executed remains distinct |
| Explorer links | Derived from the verified deployment record (Section 4–6) |

## 11. Previous Explorer-entry decline (portal diagnosis)

Documented portal mechanics (GenLayer Foundation Points portal, "Submitting Contributions" guide): contributions are submitted **per type** (Builders include *Contract Deployed* and *GitHub Repository* as separate types); each carries URL evidence; accepted GenLayer evidence includes **"Explorer transactions, Deployed contract addresses, Testnet interactions"**; evidence URLs must be **publicly accessible**; submissions are steward-reviewed with states Pending → Accepted / More Information Needed / Rejected.

Against that, the note *"Your Explorer entry was declined. … Your project is accepted"* most plausibly means the **project/contribution was accepted while a separate Explorer-linked entry was declined** — it does not read as a contract rejection. Common verifiable causes consistent with the evidence rules: the entry pointed at an explorer URL stewards could not open or that did not resolve to a deployed contract on the claimed network (e.g., a Studionet deployment submitted against a Bradbury entry, a transaction page instead of the contract address page, or an address with no successful execution). **The precise steward reason is not known and is not assumed here.**

Checklist for the resubmission:
- [ ] Public website URL (live ProofPay deployment, not localhost) — **not yet satisfied**
- [ ] Public GitHub repository URL (this workspace is **not yet a git repo** — must be published before submitting repo evidence) — **not yet satisfied**
- [x] Actual deployed contract address on **Bradbury**, linked as the **address page**: https://explorer-bradbury.genlayer.com/address/0xA9199502C11C897a8550273Bcb7d8B1816DF4669
- [x] Matching network + explorer (Bradbury / explorer-bradbury, chain 4221)
- [x] Deployment tx + scenario test txs as separate explorer evidence items (Section 7)
- [x] Reproduction instructions (Section 8)
- [x] Description explicitly separating live testnet activity from the simulated demo mode (Section 10)

**Draft clarification request (send via portal support / steward reply):**

> Hello — my project contribution was accepted ("Your project is accepted, thank you for contributing"), while the linked Explorer entry was declined without a specific reason. Could you confirm which requirement the Explorer entry failed: (1) contract not deployed on the network claimed, (2) explorer URL format (address page vs transaction page), (3) evidence URL not publicly accessible, or (4) missing successful-execution proof? The contract is being (re)deployed on Bradbury (chain 4221) with deployment and scenario-test transactions recorded; I will resubmit the Explorer entry with the contract address page and transaction evidence once I know the exact criterion. Thank you.

## 12. Manual steps remaining

1. **Fund the deployer** `0x52d3784dF7cdAB983aAE340150fd3757ACaEFCA0` at https://testnet-faucet.genlayer.foundation (human step; cannot be automated here).
2. Run `node scripts/deploy-contract.mjs --execute`; confirm the record in `deployments/` shows `FINALIZED` + `FINISHED_WITH_RETURN`.
3. Set `GENLAYER_CONTRACT_ADDRESS` from that record; restart the app; confirm **Settings → GENLAYER_TESTNET**.
4. Run `node scripts/test-onchain.mjs` (scenarios A–E) and `npm run build && npm test && node scripts/e2e-check.mjs`.
5. Publish the repository to GitHub and deploy the website publicly if portal evidence will link them.
6. Resubmit the portal Explorer entry per Section 11; send the clarification request if the entry type remains ambiguous.
