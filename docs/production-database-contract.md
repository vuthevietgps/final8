# Production database contract

The backend must not receive a production MongoDB credential from source code, a Docker image, or a committed compose file. Inject `MONGODB_URI` from the deployment secret manager and rotate any credential that has previously appeared in Git.

## Required topology and URI policy

- MongoDB must be a writable replica set, sharded cluster, or supported load-balanced deployment with logical sessions and multi-document transactions.
- TLS, `retryWrites=true`, and an acknowledged majority write concern must be enforced by the managed cluster or URI policy.
- Use a dedicated least-privilege application user for the intended production database. It needs normal application reads/writes plus permission to inspect indexes for readiness.
- Set `REDIS_URL` for multi-pod deployments. A single pod may intentionally use the in-memory cache.
- Never log or echo the raw URI. `DB_READINESS_TIMEOUT_MS` may be set from 500 to 30000 milliseconds.

## Required readiness evidence

`GET /health/ready` returns HTTP 200 only when all of these checks pass:

1. MongoDB ping succeeds.
2. The connected server is writable.
3. The topology supports transactions and logical sessions.
4. Financial policy/snapshot unique indexes exist.
5. Cashflow, Owner Fund and loan-payment idempotency indexes exist, including the scheduled-repayment and singleton active Owner Fund constraints.
6. Google Ads execution idempotency and financial lease indexes exist.

The readiness response intentionally excludes URI, host, database name, collection names, document counts, and driver error text.

Before enabling Financial Control decisions, verify the canonical `financial_control` policy, then call `POST /api/financial-control/snapshots/rebuild` as a Director to rebuild and verify fresh labor, operations, agent, and supplier snapshots. Enter a separately evidenced tax obligation through `PUT /api/financial-control/tax-obligation`; the ERP never seeds a fake zero-tax value. Database backup/PITR and a tested restore procedure remain deployment prerequisites.

Run `npm run db:indexes:check` with `MONGODB_URI` injected to audit indexes without writes. After backup and duplicate-data review, `npm run db:indexes:apply` creates only missing approved indexes and fails closed if duplicate data prevents a unique constraint.

The repository development compose now initializes a single-node replica set so transaction code can be exercised locally. It is not a production HA topology; production should use a managed replica set/sharded deployment with tested failover and PITR.
