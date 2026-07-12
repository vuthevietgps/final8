# QA Summary - LOAD-03 Write Contention Closure

- Summary generated: `2026-04-19 14:39:57 +07`
- Scope: `LOAD-03` write-heavy contention on supplier payment batch, agent payment batch, owner withdrawal approve, return resolve, other-cost confirm; related finance/db/return regressions

## Executions

- `perf.write-contention.k6.js`
  - `perf.write-contention-summary-20260419-141816.json`: `FAILED_PRODUCT`
    - concurrent `owner-fund/withdrawals/:id/approve` returned `201, 201` on the same withdrawal
  - `perf.write-contention-summary-20260419-142358.json`: `FAILED_PRODUCT`
    - owner race was fixed, but mixed `return-request/resolve` contention still failed the latency gate
  - `perf.write-contention-summary-20260419-142859.json`: `FAILED_PRODUCT`
    - after success/reject metric separation, `return_resolve_commit_duration p95=3942ms` still exposed a real hot-path problem
  - `perf.write-contention-summary-20260419-143119.json`: `FAILED_PRODUCT`
    - resolve-path pruning improved latency, but `return_resolve_commit_duration p95=2525.60ms` still missed threshold
  - `perf.write-contention-summary-20260419-143236.json`: `FAILED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - isolate backend: `http://localhost:62639`
    - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_load03_20260419-143236`
    - result: `120` iterations, `293` HTTP requests, `0.00% http_req_failed`, global `p95=1480.01ms`
    - endpoint / commit p95:
      - `supplier_payment_batch=646.00ms`
      - `agent_payment_batch=669.44ms`
      - `owner_withdrawal_approve_commit_duration=1434.40ms`
      - `return_resolve_commit_duration=2009.75ms`
      - `other_cost_confirm=804.82ms`
- `e2e.concurrent-finance-ripple.ps1`
  - `e2e.concurrent-finance-ripple-rerun-20260419-143338.log`: `PASSED`, `40 PASS / 0 FAIL`
- `module.db-consistency.ps1`
  - `module.db-consistency-rerun-20260419-143409.log`: `PASSED`, `68 PASS / 0 FAIL`
- `e2e.return-ripple.ps1`
  - `e2e.return-ripple-rerun-20260419-143449.log`: `PASSED`, `64 PASS / 0 FAIL`

## Bugs

- `LOAD03-WITHDRAWAL-RACE-01`
  - Symptom: concurrent approve on one pending withdrawal could return two `201` winners and double-apply the balance path
  - Root cause: `approveWithdrawal()` still used a non-atomic read-check-update sequence
  - Fix:
    - [owner-fund.service.ts](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/backend/src/owner-fund/owner-fund.service.ts)
  - Product status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`

- `LOAD03-RETURN-RESOLVE-02`
  - Symptom: `return-request/resolve` kept breaching the `LOAD-03` success-path latency gate under write contention
  - Root cause: duplicate-resolve losers were rejected too late, and the resolve path still recomputed quote snapshots that should stay immutable
  - Fix:
    - [return-request.service.ts](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/backend/src/return-request/return-request.service.ts)
  - Product status: `FAILED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> PASSED`

## Files Updated This Round

- [owner-fund.service.ts](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/backend/src/owner-fund/owner-fund.service.ts)
- [return-request.service.ts](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/backend/src/return-request/return-request.service.ts)
- [create-write-contention-fixture.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/create-write-contention-fixture.js)
- [perf.write-contention.k6.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/perf.write-contention.k6.js)
- [backend-test-plan.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-plan.md)
- [backend-test-scenario-matrix.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-scenario-matrix.md)
- [backend-test-suite-backlog.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-suite-backlog.md)
- [suite-index.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/suites/suite-index.md)
- [README.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/README.md)

## Open Risks

- `LOAD-04` to `LOAD-06` remain open.
- This round did not rerun the full canonical module regression; only contention-adjacent regressions were rerun.
- Native `k6` is still not on `PATH`; Docker `grafana/k6` is verified and non-blocking, but isolate runs still need explicit `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, and `MONGODB_URI`.

## Next Step

- Activate `LOAD-04` with a read-heavy analytics harness around `financial-control/dashboard`, `cashflow/dashboard/summary`, `ad-group-profit-report/performance`, and `return-report/*`, while keeping the same isolate-env discipline as `LOAD-03`.
