# Backend QA Summary - Order Sheet Sync & Ops Activation - 2026-04-19 02:37:52 +07

## Scope

- Activate `tests/backend/suites/modules/extended/module.order-sheet-sync-ops.ps1`
- Reproduce and fix `order-sheet-sync` sync-all counter bug
- Rerun related finance/emergency/alerts suites on isolated backend
- Close the remaining clean-DB harness failures before rerunning the canonical `22`-module regression

## Environment

- Isolated backend: `http://localhost:3620/api`
- MongoDB override: `mongodb://127.0.0.1:27017/htxbachgia_order_sheet_ops_20260419_0225`
- Baseline users: `tests/backend/setup/ensure-regression-users.ps1`
- Shell runner: Windows PowerShell
- Environment note:
  - `backend/.env` still points to `127.0.0.1:27019`
  - all real reruns in this round used explicit `MONGODB_URI`

## Progression History

- `manual-order-sheet-sync-repro-20260419-0214.log`
  - status: `FAILED`
  - reproduce: invalid-link single sync returned `success=false`, but both `agents/all` and `suppliers/all` still reported `success=1 failed=0 errors=[]`
- `module.order-sheet-sync-ops-rerun-20260419-0218.log`
  - status: `FAILED`
  - result: `38 PASS / 8 FAIL`
- `module.order-sheet-sync-ops-rerun-20260419-0228.log`
  - status: `FAILED -> FIXED_HARNESS -> FIXED_PRODUCT -> PASSED`
  - result: `56 PASS / 0 FAIL`
- `module.finance-control-funds-rerun-20260419-0230.log`
  - status: `PASSED`
  - result: `40 PASS / 0 FAIL`
- `module.ads-budget-x-emergency-rerun-20260419-0230.log`
  - status: `PASSED`
  - result: `35 PASS / 0 FAIL`
- `module.ads-alerts-kpi-rerun-20260419-0230.log`
  - status: `FAILED_HARNESS`
  - result: `26 PASS / 1 FAIL`
- `module.ads-alerts-kpi-rerun-20260419-0234.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - result: `27 PASS / 0 FAIL`
- `module.owner-fund-loan-rerun-20260419-0236.log`
  - status: `FAILED_HARNESS`
  - result: `43 PASS / 1 FAIL`
- `module.owner-fund-loan-rerun-20260419-0246.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - result: `44 PASS / 0 FAIL`
- `module-regression-20260419-023017.json`
  - status: `FAILED`
  - result: `933 PASS / 1 FAIL` across `22` modules
- `module-regression-20260419-023752.json`
  - status: `PASSED`
  - result: `934 PASS / 0 FAIL` across `22` modules

## Failed -> Fixed -> Passed

### `order-sheet-sync` sync-all counters

- Reproduce before fix:
  - `POST /api/order-sheet-sync/agents/all` reported success even when inner agent sync returned `success=false`
  - `POST /api/order-sheet-sync/suppliers/all` showed the same behavior on invalid Google Drive link input
- Root cause:
  - `backend/src/order-sheet-sync/order-sheet-sync.service.ts`
  - `syncAllAgents()` and `syncAllSuppliers()` incremented success counts unless an exception was thrown, ignoring returned `success=false`
- Fix:
  - `syncAllAgents()` and `syncAllSuppliers()` now convert returned `success=false` results into failure counters and traceable error payloads
- Rerun status:
  - `FAILED -> FIXED_PRODUCT -> PASSED`
  - `module.order-sheet-sync-ops.ps1` closed at `56 PASS / 0 FAIL`

### `module.ads-alerts-kpi.ps1` clean-DB snapshot list

- Root cause:
  - `GET /api/capital-allocation/snapshots?limit=5` returned a valid empty array on clean DB, but the suite treated that contract-valid response as a failure
- Fix:
  - `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`
  - valid empty snapshot lists are now accepted without masking non-`200` responses
- Rerun status:
  - `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`

### `module.owner-fund-loan.ps1` clean-DB available-funds history

- Root cause:
  - `GET /api/finance/available-funds` returned `[]` on clean DB because no snapshot had been captured yet
  - the suite used a response path that collapsed valid empty arrays into a failure, then hit PowerShell JSON-parser compatibility drift
- Fix:
  - `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
  - step `5.7` now verifies the response contract with `Invoke-WebRequest`, accepts valid empty snapshot history, and uses PowerShell-compatible JSON parsing
- Rerun status:
  - `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`

## Current Regression Snapshot

- Targeted suite:
  - `module.order-sheet-sync-ops.ps1`: `56 PASS / 0 FAIL`
- Related reruns:
  - `module.finance-control-funds.ps1`: `40 PASS / 0 FAIL`
  - `module.ads-budget-x-emergency.ps1`: `35 PASS / 0 FAIL`
  - `module.ads-alerts-kpi.ps1`: `27 PASS / 0 FAIL`
  - `module.owner-fund-loan.ps1`: `44 PASS / 0 FAIL`
- Canonical full module regression:
  - `22 / 22` modules passed
  - `934 PASS / 0 FAIL`

## Files Changed In This Round

- `backend/src/order-sheet-sync/order-sheet-sync.service.ts`
- `tests/backend/suites/modules/extended/module.order-sheet-sync-ops.ps1`
- `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`
- `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
- `tests/backend/runners/run-backend-module-regression.ps1`

## Logs And Artifacts

- `tests/backend/artifacts/results/manual-order-sheet-sync-repro-20260419-0214.log`
- `tests/backend/artifacts/results/module.order-sheet-sync-ops-rerun-20260419-0218.log`
- `tests/backend/artifacts/results/module.order-sheet-sync-ops-rerun-20260419-0228.log`
- `tests/backend/artifacts/results/module.finance-control-funds-rerun-20260419-0230.log`
- `tests/backend/artifacts/results/module.ads-budget-x-emergency-rerun-20260419-0230.log`
- `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0230.log`
- `tests/backend/artifacts/results/module.ads-alerts-kpi-rerun-20260419-0234.log`
- `tests/backend/artifacts/results/module.owner-fund-loan-rerun-20260419-0236.log`
- `tests/backend/artifacts/results/module.owner-fund-loan-rerun-20260419-0246.log`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0232.log`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-0247.log`
- `tests/backend/artifacts/results/module-regression-20260419-023017.json`
- `tests/backend/artifacts/results/module-regression-20260419-023752.json`
- `tests/backend/artifacts/results/module-regression-latest.json`

## Files Updated For Traceability

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so `BLOCKED_ENV` remains possible without explicit `MONGODB_URI`.
- Planned gaps outside this round remain for public/bootstrap contracts, concurrency-focused finance ripple suites, DB consistency coverage, and load/perf harnesses.

## Next Test Step

1. Standardize local QA Mongo configuration so canonical setup stops depending on `MONGODB_URI` override.
2. Continue with the next P1 planned gap after `order-sheet-sync`, starting with `e2e.public-contracts-resilience.ps1` or the concurrency-focused finance ripple suite.
