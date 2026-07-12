# QA Summary - LOAD-04 Analytics Read Closure

- Summary generated: `2026-04-19 17:13:18 +07`
- Scope: `LOAD-04` read-heavy analytics load on `financial-control/dashboard`, `cashflow/dashboard/summary`, `ad-group-profit-report/performance`, and `return-report/*`, plus isolate fixture bring-up

## Executions

- `create-analytics-read-fixture.js` / isolate bring-up
  - `perf.analytics-read-seed-setup-20260419-170009.log`: `FAILED_HARNESS/BLOCKED_ENV`
    - first isolate answered `/health`, but auth still targeted the wrong Mongo DB so `director@test.com` login returned `401`
  - `perf.analytics-read-seed-setup-20260419-170436.log`: `FAILED_HARNESS`
    - the fixture first used an invalid `other-cost.category`, then hard-coded unique IDs collided on rerun, and the dirty DB doubled report row counts
  - `perf.analytics-read-seed-setup-20260419-170817.log`: `FAILED_HARNESS`
    - the self-check counted returns through regex drift and expected `0` while the reports correctly returned `48`
  - `perf.analytics-read-seed-setup-20260419-170954.log`: `FAILED_HARNESS/BLOCKED_ENV -> FIXED_ENV -> FIXED_HARNESS -> FIXED_HARNESS -> FIXED_HARNESS -> PASSED`
    - isolate backend: `http://localhost:50108`
    - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_load04_20260419-170954`
    - seed result: `24` ad groups, `192` orders, `48` returns, `24` advertising-cost rows, `12` other-cost rows
- `perf.analytics-read.k6.js`
  - `perf.analytics-read-summary-20260419-171115.json`: `PASSED`
    - Docker base URL: `http://host.docker.internal:50108`
    - result: `3808` HTTP requests, `0.00% http_req_failed`, global `p95=61.49ms`
    - endpoint p95:
      - `financial_control_dashboard=22.82ms`
      - `financial_control_dashboard_refresh=71.13ms`
      - `cashflow_dashboard_summary=13.04ms`
      - `ad_group_profit_report_performance=73.14ms`
      - `return_report_product=41.05ms`
      - `return_report_ad_group=41.28ms`

## Bugs

- No product bug was reproduced in this round.

- `LOAD04-HARNESS-ENV-01`
  - Symptom: the first isolate responded on `/health`, but auth still queried a different Mongo target and rejected seeded regression users
  - Root cause: isolate boot metadata was not being captured explicitly enough to prove `MONGODB_URI` propagation before the first seed run
  - Fix:
    - [create-analytics-read-fixture.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/create-analytics-read-fixture.js)
  - Harness status: `FAILED_HARNESS/BLOCKED_ENV -> FIXED_ENV -> PASSED`

- `LOAD04-HARNESS-FIXTURE-02`
  - Symptom: fixture seeding first violated the `other-cost.category` enum, then collided on hard-coded `pageId` / `accountId` / `adGroupId`, and finally polluted report counts on rerun
  - Root cause: the seed namespace was not per-run and the fixture payload did not stay aligned with the real `other-cost` contract
  - Fix:
    - [create-analytics-read-fixture.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/create-analytics-read-fixture.js)
  - Harness status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`

- `LOAD04-HARNESS-SELFCHECK-03`
  - Symptom: the fixture self-check expected `0` returns while the reports correctly produced `48`
  - Root cause: the assertion used a regex drift on localized status names instead of the canonical `statuses.returned` value already fetched from the API
  - Fix:
    - [create-analytics-read-fixture.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/create-analytics-read-fixture.js)
  - Harness status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`

## Files Updated This Round

- [create-analytics-read-fixture.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/create-analytics-read-fixture.js)
- [perf.analytics-read.k6.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/perf.analytics-read.k6.js)
- [backend-test-plan.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-plan.md)
- [backend-test-scenario-matrix.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-scenario-matrix.md)
- [backend-test-suite-backlog.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-suite-backlog.md)
- [suite-index.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/suites/suite-index.md)
- [README.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/README.md)

## Open Risks

- `LOAD-05` and `LOAD-06` remain open.
- This round did not rerun product regressions because no backend product code changed; the closure fixed harness/env issues only.
- Native `k6` is still not on `PATH`; Docker `grafana/k6` remains the verified local runner and isolate rounds still need explicit `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, and `MONGODB_URI`.

## Next Step

- Activate `LOAD-05` soak coverage for mixed analytics read/write traffic with the same isolate-env discipline used in `LOAD-04`.
