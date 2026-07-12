# Backend QA Summary - Concurrent Finance Ripple Activation - 2026-04-19 04:18:12 +07

## Scope

- Activate `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`
- Reproduce and fix duplicate supplier/agent payment retry bugs in `order-payment.service.ts`
- Re-baseline stale external-agent commission expectations in `e2e.agent-role-payment.ps1` and `e2e.order-finance-impact.ps1`
- Rerun `module.ads-alerts-kpi.ps1` and canonical module regression after the finance-ripple closure

## Environment

- Concurrency suite isolated backend: `http://localhost:3660/api`
- Finance/order rerun backends: `http://localhost:3671/api`, `http://localhost:3673/api`
- Module/KPI rerun backend: `http://localhost:3676/api`
- Mongo runtime for all reruns in this round: explicit `MONGODB_URI` on `127.0.0.1:27017`
- Runtime note:
  - `backend/.env` still points to `127.0.0.1:27019`
  - canonical module runner needed `BACKEND_BASE_URL` and `BACKEND_HEALTH_URL` when the isolated backend was not on `3000`

## Progression History

- `e2e.concurrent-finance-ripple-run-20260419-035102.log`
  - status: `FAILED`
  - result: `34 PASS / 6 FAIL`
  - failures:
    - duplicate supplier payment batch accepted with `200`
    - duplicate agent payment batch accepted with `200`
    - paid batch ids and `paidAt` timestamps were overwritten on retry
- `e2e.concurrent-finance-ripple-run-20260419-041109.log`
  - status: `FAILED -> FIXED_PRODUCT -> PASSED`
  - result: `40 PASS / 0 FAIL`
- `e2e.agent-role-payment-rerun-20260419-0431.log`
  - status: `FAILED`
  - result: `44 PASS / 2 FAIL`
  - root issue: gross-profit expectations still used the old external-agent commission formula
- `e2e.agent-role-payment-rerun-20260419-0442.log`
  - status: `FAILED -> FIXED_EXPECTATION -> PASSED`
  - result: `46 PASS / 0 FAIL`
- `e2e.order-finance-impact-rerun-20260419-0420.log`
  - status: `FAILED`
  - result: `53 PASS / 3 FAIL`
  - root issues:
    - delivered and returned `agentPaidAmount` still subtracted shipping/return from external-agent commission
    - returned-order `grossProfit` assertion used a stale negative-only expectation
- `e2e.order-finance-impact-rerun-20260419-0431.log`
  - status: `FAILED -> FIXED_EXPECTATION -> PASSED`
  - result: `56 PASS / 0 FAIL`
- `module-regression-20260419-041141.json`
  - status: `FAILED_HARNESS_ENV`
  - result: `0 PASS / 29 FAIL`
  - root issue: module runner fell back to `http://localhost:3000` before isolated-backend env overrides were exported
- `module.ads-alerts-kpi-rerun-20260419-0520.log`
  - status: `FAILED_HARNESS`
  - result: `26 PASS / 1 FAIL`
  - root issue: empty `capital-allocation/snapshots` response collapsed from `@()` to `$null` on clean DB
- `module.ads-alerts-kpi-rerun-20260419-0530.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - result: `27 PASS / 0 FAIL`
- `module-regression-20260419-041812.json`
  - status: `FAILED_HARNESS_ENV -> FIXED_ENV -> PASSED`
  - result: `934 PASS / 0 FAIL`, `22 / 22` modules

## Failed -> Fixed -> Passed

### Duplicate supplier/agent payment retries

- Reproduce before fix:
  - retrying supplier payment on the same order still returned `200`
  - retrying agent payment on the same order still returned `200`
  - second retry overwrote the first batch id and `paidAt` timestamp
- Root cause:
  - `backend/src/test-order2/services/order-payment.service.ts`
  - payment-batch creation paths did not filter already-paid orders atomically and did not reject duplicate `batchId`
- Fix:
  - added duplicate batch-id guards
  - restricted eligible-order queries to unpaid orders with empty batch metadata
  - switched to atomic `updateMany(...)` before recalculating realized profit
- Rerun status:
  - `FAILED -> FIXED_PRODUCT -> PASSED`
  - `e2e.concurrent-finance-ripple.ps1` closed at `40 PASS / 0 FAIL`

### External-agent commission suite drift

- Reproduce before fix:
  - `e2e.agent-role-payment.ps1` and `e2e.order-finance-impact.ps1` still expected external-agent commission to subtract `shippingFee` and `returnFee`
  - runtime source of truth already used `COD - (agentQuote * qty)` and left shipping/return on company-side cost lines
- Source of truth used for re-baseline:
  - `backend/src/test-order2/services/order-payment.service.ts`
  - `backend/src/test-order2/services/order-calculation.service.ts`
  - `backend/src/test-order2/test-order2.service.ts`
- Fix:
  - `tests/backend/suites/e2e-flows/e2e.agent-role-payment.ps1`
  - `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
  - updated external-agent payout expectations and tightened returned-order `grossProfit` formula checks
