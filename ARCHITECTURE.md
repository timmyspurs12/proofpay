# ProofPay — Architecture & Implementation Plan

## Research findings (verified 2026-10-14 against docs.genlayer.com)

| Topic | Verified fact | Source |
|---|---|---|
| Contract header | First line: `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`, then `from genlayer import *`, single class extending `gl.Contract` | docs.genlayer.com/developers/intelligent-contracts/first-contract |
| Storage | Class-level annotated fields; `TreeMap[K,V]`, `DynArray[T]`; `int` forbidden — use `u256`/`i32`/`bigint`; `@allow_storage @dataclass` for structs | …/storage |
| Methods | `@gl.public.view` / `@gl.public.write` / `@gl.public.write.payable`; `gl.message.sender_address`; storage must be copied (`gl.storage.copy_to_memory`) before use in nondet blocks | …/first-contract, …/storage |
| Non-determinism | `gl.nondet.exec_prompt(prompt, response_format="json")`, `gl.nondet.web.get(url)`; consensus via `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`; validators must independently re-derive and compare decision fields (never leader-output-only checks); `gl.eq_principle.strict_eq` only for exact/canonical outputs | …/equivalence-principle, …/crafting-prompts |
| Networks | Bradbury: RPC `https://rpc-bradbury.genlayer.com`, chain 4221, GEN, prod-like testnet. Studionet: `https://studio.genlayer.com/api`, chain 61999. Localnet: `http://localhost:4000/api`, chain 61127 | …/networks |
| JS SDK | `genlayer-js`: `createClient({chain, account?, provider?})`, `createAccount()`, `readContract`, `writeContract`, `waitForTransactionReceipt({hash, status})`, `client.connect('studionet')`, chains `testnetBradbury`/`studionet`/`localnet` from `genlayer-js/chains`, `TransactionStatus` from `genlayer-js/types` | npm genlayer-js; docs …/decentralized-applications/writing-data |
| Testing | `genlayer-test` (direct mode: `pytest tests/direct/`, fixtures `direct_vm/direct_deploy/direct_alice`, `direct_vm.mock_llm/mock_web/expect_revert`), `genvm-linter` (`genvm-lint check`) | …/tooling-setup |
| Finality | EVM inclusion ≠ GenLayer outcome; follow GenLayer tx until `Finalized`. Statuses via `gen_getTransactionReceipt` | …/core-concepts/transactions |

No SDK functions, endpoints, or statuses beyond the above are used. Anything not verifiable is behind an explicit adapter boundary.

## Stack decision

- **Next.js 14 (App Router) + TypeScript + Tailwind** — one deployable containing the workspace UI and the Node API (`app/api/*`). Keeps the demo runnable with a single `npm run dev`; backend code is modular under `lib/server/` so it can be split later.
- **Prisma + SQLite (local/demo) / PostgreSQL (production)** — same schema; `docker-compose.yml` provides Postgres; switch via `DATABASE_URL` + provider note in `docs/DEPLOYMENT.md`. Migrations in `prisma/migrations/`.
- **GenLayer** — real Intelligent Contract in `contracts/proofpay_adjudicator.py`; server-side `genlayer-js` adapter in `lib/genlayer/`. Without `GENLAYER_CONTRACT_ADDRESS` + a funded Bradbury/Studionet key the app runs **Demo Adjudication** (deterministic evidence-scoring engine) and labels every record `SIMULATED`. Demo tx ids are `demo-tx-…` — never presented as chain hashes.
- **Auth** — demo persona session (httpOnly cookie) for clients/providers; object-level authorization enforced server-side on every route. Wallet-signature login boundary (`lib/server/walletAuth.ts`) implements nonce + expiry + replay checks; production signature verification plugs in via `viem` (documented, not faked).

## Domain state machine

`DRAFT → CREATED → FUNDED → SUBMITTED → UNDER_REVIEW → (ACCEPTED → SETTLEMENT_PENDING → SETTLED) | (DISPUTED → ADJUDICATING → DECIDED → SETTLEMENT_PENDING → SETTLED)`, plus `CANCELLED`, `EXPIRED`, `ADDITIONAL_EVIDENCE_REQUIRED`, `SETTLEMENT_FAILED` (retryable). All transitions guarded in `lib/domain/stateMachine.ts`; settlement is idempotent (`Idempotency-Key` + unique settlement key) and bounded by the funded amount and the contract-authorized split.

## Separation of state

Application state (Prisma) · GenLayer contract state (tx id/status fetched via adapter) · Settlement state (`SettlementInstruction` rows) are stored and reconciled independently; pending is never rendered as completed.

## Phases

1. ✅ Research (above) 2. Visual system + routes 3. DB/API/state machine 4. Intelligent Contract + Python tests 5. Frontend wiring (evidence, dispute centre) 6. Settlement safeguards + tx tracking 7. Demo scenarios + tests + a11y 8. Docs + handoff.
