# Backend QA Regression Summary - 2026-04-19 00:54:12 +07

## Scope

- Full backend module regression via `tests/backend/runners/run-backend-module-regression.ps1`
- Targeted reruns for the 5 suites that failed in the same-day baseline:
  - `module.owner-fund-loan.ps1`
  - `module.reports-products-config.ps1`
  - `module.supply-chain.ps1`
  - `module.agent-supplier-quotes.ps1`
  - `module.finance-survival-alerts.ps1`

## Environment

- Targeted rerun backend: `http://localhost:3300/api`
- Full rerun backend: `http://localhost:3400/api`
- Baseline users: ensured by `tests/backend/setup/ensure-regression-users.ps1`
- MongoDB: `mongodb://127.0.0.1:27017/htxbachgia`
- Mongo topology: single-node replica set `rs0`
- Shell runner: Windows PowerShell
- Environment note:
  - local live Mongo service for this round listened on `127.0.0.1:27017`
  - `backend/.env` still points to `127.0.0.1:27019`, so this round exported `MONGODB_URI` explicitly

## Progression History

- Failed full regression `20260419-002155`: `766 PASS / 17 FAIL` across `19` modules
- Targeted fail-suite rerun `20260419-003503`: `5/5` previously failing suites passed
- Current full regression `20260419-005412`: `825 PASS / 0 FAIL` across `19` modules

## Failed -> Fixed -> Passed

### `module.owner-fund-loan.ps1`

- Baseline status: `42 PASS / 1 FAIL`
- Root cause:
  - upcoming repayment coverage used a stale fixed `dueDate` window that had already moved into the past
- Fix:
  - changed the suite to create runtime-relative due dates
  - separated paid repayment data from upcoming repayment data and asserted the created upcoming repayment is present in the result set
- Rerun status:
  - `FAILED -> FIXED -> PASSED`
  - targeted rerun: `44 PASS / 0 FAIL`
- Ripple check:
  - full regression `20260419-005412` stayed green for owner fund, finance-control, salary/payroll, and ads-budget cashflow modules

### `module.reports-products-config.ps1`

- Baseline status: `37 PASS / 1 FAIL`
- Root cause:
  - pending-order approval flow assumed an ambient product still existed, so the suite occasionally approved against missing or already-cleaned data
- Fix:
  - created or reused a fallback category and product for the pending-order path
  - cleaned up fallback test data at the end of the suite
- Rerun status:
  - `FAILED -> FIXED -> PASSED`
  - targeted rerun: `38 PASS / 0 FAIL`
- Ripple check:
  - full regression `20260419-005412` stayed green for reports, products/config, return-rate, and order-finance paths

### `module.supply-chain.ps1`

- Baseline status: `1 PASS / 1 FAIL`
- Root cause:
  - setup used fixed emails but only searched by role, so duplicate-user `409` responses broke bootstrap idempotency
- Fix:
  - reused users via `GET /users/email/:email`
  - recovered cleanly after duplicate-user creation attempts instead of aborting the suite
- Rerun status:
  - `FAILED -> FIXED -> PASSED`
  - targeted rerun: `28 PASS / 0 FAIL`
- Ripple check:
  - full regression `20260419-005412` stayed green for supply-chain, supplier quote, and finance-linked product catalog flows

### `module.agent-supplier-quotes.ps1`

- Baseline status: `5 PASS / 13 FAIL`
- Root cause:
  - static category and product setup collided with existing data
  - duplicate category creation leaked a server-side `500` instead of returning a contract-safe conflict response
- Fix:
  - reused existing category and product fixtures by prefix, creating timestamped records only when missing
  - hardened `backend/src/product-category/product-category.service.ts` to translate Mongo duplicate key `11000` into `ConflictException`
- Rerun status:
  - `FAILED -> FIXED -> PASSED`
  - targeted rerun: `18 PASS / 0 FAIL`
- Ripple check:
  - full regression `20260419-005412` stayed green for supplier quotes, supply chain, payable/receivable-linked catalog paths, and reports consuming category/product data

### `module.finance-survival-alerts.ps1`

- Baseline status: `2 PASS / 1 FAIL`
- Root cause:
  - `backend/scripts/test-scenario-4-finance-health.js` depended on ambient ad-group data instead of self-contained scenario fixtures
- Fix:
  - self-seeded scenario-specific users, ad account, fanpage, and ad group
  - stored created ids in state and cleaned them up in teardown
- Rerun status:
  - `FAILED -> FIXED -> PASSED`
  - targeted rerun: `18 PASS / 0 FAIL`
- Ripple check:
  - full regression `20260419-005412` stayed green for finance survival alerts, ads alerts/KPI, net-profit, and ads-budget emergency flows

## Files Verified In This Round

- `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
- `tests/backend/suites/modules/core/module.reports-products-config.ps1`
- `tests/backend/suites/modules/core/module.supply-chain.ps1`
- `tests/backend/suites/modules/core/module.agent-supplier-quotes.ps1`
- `backend/src/product-category/product-category.service.ts`
- `backend/scripts/test-scenario-4-finance-health.js`

## Logs And Artifacts

- `tests/backend/artifacts/results/full-module-regression-20260419-002107.log`
- `tests/backend/artifacts/results/module-regression-20260419-002155.json`
- `tests/backend/artifacts/results/targeted-fail-suite-rerun-20260419-003503.log`
- `tests/backend/artifacts/results/backend-3300-20260419-003503.log`
- `tests/backend/artifacts/results/backend-3300-20260419-003503.err.log`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-005330.log`
- `tests/backend/artifacts/results/backend-3400-20260419-005330.log`
- `tests/backend/artifacts/results/backend-3400-20260419-005330.err.log`
- `tests/backend/artifacts/results/module-regression-20260419-005412.json`
- `tests/backend/artifacts/results/module-regression-latest.json`

## Files Updated For Traceability

- `tests/backend/artifacts/results/qa-module-regression-summary-20260419-005412.md`
- `tests/backend/artifacts/results/qa-module-regression-summary-20260419-005412.json`
- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- Current active 19-module regression baseline is green, but local workstation config still drifts from `backend/.env` on Mongo port (`27017` live service vs `27019` in file).
- No new backlog item was opened in this round; existing planned gaps remain in the backlog for `module.user-import-export.ps1`, `module.api-token-timezone.ps1`, `module.order-sheet-sync-ops.ps1`, and concurrency-focused ripple suites.

## Next Test Step

1. Keep `MONGODB_URI` override explicit until local QA environment is standardized.
2. Continue with the next P1 backlog item that still has no active verification round, starting with `module.user-import-export.ps1`.