- Rerun status:
  - `FAILED -> FIXED_EXPECTATION -> PASSED`
  - `e2e.agent-role-payment.ps1`: `46 PASS / 0 FAIL`
  - `e2e.order-finance-impact.ps1`: `56 PASS / 0 FAIL`

### Clean-DB `ads-alerts-kpi` snapshot listing

- Reproduce before fix:
  - `GET /capital-allocation/snapshots?limit=5` returned `[]`
  - suite still marked `List snapshots failed`
- Root cause:
  - `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`
  - PowerShell `if { @() }` branch emitted no pipeline output, so `$snapList` became `$null`
- Fix:
  - wrapped the snapshot-normalization expression in `@(...)`
- Rerun status:
  - `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - `module.ads-alerts-kpi.ps1` closed at `27 PASS / 0 FAIL`

### Canonical module regression environment closure

- Failed audit kept:
  - `module-regression-20260419-041141.json`
  - runner targeted `http://localhost:3000` without the isolated-backend override, so all suites failed on wrong-target `403/404`
- Environment correction:
  - exported `BACKEND_BASE_URL='http://localhost:3676/api'`
  - exported `BACKEND_HEALTH_URL='http://localhost:3676/health'`
- Final rerun status:
  - `FAILED_HARNESS_ENV -> FIXED_ENV -> PASSED`
  - canonical module regression closed at `934 PASS / 0 FAIL`

## Related Regression

- `module.ads-alerts-kpi.ps1`
  - log: `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0530.log`
  - result: `27 PASS / 0 FAIL`
- Canonical full module regression:
  - `22 / 22` modules passed
  - `934 PASS / 0 FAIL`
  - artifacts:
    - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0530.log`
    - `tests/backend/artifacts/results/module-regression-20260419-041812.json`
    - `tests/backend/artifacts/results/module-regression-latest.json`

## Files Changed In This Round

- `backend/src/test-order2/services/order-payment.service.ts`
- `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`
- `tests/backend/suites/e2e-flows/e2e.agent-role-payment.ps1`
- `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
- `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`

## Logs And Artifacts

- `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260419-035102.log`
- `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260419-041109.log`
- `tests/backend/artifacts/results/e2e.agent-role-payment-rerun-20260419-0431.log`
- `tests/backend/artifacts/results/e2e.agent-role-payment-rerun-20260419-0442.log`
- `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-0420.log`
- `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-0431.log`
- `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0520.log`
- `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0530.log`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0530.log`
- `tests/backend/artifacts/results/module-regression-20260419-041141.json`
- `tests/backend/artifacts/results/module-regression-20260419-041812.json`
- `tests/backend/artifacts/results/module-regression-latest.json`

## Files Updated For Traceability

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- `backend/.env` still drifts from live QA Mongo (`27019` in file vs `27017` live), so `BLOCKED_ENV` remains possible without explicit `MONGODB_URI`.
- `CON-08`, `CON-09`, `DB-*`, and `LOAD-*` are still open.

## Next Test Step

1. Standardize local QA Mongo configuration so isolated runs stop depending on manual `MONGODB_URI` override.
2. Continue with `module.db-consistency.ps1`, then `e2e.return-ripple.ps1` / `e2e.order-update-ripple.ps1`.
