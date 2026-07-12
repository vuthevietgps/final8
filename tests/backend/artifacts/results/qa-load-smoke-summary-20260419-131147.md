# QA LOAD-01 Smoke Summary

- Timestamp: `2026-04-19 13:11:47 +07`
- Scope:
  - `LOAD-01` smoke load on `health`, `auth/login`, `auth/profile`, `financial-control/dashboard`, `funds/overview`, `test-order2`
  - post-fix regression for auth, finance read models, order/finance ripple, and ops/payroll cashflow
- Environment:
  - load isolate backend: `http://localhost:3690/api`
  - load health: `http://localhost:3690/health`
  - load Mongo: `mongodb://127.0.0.1:27017/htxbachgia_load_smoke_20260419_125702`
  - auth/finance regression isolate backend: `http://localhost:3693/api`
  - auth/finance regression Mongo: `mongodb://127.0.0.1:27017/htxbachgia_regress_load_authfinance_20260419_130726`
  - order/finance regression isolate backend: `http://localhost:3694/api`
  - order/finance regression Mongo: `mongodb://127.0.0.1:27017/htxbachgia_regress_load_orderfinance_20260419_130726`
  - baseline users: `tests/backend/setup/ensure-regression-users.js`
  - runtime: built backend `dist/main.js`
  - load runner: `k6`
  - shell runner: Windows PowerShell

## Execution Audit Trail

- `tests/backend/perf/perf.load-smoke.k6.js`
  - `tests/backend/artifacts/results/tmp-load-smoke-backend-3687-20260419-123033.out.log`
    - status: `FAILED_HARNESS`
    - observation:
      - first isolate attempt did not preserve a clean runner capture, so the run was not trusted for scoring
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-123253.json`
    - status: `FAILED_PRODUCT`
    - result:
      - `http_req_failed=0.00%`
      - global `http_req_duration p95=12.29s`
      - `auth_login p95=12.27s`
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-124509.json`
    - status: `FAILED_PRODUCT`
    - result:
      - `http_req_failed=0.00%`
      - global `http_req_duration p95=9.27s`
      - `auth_login p95=9.45s`
      - finance cache/coalescing fix alone did not close the gap
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-125702.json`
    - status: `FAILED_HARNESS -> FAILED_PRODUCT -> FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result:
      - `1207` requests
      - `0.00% http_req_failed`
      - global `http_req_duration p95=427.28ms`, `p99=624.08ms`
      - endpoint p95:
        - `health=22.23ms`
        - `auth_login=553.76ms`
        - `auth_profile=97.06ms`
        - `financial_control_dashboard=165.34ms`
        - `funds_overview=74.36ms`
        - `test_order2_list=177.52ms`

- `tests/backend/suites/modules/core/module.auth-rbac.ps1`
  - `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-125944.log`
    - status: `BLOCKED_ENV`
    - observation:
      - batch reused `BACKEND_BASE_URL`, but the suite reads `AUTH_RBAC_BASE_URL`
      - suite fell back to the wrong target and hit `GET /health -> 404`, `POST /api/auth/login -> 403`
  - `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-130726.log`
    - status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
    - result: `25 PASS / 0 FAIL`

- `tests/backend/suites/modules/core/module.finance-control-funds.ps1`
  - `tests/backend/artifacts/results/module.finance-control-funds-rerun-20260419-130726.log`
    - status: `PASSED`
    - result: `40 PASS / 0 FAIL`

- `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
  - `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-130726.log`
    - status: `PASSED`
    - result: `57 PASS / 0 FAIL`

- `tests/backend/suites/e2e-flows/e2e.ops-payroll.ps1`
  - `tests/backend/artifacts/results/e2e.ops-payroll-rerun-20260419-125944.log`
    - status: `PASSED`
    - result: `24 PASS / 0 FAIL`

## Bugs And Fixes

- `LOAD-AUTH-01`
  - reproduce:
    1. Run `LOAD-01` at 20 RPS with `POST /api/auth/login` kept at 4 RPS against a built isolate backend.
    2. Observe `http_req_failed=0.00%` but global latency blows past threshold.
    3. Check endpoint breakdown and see `auth_login p95` near `9s-12s`.
  - root cause:
    - `backend/src/auth/auth.service.ts` used `bcryptjs`, so password verification stayed on the main Node.js thread and blocked unrelated requests under login-heavy load.
  - fix:
    - `backend/src/auth/auth.service.ts`
    - `backend/package.json`
    - `backend/package-lock.json`
    - runtime password verification moved to native `bcrypt`
  - ripple assessed:
    - login latency
    - `/health` tail latency under concurrent auth pressure
    - `/api/auth/profile`
    - JWT-protected read endpoints

- `LOAD-FUNDS-01`
  - reproduce:
    1. Run the same `LOAD-01` profile before and after only a cache/coalescing patch on finance reads.
    2. Observe global latency still above threshold while concurrent dashboard/funds reads recompute overlapping aggregates.
    3. Confirm repeated mutation paths can leave read models stale unless all finance caches invalidate together.
  - root cause:
    - `funds/overview`, `financial-control/dashboard`, and master bank balance shared expensive recomputation paths without full in-flight coalescing and cross-cache invalidation on write events.
  - fix:
    - `backend/src/finance/funds.service.ts`
    - `backend/src/finance/finance.service.ts`
    - `backend/src/finance/events/finance-events.constants.ts`
    - `backend/src/finance/events/finance-events.interfaces.ts`
    - `backend/src/finance/events/finance-event-listener.service.ts`
    - `backend/src/finance/funds.controller.ts`
    - `backend/src/finance/financial-control.controller.ts`
  - ripple assessed:
    - `financial-control/dashboard`
    - `funds/overview`
    - loan/funding/cashflow mutation invalidation
    - order-finance ripple
    - ops/payroll cashflow visibility

## Docs Updated

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Remaining Risks

- Open gap group after this round: `LOAD-02+`
- `LOAD-02` to `LOAD-06` still need dedicated harnesses for spike, write contention, analytics read, soak, and recovery/dependency degradation.
- Isolated perf and regression runs still require explicit `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `AUTH_RBAC_BASE_URL`, and `MONGODB_URI` when local defaults drift from QA targets.
