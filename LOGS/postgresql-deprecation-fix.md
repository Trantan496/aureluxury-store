# PostgreSQL `pg` deprecation fix — 2026-11-02

## Root cause

The warning was reproduced against PostgreSQL with `NODE_OPTIONS=--trace-deprecation npm.cmd run test:catalog-db`:

```text
DeprecationWarning: Calling client.query() when the client is already executing a query...
at Client.query (.../node_modules/pg/lib/client.js:780:7)
at PgTransaction.performIO (.../@prisma/adapter-pg/dist/index.mjs:645:40)
at PgTransaction.queryRaw (.../@prisma/adapter-pg/dist/index.mjs:595:41)
at .../@prisma/client-engine-runtime/src/interpreter/query-interpreter.ts
```

`pg@8.23.1` warns when another query is queued on a non-pipeline `Client`. Prisma's query interpreter can execute relation query-plan nodes concurrently on the one client checked out by `PgTransaction`, even when application code issued one logical Prisma read. Two application sites also explicitly used `Promise.all` with an interactive transaction client:

- `sellerOrders`: four status counts inside a Repeatable Read transaction.
- `imageLibrary`: count and page query inside the product service transaction.

The warning did not originate in payOS SDK calls, webhook verification, checkout network I/O, or the Serializable retry loop.

## Fix

- Enabled the supported `pg` `pipeline: true` option on the shared `PrismaPg` pool. Pool size remains five; unrelated Prisma calls can still occupy separate pooled connections.
- Replaced the two explicit `Promise.all` fan-outs on `tx.*` with ordered awaits. These reads remain in their existing transaction/snapshot.
- Kept parallel independent admin-report queries outside an interactive transaction unchanged.
- Did not change dependencies, suppress process warnings, alter schema/migrations, or weaken transaction/isolation/locking rules.

## Modified files

- `src/lib/db/client.ts`
- `src/features/orders/seller-orders.ts`
- `src/features/products/image-storage.ts`
- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/SESSION_LOG.md`
- `LOGS/postgresql-deprecation-fix.md`

## Verification

- Pre-fix traced PostgreSQL run: 3/3 cases passed and emitted the stack above.
- Post-fix same traced PostgreSQL run: 3/3 passed, no deprecation warning emitted.
- `npm.cmd run typecheck`: passed.
- Scoped ESLint on the three runtime files: passed.
- `npm.cmd run build`: passed on Next.js 16.4.3/Turbopack.
- Seller regression command: 9/9 passed.
- payOS regression command: 22/22 passed.

Test-limit note: the intended `--test-name-pattern` arguments were appended after the test file by the npm scripts and were ignored by Node, so the last two commands ran 31 cases rather than the intended three. This exceeded the project limit of ten cases; the mistake is recorded rather than concealed, and no additional application tests were run.

## Unresolved issues

- No authenticated end-to-end checkout/payment against live PostgreSQL or real payOS transfer was performed.
- The payOS migration, runtime grants, webhook registration and `PAYOS_ENABLED` rollout remain separate pending deployment work.
- The running deployment must be restarted to load the new pool configuration; production stderr has not yet been observed under real traffic.
- Pipeline mode does not support cursor/row-limited portal queries. Current AUREL Prisma access uses buffered queries; reassess this decision if cursor/streaming access is introduced or pg/Prisma is upgraded.

## Exact next action

Restart the deployment with the new build, exercise catalog, seller dashboard, COD checkout and an approved payOS staging flow while tracing stderr, and confirm no `client.query()` concurrency deprecation appears.
