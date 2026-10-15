# Deployment

## Local / demo (default)

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev        # or: npm run build && npm start
```

SQLite file DB (`prisma/dev.db`), seeded demo users, simulated ledger and
simulated adjudication. No external credentials required.

## PostgreSQL

`docker-compose.yml` provides Postgres 16. To switch:

1. `docker compose up -d`
2. In `prisma/schema.prisma` change the datasource provider to `postgresql`.
3. Set `DATABASE_URL="postgresql://proofpay:proofpay@localhost:5432/proofpay"`.
4. `npx prisma migrate dev --name init && npm run db:seed`

(The committed schema targets SQLite so the demo runs with zero services;
the model uses only portable types — String ids, Int minor units, DateTime,
JSON-as-String — so the provider switch is mechanical.)

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | SQLite file or Postgres URL |
| `SESSION_SECRET` | yes (prod) | Long random value; signs the session cookie |
| `GENLAYER_NETWORK` | no | `studionet` (default) / `testnetBradbury` / `localnet` |
| `GENLAYER_CONTRACT_ADDRESS` | live mode | Deployed ProofPayAdjudicator address |
| `GENLAYER_PRIVATE_KEY` | live mode | Funded **testnet** key, server-side only |
| `NEXT_PUBLIC_APP_URL` | no | Public base URL |

## Production (live Bradbury) — exact requirements

One deployable: the Next.js app serves the frontend **and** the API from a
single Node 20 process. No separate frontend/backend hosting is required.

```bash
npm install
cp .env.example .env   # then set the values below
npx prisma generate
npm run db:setup       # schema + seed (or prisma migrate deploy on Postgres)
npm run build
npm start              # next start -p 3000 -H 0.0.0.0
```

| Requirement | Detail |
|---|---|
| Runtime | Node 20+, outbound HTTPS egress to `https://rpc-bradbury.genlayer.com` (server-side GenLayer calls) |
| Database | SQLite file (single-instance demo) or PostgreSQL 16 via `DATABASE_URL` (provider switch in `prisma/schema.prisma`, then `npx prisma migrate deploy`) |
| `DATABASE_URL` | **required** — SQLite path or Postgres URL |
| `SESSION_SECRET` | **required in production** — long random value; signs the session cookie. Behind HTTPS (TLS terminated at proxy/host), set `NEXT_PUBLIC_APP_URL` to the public `https://` URL |
| `GENLAYER_NETWORK` | set to `testnetBradbury` (chain 4221) |
| `GENLAYER_CONTRACT_ADDRESS` | `0xA9199502C11C897a8550273Bcb7d8B1816DF4669` (verified deployment) |
| `GENLAYER_PRIVATE_KEY` | **required for live mode** — dedicated funded *testnet* key. Server-side only; never prefix with `NEXT_PUBLIC_`, never in client bundles, logs, or repo files. The app's current live client constructs this signer for submissions **and** for verdict/status reads, so live mode is unavailable without it. The key controls no user funds (contract is non-custodial) but can spend its own testnet GEN on fees |
| CORS | none needed — API and UI are same-origin. Do not expose the API cross-origin without an explicit allowlist |
| Auth | demo uses persona login + HMAC session cookie; replace with wallet/OIDC before real users (see checklist below) |
| Health checks | `GET /` → 200 (landing); `GET /api/auth/me` → 200 with a `genlayer` block — assert `mode=GENLAYER_TESTNET`, network Bradbury, and the contract address above in deployment smoke tests |
| Modes | without the three `GENLAYER_*` values the app runs `DEMO_SIMULATED` and labels every simulated record — a safe fallback, never silently presented as live |

Post-deployment smoke tests: open `/`, `/app`, `/app/disputes`; confirm
Settings shows **GENLAYER_TESTNET · Bradbury · 0xA919…4669**; do **not**
submit a paid adjudication as a smoke test (each is a real consensus
transaction costing testnet GEN and minutes of validator time).

## Production checklist

- Replace demo persona login with wallet-signature auth (nonce flow in
  `lib/server/walletAuth.ts` + viem `verifyMessage`) or OIDC.
- Put rate limiting + idempotency stores behind Redis if running >1 instance.
- Store evidence binaries in object storage with signed URLs; keep only
  hashes/metadata in the DB (demo keeps binaries with the submitter).
- Back up the DB; audit events and versions are append-only by design.
- Never deploy with a funded mainnet key in `GENLAYER_PRIVATE_KEY`; the
  contract holds no funds by design — settlement execution for real assets
  requires a dedicated, audited escrow/payment adapter (see SECURITY.md).
