# QA Purchase Inventory Activation Summary - 2026-04-24 16:48:58 +07

## Scope

- Backend build refresh on `backend`
- `tests/backend/suites/modules/extended/module.purchase-inventory.ps1` activation on isolated backend `http://localhost:3686/api`
- `tests/backend/suites/modules/core/module.supply-chain.ps1` ripple rerun on isolated backend `http://localhost:3691/api`
- Canonical module-runner catalog sync for active module suites

## Environment

- Shell runner: Windows PowerShell
- Backend build: `cd backend && npm run build`
- Purchase-inventory pass log:
  - backend base URL: `http://localhost:3686/api`
  - Mongo URI: `mongodb://127.0.0.1:27017/htxbachgia_purchase_inventory_20260424164801`
  - suite log: `tests/backend/artifacts/results/module.purchase-inventory-rerun-20260424-1649.log`
- Supply-chain ripple pass log:
  - backend base URL: `http://localhost:3691/api`
  - Mongo URI: `mongodb://127.0.0.1:27017/htxbachgia_supply_chain_202604241649`
  - suite log: `tests/backend/artifacts/results/module.supply-chain-rerun-20260424-1649.log`
- Known env drift still present:
  - `backend/.env` -> `mongodb://127.0.0.1:27019/htxbachgia`
  - direct `module.supply-chain.ps1` run without `BACKEND_BASE_URL` override is still `BLOCKED_ENV`

## Audit Trail

- Purchase inventory activation:
  - first activation run status: `FAILED_PRODUCT + FAILED_HARNESS`
  - first result: `50 PASS / 14 FAIL`
  - failure signals:
    - `GET /api/purchase-orders/price-history` returned `500`
    - singleton transaction and price-history collections were parsed as scalars by the PowerShell helper
  - failure artifacts:
    - `tests/backend/artifacts/results/tmp-purchase-inventory-3686-20260424-164034.out.log`
    - `tests/backend/artifacts/results/tmp-purchase-inventory-3686-20260424-164034.err.log`
  - fixes applied:
    - `backend/src/purchase/purchase-order.controller.ts`
    - `tests/backend/suites/modules/extended/module.purchase-inventory.ps1`
  - rerun status: `FAILED_PRODUCT + FAILED_HARNESS -> FIXED_PRODUCT -> FIXED_HARNESS -> PASSED`
  - rerun result: `84 PASS / 0 FAIL`
- Supply-chain ripple rerun:
  - first direct rerun status: `BLOCKED_ENV`
  - root issue: suite defaulted to `http://localhost:3000/api` and no backend was listening there
  - isolated rerun status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
  - rerun result: `28 PASS / 0 FAIL`

## Root Causes

- Product bug:
  - `GET /purchase-orders/price-history` was declared after `@Get(':id')`, so Nest resolved `price-history` through `findOne()` and Mongoose threw `CastError` on `"price-history"` as an ObjectId.
- Harness bug:
  - `Get-CollectionItems` emitted singleton collections as scalars, so assertions using `.Count` and `[0]` broke on one-row transaction and history responses.
- Environment drift:
  - `module.supply-chain.ps1` still depends on `BACKEND_BASE_URL` when no backend is running on the default `localhost:3000/api`.

## Fixes Verified

- `backend/src/purchase/purchase-order.controller.ts`
  - moved `price-history` above `:id` so the public contract resolves to the correct handler
- `tests/backend/suites/modules/extended/module.purchase-inventory.ps1`
  - `Get-CollectionItems` now preserves singleton arrays instead of unwrapping them into scalar objects
- `tests/backend/runners/run-backend-module-regression.ps1`
  - canonical module list is synchronized to the active tree by adding `module.db-seed-cleanup.ps1` and `module.purchase-inventory.ps1`

## Remaining Risks

- Canonical full backend module regression was not rerun after the active module catalog changed from `23` to `25`; the latest full green remains `2026-04-19`
- `backend/.env` still points to `127.0.0.1:27019`, so cold local QA remains `BLOCKED_ENV` without explicit override
- Purchase endpoints still do not have explicit malformed-ObjectId guards on `:id` paths; this round fixed the route shadow regression but did not harden invalid-id semantics
