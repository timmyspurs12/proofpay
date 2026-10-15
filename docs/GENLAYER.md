# GenLayer integration

## What was verified (2026-10-14, docs.genlayer.com)

- Contract form: first line `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }`,
  `from genlayer import *`, one `gl.Contract` subclass, `@gl.public.view` /
  `@gl.public.write`, storage annotations with `TreeMap`/`DynArray`
  (`docs/developers/intelligent-contracts/first-contract`, `…/storage`).
- Non-determinism: `gl.nondet.exec_prompt(prompt, response_format="json")`
  inside `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`; validators must
  independently re-derive and compare decision fields — leader-output-only
  checks are explicitly not consensus (`…/equivalence-principle`, `…/crafting-prompts`).
- Networks (`…/networks`): Studionet RPC `https://studio.genlayer.com/api`
  chain 61999; Testnet Bradbury RPC `https://rpc-bradbury.genlayer.com`
  chain 4221 (GEN, faucet at testnet-faucet.genlayer.foundation); Localnet
  `http://localhost:4000/api` chain 61127.
- JS SDK `genlayer-js@1.1.8` (installed & inspected): `createClient`,
  `createAccount(privateKey)`, `readContract({address, functionName, args})`,
  `writeContract({account, address, functionName, args, value})`,
  `getTransaction({hash})`, `waitForTransactionReceipt({hash, status})`,
  chains `studionet` / `testnetBradbury` / `localnet` from `genlayer-js/chains`,
  `TransactionStatus` from `genlayer-js/types`.
- Finality: EVM inclusion ≠ outcome; follow the GenLayer transaction until
  FINALIZED (`…/core-concepts/transactions`).

## Contract design — `contracts/proofpay_adjudicator.py`

- State (public on-chain, no private data): `verdicts`, `case_status`,
  `case_snapshots` as `TreeMap[str, str]`; owner address.
- `adjudicate(case_id, agreement_id, version_hash, criteria_json,
  evidence_json, client_claim, provider_claim, allow_partial)`:
  1. Deterministic pre-checks (ids present, one verdict per case, schemas).
  2. Non-deterministic judgment: leader prompts an LLM for the structured
     verdict; validators independently re-run and compare decision, split
     (≤500 bps tolerance) and per-criterion findings.
  3. Deterministic post-validation (`_validate_verdict`): allowed outcomes
     only, split within [0, 10000] and only when the agreement authorizes
     partial settlement, evidence refs filtered to the real register, and an
     **evidence floor** forcing INSUFFICIENT_EVIDENCE when nothing citable
     supports a definitive outcome.
- The prompt treats all party content as UNTRUSTED DATA (prompt-injection
  defence). The contract **holds no funds** and exposes no payable/transfer
  surface: it returns a bounded settlement *instruction*; execution happens
  off-chain under deterministic authorization (`lib/domain/settlement.ts`).
- Views: `get_verdict(case_id)`, `get_case_status(case_id)`,
  `get_snapshot_hash(case_id)`.

Inputs are snapshots: only criteria text, evidence ids/types/titles, short
summaries and content hashes go on-chain. Full evidence stays off-chain under
party-only access. URLs are never assumed immutable — the hash recorded at
submission is what adjudication cites.

## Deploy (Bradbury — DEPLOYED & VERIFIED 2026-10-15)

**Deployed contract: `0xA9199502C11C897a8550273Bcb7d8B1816DF4669`** (Bradbury,
chain 4221) — deployment tx FINALIZED with `FINISHED_WITH_RETURN`, on-chain
code hash matches source. See `docs/GENLAYER_DEPLOYMENT_REPORT.md` for the
full record, scenario results, and reproduction commands.

```bash
# 1. Fund the dedicated deployer (address printed by the dry run below)
#    with test GEN: https://testnet-faucet.genlayer.foundation
# 2. Preflight (submits nothing; verifies chain ID, signer, balance,
#    source hash, and duplicate-deployment guard):
node scripts/deploy-contract.mjs
# 3. Deploy + verify (FINALIZED and FINISHED_WITH_RETURN required):
node scripts/deploy-contract.mjs --execute
# 4. Put the verified address from deployments/*.json into .env:
#    GENLAYER_CONTRACT_ADDRESS=0x…(from the verified deployment record)
#    GENLAYER_NETWORK=testnetBradbury   (already set)
#    GENLAYER_PRIVATE_KEY=<dedicated testnet key — local .env only>
# 5. Restart; Settings shows GENLAYER_TESTNET on Bradbury.
# 6. Exercise the live contract (scenarios A–E, real testnet writes):
node scripts/test-onchain.mjs
```

The GenLayer CLI (`genlayer deploy`) and Studio remain valid alternatives;
this project deploys through the same genlayer-js SDK the backend already
uses, so the deployed bytecode path and the runtime invocation path cannot
drift apart.

## Testing the contract

```bash
npm run contract:test                    # static/structural suite (anywhere)
pip install genlayer-test genvm-linter   # per official Tooling Setup
genvm-lint check contracts/proofpay_adjudicator.py
pytest contracts/tests/test_direct.py -v # direct mode with mocked LLM
```

Status from this build (executed 2026-10-14 in the project workspace):
- `genvm-lint check contracts/proofpay_adjudicator.py` (genvm-linter 0.11.0):
  **Lint passed (3 checks); Validation passed — Contract ProofPayAdjudicator,
  4 methods (3 view, 1 write).** It notes a newer py-genlayer runner exists
  (1zr6nqk…); the committed header uses the runner hash published on the
  official First Contract page.
- Static/structural pytest suite: **9 passed**.
- Direct-mode suite (`genlayer-test 0.29.2`): both tests currently fail
  **before contract execution** because the framework tries to download
  `genvm-universal.tar.xz` for GenVM v0.3.0-rc7 from GitHub releases and the
  asset returns HTTP 404 (verified with curl). This is an upstream tooling
  issue, not a contract error — re-run once the pinned GenVM asset is
  published or the framework is updated.
- The contract has **not** been deployed from this environment (no funded
  testnet key was available), so live mode is exercised only through the
  adapter boundary. Deployment steps above are the exact follow-up.
