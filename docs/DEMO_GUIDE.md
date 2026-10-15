# Demonstration guide (10 minutes)

Start: `npm run db:setup && npm run dev` → http://localhost:3000

## 0. Landing (1 min)
Read the product statement, step through the interactive 4-stage demo
(Agree → Evidence → Adjudicate → Settle), and open the “What is live vs
simulated?” note. Everything simulated is labelled; there are no fake metrics.

## 1. Successful delivery (2 min) — replayable
1. Enter the workspace; sign in as **Elena Vasquez** (client). Open
   “Northwind Studio — brand & launch site” (SETTLED): terms v1, funding ref
   `demo-tx-s1fund01`, evidence register, executed settlement, receipt.
2. To replay it live: **New agreement** (as client, counterparty Kwame Mensah) →
   fund it → switch persona to **Kwame Mensah** (sidebar) → add evidence in the
   Evidence Studio → Submit work → switch back to Elena Vasquez → Accept → Execute
   settlement → open the receipt. Try executing twice: the second call returns
   the same receipt (idempotent).

## 2. Contested delivery (4 min) — the signature flow
1. Sign in as **Alex Chen** or **Kwame Mensah**; open the workspace dispute
   “Helio Health — booking API” → **Open dispute centre**.
2. Read the frozen criteria: `crit_2` is highlighted as disputed. Compare
   provider vs client evidence per criterion; read the claim/rebuttal timeline.
3. Add a rebuttal, or add evidence in the studio, then **Request adjudication**
   (simulated engine; rules are printed in the verdict rationale). Expected:
   PARTIAL_SETTLEMENT (crit_1 MET, crit_2 NOT_MET, crit_3 MET → 66.67% to the
   provider) or INSUFFICIENT_EVIDENCE if you remove evidence — never a guess.
4. Execute the authorized settlement; open the receipt. Note the decision
   record and the execution record are separate entries.

## 3. Insufficient evidence (2 min)
Open “Northwind — legacy orders migration” (dispute centre): a single chat
excerpt produced INSUFFICIENT_EVIDENCE with **no settlement authorized**. Add a
real dry-run report as Kwame Mensah (Evidence Studio, criterion crit_2) plus a
repository link (crit_1), then re-run adjudication and watch the outcome change
for a stated reason.

## 4. Safety checks (1 min)
- As Kwame Mensah, try opening Elena Vasquez↔Kwame Mensah's other agreement evidence
  (you are a party — allowed) vs. signing in and requesting an agreement id
  that isn't yours (403).
- On a funded agreement, try to amend terms: the API returns 409 TERMS_FROZEN.
- On any settlement, tick “Simulate execution failure”, execute → SETTLEMENT_FAILED,
  then retry → SETTLED.
- Activity explorer: filter by FAILED / SIMULATED to see failed and simulated
  operations kept on the record.

## What is simulated here
Funding, adjudication outcomes and settlement execution (demo ledger +
deterministic demo engine), all labelled. The GenLayer contract, adapter and
live polling are real code — deployment steps are in `docs/GENLAYER.md`.
