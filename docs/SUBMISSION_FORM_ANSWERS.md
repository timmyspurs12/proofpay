# ProofPay — portal submission form answers (paste-ready)

Live: https://proofpay-ltid.vercel.app · GitHub: https://github.com/timmyspurs12/proofpay

## 01 Identity
- **Logo:** upload `proofpay-logo.png` (workspace root, 512×512 PNG).
- **Project name:** ProofPay
- **Primary tag:** Dispute Resolution
- **Tag 1 / Tag 2:** pick the two closest available topics to *Escrow / Payments* and *AI adjudication / arbitration*.

## 02 One-liner (172/180)
Escrow that remembers what was agreed — ProofPay freezes acceptance criteria before funding and lets a GenLayer Intelligent Contract decide disputes criterion-by-criterion.

## 03 Description (908/1000)
ProofPay is escrow for knowledge work with a memory. Before funding, client and provider freeze acceptance criteria; the terms are hashed into the record and cannot be silently edited afterward. Both parties submit hashed evidence into one shared register. If delivery is disputed, the ProofPayAdjudicator Intelligent Contract on GenLayer Bradbury (testnet) compares each side's evidence against the frozen criteria and stores a criterion-level verdict (SELLER_WINS / BUYER_WINS / INSUFFICIENT_EVIDENCE with per-criterion MET / NOT_MET findings). Settlement amounts are recomputed deterministically off-chain — never emitted by a model — and executed idempotently; the contract authorizes and records verdicts, it does not custody funds. The live web app runs in GENLAYER_TESTNET mode against the deployed contract with seeded demo disputes; simulated records, where used, are always labelled DEMO_SIMULATED.

## 04 Demo video
Optional — leave blank for now, or record later using `docs/DEMO_SCRIPT.md` (3–5 min) and paste the YouTube/X link.

## 05 How-to (exact path)
1. **Open the live app** — Go to https://proofpay-ltid.vercel.app and click "Open workspace".
2. **Sign in as a demo persona** — Choose Elena Vasquez (client) or Kwame Mensah (provider). Synthetic demo users; no credentials needed (hard-refresh if personas do not appear).
3. **Open the contested dispute** — Open "Helio Health — booking API" (dispute dsp_contested): crit_2 disputed milestone 2, frozen terms-v1 SHA-256, both parties' evidence in one register, no verdict unless both sides submitted.
4. **Confirm live GenLayer mode** — Open Settings / Protocol status: mode GENLAYER_TESTNET, network GenLayer Testnet Bradbury (chain 4221), contract 0xA9199502C11C897a8550273Bcb7d8B1816DF4669, with explorer link.
5. **Verify the contract on-chain** — Open the contract link (section 06): deployment FINALIZED with scenario verdicts stored; readable via get_verdict / get_case_status.
6. **Read the source** — GitHub repo, contracts/proofpay_adjudicator.py; its SHA-256 matches the deployed on-chain code.

## 06 Review verification
**Expected verification outcome (≤500):**
Bradbury explorer shows ProofPayAdjudicator deployed (link below; deploy tx 0x2ab58f01...f623, FINALIZED, AGREE). Scenario verdicts (SELLER_WINS, BUYER_WINS, INSUFFICIENT_EVIDENCE) are stored on-chain, readable via get_verdict; tx hashes are in the GitHub deployments/ records. Website Settings reports GENLAYER_TESTNET with this contract; GitHub source sha256 matches on-chain code. App-submitted adjudications are FINALIZED on-chain; verdicts import only on a decided result.

**Contract link 1:** https://explorer-bradbury.genlayer.com/address/0xA9199502C11C897a8550273Bcb7d8B1816DF4669

## 07 Project links
- **Website (required):** https://proofpay-ltid.vercel.app
- **GitHub:** https://github.com/timmyspurs12/proofpay

**Evidence — add each as its own item.** NOTE: the portal's validator rejects `/tx/…` URLs
("URL must point to a 20-byte contract address") — use the contract ADDRESS URL; its
transaction list contains the deployment and every scenario call.
1. GitHub Repository (required type): https://github.com/timmyspurs12/proofpay
2. Deployed contract (Bradbury explorer, address page): https://explorer-bradbury.genlayer.com/address/0xA9199502C11C897a8550273Bcb7d8B1816DF4669
3. Live app: https://proofpay-ltid.vercel.app

Reference only (do NOT paste into validated URL fields — tx hashes rejected; they are
visible on the address page above and recorded in GitHub `deployments/`):
- Deployment tx (FINALIZED): 0x2ab58f01bf8a5371dad5a8c6d32612dcfbc8f2e10c9f010e83bfebc294e8f623
- Scenario BUYER_WINS tx: 0x002e761f99830a1ba16bb1259028824158bbb09142238bd093586c2fc9b0c26d
- Scenario INSUFFICIENT_EVIDENCE tx: 0x1ef8f4bb59bd038ab438cb635cc4fb1ae9afb14b16f92209fb5e40365b2d0749
