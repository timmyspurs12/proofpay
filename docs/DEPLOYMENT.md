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
