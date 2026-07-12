# Backend QA Regression Summary - 2026-04-19 02:37:52 +07

## Scope

- Close the `22`-module canonical regression after activating `module.order-sheet-sync-ops.ps1`
- Fix the remaining clean-DB harness failure in `module.owner-fund-loan.ps1`
- Preserve traceable history for the new active `order-sheet-sync` suite and related reruns

## Environment

- Base backend: `http://localhost:3620/api`
- MongoDB override: `mongodb://127.0.0.1:27017/htxbachgia_order_sheet_ops_20260419_0225`
- Shell runner: Windows PowerShell
- Environment note:
  - `backend/.env` still points to `127.0.0.1:27019`
  - this round used explicit `MONGODB_URI`

## Regression Progression

- `module-regression-20260419-023017.json`
  - status: `FAILED`
  - result: `933 PASS / 1 FAIL` across `22` modules
  - only open failure: `module.owner-fund-loan.ps1` step `5.7 Available funds`
- `module.owner-fund-loan-rerun-20260419-0236.log`
  - status: `FAILED_HARNESS`
  - result: `43 PASS / 1 FAIL`
- `module.owner-fund-loan-rerun-20260419-0246.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - result: `44 PASS / 0 FAIL`
- `module-regression-20260419-023752.json`
  - status: `PASSED`
  - result: `934 PASS / 0 FAIL` across `22` modules

## Round Highlights

- `module.order-sheet-sync-ops.ps1` is now active in the canonical runner and covers `BE-OPS-04`, `BE-OPS-05`, `BE-OPS-06`.
- `backend/src/order-sheet-sync/order-sheet-sync.service.ts` now counts inner `success=false` sync results as failures instead of success.
- `module.ads-alerts-kpi.ps1` and `module.owner-fund-loan.ps1` no longer false-fail on valid empty history arrays on clean DB.

## Final Regression Snapshot

- `22 / 22` modules passed
- `934 PASS / 0 FAIL`
- Canonical runner: `tests/backend/runners/run-backend-module-regression.ps1`

## Files Changed In This Round

- `backend/src/order-sheet-sync/order-sheet-sync.service.ts`
- `tests/backend/suites/modules/extended/module.order-sheet-sync-ops.ps1`
- `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`
- `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
- `tests/backend/runners/run-backend-module-regression.ps1`

## Logs And Artifacts

- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0232.log`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0247.log`
- `tests/backend/artifacts/results/module-regression-20260419-023017.json`
- `tests/backend/artifacts/results/module-regression-20260419-023752.json`
- `tests/backend/artifacts/results/module-regression-latest.json`
- `tests/backend/artifacts/results/qa-order-sheet-sync-ops-summary-20260419-023752.md`
- `tests/backend/artifacts/results/qa-order-sheet-sync-ops-summary-20260419-023752.json`
- `tests/backend/artifacts/results/qa-module-regression-summary-20260419-023752.md`
- `tests/backend/artifacts/results/qa-module-regression-summary-20260419-023752.json`

## Files Updated For Traceability

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so suites remain vulnerable to `BLOCKED_ENV` without explicit `MONGODB_URI`.
- Planned gaps outside this round remain for public/bootstrap contracts, concurrency-focused ripple suites, DB consistency suites, and load/perf harnesses.

## Next Test Step

1. Standardize the local QA Mongo configuration.
2. Continue with the next P1 planned gap after `order-sheet-sync`, starting with `e2e.public-contracts-resilience.ps1` or the concurrency-focused finance ripple suite.
