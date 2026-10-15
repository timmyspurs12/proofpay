# Security & limitations

## Enforced in this build

- **Server-side authorization:** every agreement/evidence/dispute/settlement
  route loads the record and checks party membership; non-parties get 403.
  Client-supplied user ids, settlement amounts and outcomes are ignored —
  amounts are recomputed from the funding record; verdicts are schema-validated.
- **Frozen terms:** funding requires a valid terms version; amendments are
  refused (409) once an agreement leaves DRAFT/CREATED. Disputes pin the exact
  version + terms hash used for adjudication.
- **Verdict gate:** outcomes outside {BUYER_WINS, SELLER_WINS,
  PARTIAL_SETTLEMENT, INSUFFICIENT_EVIDENCE}, malformed splits and uncited
  “definitive” verdicts are rejected or downgraded to INSUFFICIENT_EVIDENCE.
  An LLM/demo explanation alone never executes a payment: settlement needs a
  recorded definitive verdict (or client acceptance) + a separate execute call.
- **Idempotency:** funding, acceptance, adjudication and settlement execution
  are keyed; duplicates return the existing record. On-chain, one verdict per
  case is enforced by the contract.
- **State machine:** all transitions go through guarded `assertTransition`;
  SETTLED/CANCELLED/EXPIRED are terminal.
- **Evidence integrity:** sha256 of the submission snapshot is stored and
  shown. The UI states plainly that a hash proves submission content — not
  authorship, not correctness. Screenshots/URLs are never labelled “verified”.
- **Prompt-injection defence:** the contract prompt and the demo rules treat
  agreement/evidence text as untrusted data, never instructions. Deterministic
  checks (not the model) bound decisions and splits.
- **Input validation & limits:** typed validators on every body, https-only
  link evidence, 25 MB file cap, rate limits on auth/funding/evidence/
  dispute/adjudication/settlement routes, safe generic 500s.
- **Wallet login boundary:** nonce issue/consume with expiry and replay
  burning; refuses login until a real signature verifier is configured.
- **Secrets:** the GenLayer key is read server-side only; the SDK is
  dynamically imported in server code and never bundled for the browser.
- **Auditability:** append-only audit events, version history, and separate
  records for application state, adjudication state and settlement state.
  Pending is never rendered as completed.

## Known limitations (honest)

- Demo auth is a persona switcher for reviewers — fine for a labelled demo,
  not for production. Use the wallet/OIDC path in DEPLOYMENT.md.
- Demo ledger moves no assets. Real escrow custody is deliberately **not**
  claimed: the GenLayer contract holds no funds. A production payment rail
  needs its own audited adapter and reconciliation job.
- Evidence binaries are not uploaded to a server store in demo mode (name,
  size and text snapshots are hashed; screenshots/files stay with the
  submitter). Wire object storage + signed URLs for production.
- Rate limiting/idempotency are in-memory/single-instance; use Redis in
  multi-instance deployments.
- The Intelligent Contract is not yet deployed (no testnet key in this
  environment); live-mode code paths are implemented against the verified
  genlayer-js API but only the simulated path is exercised end-to-end here.
