# Sarpply Operations Ledger

Phase 2 walking skeleton: a PostgreSQL ledger with a phone-first operator console. The database is
the system of record; application code renders and orchestrates, and never recomputes GP, Buffer
Stock value or the reconciliation identity.

## Stack

- **PostgreSQL 16** — schema, views and (in later tickets) functions. Migrations are plain SQL in
  `db/migrations/`.
- **Next.js 16 + TypeScript** — console shell in `src/app/`.
- **Vitest** — tests at the PostgreSQL seam only.
- **embedded-postgres** — starts a real PostgreSQL 16 cluster for development and tests when no
  external server is configured.

## Run it

```bash
npm install
npm run db:reset        # create, migrate, seed and load B01/B02 fixtures
npm run db:dev          # keep the embedded PostgreSQL server up (second terminal)
npm run dispatch        # poll due Cutoffs every 15 minutes (third terminal)
npm run dev             # console at http://localhost:3000
```

Cutoff is automatic. The dispatcher reads the poll interval from `dispatch_policy`, fires
`fn_fire_due_cutoffs()` and records each firing once. Opening the console also runs a catch-up
call, so a missed dispatcher tick cannot leave the screen showing a stale open batch.
`npm run dispatch -- --once` performs a single poll and exits.

## WhatsApp transport

One messaging port, two adapters. Application code sends through the port; no rule depends on the
provider.

- `WHATSAPP_PROVIDER=fake` (default) records the send in PostgreSQL without a network call, so the
  console works without credentials.
- `WHATSAPP_PROVIDER=cloud` uses the WhatsApp Cloud API and requires `WHATSAPP_ACCESS_TOKEN` and
  `WHATSAPP_PHONE_NUMBER_ID` (optionally `WHATSAPP_GRAPH_VERSION`).

The inbound webhook is `/api/whatsapp/webhook`. It verifies Meta's `X-Hub-Signature-256` HMAC with
`WHATSAPP_APP_SECRET`, rejects unsigned or forged deliveries, and stores each provider message id
once. The subscription handshake compares `WHATSAPP_VERIFY_TOKEN`. Voice notes are stored as
metadata only; nothing transcribes audio or creates an order.

The console's **Queue and send Tuesday broadcast** button queues Script B with the Pool Prices in
force and the seven-day voice-note line, then sends every queued row. A failed row stays in the log
as `FAILED`; **Retry failed** updates that same row, never a duplicate. Delivery is at-least-once:
the Cloud API has no idempotency key for a text send, so a lost acknowledgement can deliver the
same text twice even though the message row stays single.

`db:reset` stops its embedded server when it finishes, so `db:dev` keeps one running for the app.
Alternatively point `DATABASE_URL` at an existing PostgreSQL 16 server (see `.env.example`) and
skip `db:dev`. Next.js loads `.env.local` automatically; the scripts do too.

## Tests

```bash
npm test
```

The harness starts an isolated real PostgreSQL database, applies migrations, seeds, loads the
Phase 1 workbook fixtures, and queries through SQL. No database mock. If `TEST_DATABASE_URL` is
set, the harness resets the `public` schema of that database instead of starting an embedded
server.
