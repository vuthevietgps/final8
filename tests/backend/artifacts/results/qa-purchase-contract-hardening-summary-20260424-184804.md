# QA Purchase Contract Hardening Summary

- Summary timestamp: `2026-04-24 18:48:04 +07`
- Scope:
  - harden malformed/missing `purchase-orders/:id` contract
  - extend `module.purchase-inventory.ps1` for malformed/missing id and supplier-filter coverage
  - rerun purchase ripple and canonical backend gate
  - investigate and close same-round `DB Seed Cleanup` external media-root mismatch

## Environment

- Backend build:
  - `cd backend && npm run build` -> `PASSED`
- Purchase targeted suite:
  - base URL: `http://localhost:3686/api`
  - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_purchase_inventory_20260424182922`
- Supply-chain targeted suite:
  - base URL: `http://localhost:3702/api`
  - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_supply_chain_objectid_20260424183818`
- First canonical rerun:
  - base URL: `http://localhost:3703/api`
  - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_module_regression_objectid_20260424183923`
  - note: backend media root was not coupled to DB-06 helper media root
- DB-06 targeted rerun:
  - base URL: `http://localhost:3704/api`
  - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_db06_external_objectid_202604241845`
  - shared media root: `tests/backend/artifacts/results/tmp-db06-external-media-20260424-1845`
- Final canonical rerun:
  - base URL: `http://localhost:3705/api`
  - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_module_regression_mediafix_202604241848`
  - shared media root: `tests/backend/artifacts/results/tmp-module-regression-media-20260424-1848`

## Execution Trail

- `2026-04-24 18:29:22 +07`
  - suite: `module.purchase-inventory.ps1`
  - result: `PASSED`
  - assertions: `101 PASS / 0 FAIL`
- `2026-04-24 18:38:59 +07`
  - suite: `module.supply-chain.ps1`
  - result: `PASSED`
  - assertions: `28 PASS / 0 FAIL`
- `2026-04-24 18:39:56 +07`
  - suite: `run-backend-module-regression.ps1`
  - result: `FAILED_ENV`
  - assertions: `1160 PASS / 2 FAIL`
  - blocking suite: `module.db-seed-cleanup.ps1`
  - failing checks:
    - `Media cleanup deleted orphan files expected [8] but got [0]`
    - `Target orphan files after media cleanup expected [0] but got [8]`
- `2026-04-24 18:46:56 +07`
  - suite: `module.db-seed-cleanup.ps1`
  - result: `FAILED_ENV -> FIXED_HARNESS -> FIXED_ENV -> PASSED`
  - assertions: `51 PASS / 0 FAIL`
- `2026-04-24 18:48:04 +07`
  - suite: `run-backend-module-regression.ps1`
  - result: `FAILED_ENV -> FIXED_HARNESS -> FIXED_ENV -> PASSED`
  - assertions: `1163 PASS / 0 FAIL`
  - active catalog: `25/25` suites
- `2026-04-24 18:57:10 +07`
  - suite: `module.db-seed-cleanup.ps1`
  - result: `BLOCKED`
  - assertions: `0 PASS / 0 FAIL / 1 BLOCKED`
  - purpose: verify external-backend preflight now classifies missing `DB06_MEDIA_DIR` as env blockage instead of false cleanup failure

## Fixes Applied

- Product fix:
  - `backend/src/purchase/purchase-order.service.ts`
  - added explicit `ObjectId` validation for raw purchase `:id` routes and `supplierId` filters
  - verified split:
    - malformed id/filter -> `400`
    - valid but missing single-resource id -> `404`
    - valid missing supplier filter -> `200` empty result
- Regression coverage:
  - `tests/backend/suites/modules/extended/module.purchase-inventory.ps1`
  - added malformed/missing contract assertions for:
    - `GET/PATCH/DELETE /purchase-orders/:id`
    - `POST /purchase-orders/:id/receive`
    - `GET /purchase-orders?supplierId=...`
    - `GET /purchase-orders/supplier-report?supplierId=...`
- Harness fix:
  - `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1`
  - external-backend mode now requires explicit `DB06_MEDIA_DIR` so helper seed and backend cleanup share the same media root
  - env mismatch is now surfaced as `BLOCKED` instead of a false product failure

## Traceable Logs

- [module.purchase-inventory-rerun-20260424-qa-objectid.log](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/artifacts/results/module.purchase-inventory-rerun-20260424-qa-objectid.log)
- [module.supply-chain-rerun-20260424-objectid-20260424-1839.log](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/artifacts/results/module.supply-chain-rerun-20260424-objectid-20260424-1839.log)
- [module-regression-rerun-20260424-objectid-20260424-1840.log](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/artifacts/results/module-regression-rerun-20260424-objectid-20260424-1840.log)
- [module.db-seed-cleanup-rerun-20260424-objectid-20260424-1845.log](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/artifacts/results/module.db-seed-cleanup-rerun-20260424-objectid-20260424-1845.log)
- [module.db-seed-cleanup-blocked-20260424-1853.log](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/artifacts/results/module.db-seed-cleanup-blocked-20260424-1853.log)
- [module-regression-rerun-20260424-mediafix-20260424-1848.log](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/artifacts/results/module-regression-rerun-20260424-mediafix-20260424-1848.log)
- [module-regression-20260424-184804.json](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/artifacts/results/module-regression-20260424-184804.json)

## Docs Updated

- `tests/backend/README.md`
- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/suites/suite-index.md`
