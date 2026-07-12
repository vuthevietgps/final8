# Backend QA Summary - DB Consistency Activation - 2026-04-19 04:58:16 +07

## Scope

- Activate `tests/backend/suites/modules/extended/module.db-consistency.ps1`
- Reproduce and fix DB consistency bugs in `return-request` and `product-category`
- Tighten related regression coverage in `module.reports-products-config.ps1`
- Add `module.db-consistency.ps1` to the canonical module runner and rerun full regression

## Environment

- Isolated suite backend: `http://localhost:3680/api`
- Canonical full regression backend: `http://localhost:3684/api`
- Mongo URIs used in this round:
  - `mongodb://127.0.0.1:27017/htxbachgia_db_consistency_20260419045645`
  - `mongodb://127.0.0.1:27017/htxbachgia_module_regression_20260419-045807`
- Baseline users: `tests/backend/setup/ensure-regression-users.ps1`
- Shell runner: Windows PowerShell
- Runtime note:
  - `backend/.env` still points to `127.0.0.1:27019`
  - isolated runs in this round required explicit `MONGODB_URI`

## Progression History

- `2026-04-19 04:40:48 +07`
  - status: `FAILED_HARNESS`
  - result: `2 PASS / 1 FAIL`
  - root issue: `module.db-consistency.ps1` used `ConvertFrom-Json -Depth` on Windows PowerShell, so login JSON stayed a raw string and `Director login failed`
- `2026-04-19 04:46:45 +07`
  - status: `FAILED`
  - result: `20 PASS / 3 FAIL`
  - failures:
    - return item `_id` missing on newly created return requests
    - invalid `itemId` resolve returned `200`
    - invalid resolve still changed request status to `resolved`
- `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-0453.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> FAILED`
  - result: `31 PASS / 1 FAIL`
  - remaining failure: deleting a category in use returned `204` and left raw `product.categoryId` orphaned in Mongo
- `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-0456.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> FAILED -> FIXED_PRODUCT -> PASSED`
  - result: `32 PASS / 0 FAIL`

## Failed -> Fixed -> Passed

### Harness parser and isolated-backend cleanup

- Reproduce before fix:
  - suite login failed even though `POST /api/auth/login` returned `201`
  - stale listener processes on `3680` could survive between runs and contaminate the next health/login target
- Root cause:
  - `tests/backend/suites/modules/extended/module.db-consistency.ps1`
  - PowerShell parser used unsupported `ConvertFrom-Json -Depth`
  - teardown only stopped the wrapper process and could leave the real `node` listener alive
- Fix:
  - removed `-Depth` from suite JSON parsing
  - reclaimed pre-existing port listeners
  - detected and stopped the real listener PID on cleanup
- Rerun status:
  - `FAILED_HARNESS -> FIXED_HARNESS`

### Return-request line-item identity and invalid resolve rollback

- Reproduce before fix:
  - new return requests exposed items without stable `_id`
  - `PATCH /api/returns/:id/resolve` with an unknown `itemId` returned `200`
  - the same invalid payload still moved the return request from `pending` to `resolved`
- Root cause:
  - `backend/src/return-request/return-request.schema.ts`
  - `backend/src/return-request/return-request.service.ts`
  - subdocument `_id` generation was disabled, and resolve only applied payload rows that happened to match while still saving `status='resolved'`
- Fix:
  - return items now persist `_id`
  - create path seeds deterministic item ids
  - resolve path now rejects duplicate, unknown, or partial payloads before mutating request status or inventory
  - legacy pending rows missing item ids are backfilled before read/resolve
- Rerun status:
  - `FAILED -> FIXED_PRODUCT -> PASSED`
  - invalid resolve now returns `400`
  - request stays `pending`
  - inventory stays unchanged until a valid resolve commits

### Category delete orphan reference

- Reproduce before fix:
  - deleting a category in use returned `204`
  - raw Mongo truth still showed the product document with `categoryId` pointing to the deleted category
- Root cause:
  - `backend/src/product-category/product-category.service.ts`
  - delete path did not block removal when referenced products still existed
- Fix:
  - delete now checks raw `products` references on the same Mongo connection and returns `409` while the category is still in use
- Rerun status:
  - `FAILED -> FIXED_PRODUCT -> PASSED`
  - `DB-02` now passes with `Category delete blocked while references still exist`

## Related Regression

- Canonical full module regression:
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-045807.log`
  - `tests/backend/artifacts/results/module-regression-20260419-045816.json`
  - `tests/backend/artifacts/results/module-regression-latest.json`
  - result: `966 PASS / 0 FAIL`, `23 / 23` modules
- Related suites covered by the full rerun:
  - `module.reports-products-config.ps1`: `38 PASS / 0 FAIL`
  - `module.return-report-product-rate.ps1`: `20 PASS / 0 FAIL`
  - `module.agent-supplier-quotes.ps1`: `18 PASS / 0 FAIL`
  - `module.supply-chain.ps1`: `28 PASS / 0 FAIL`

## Files Changed In This Round

- `backend/src/return-request/return-request.schema.ts`
- `backend/src/return-request/return-request.service.ts`
- `backend/src/product-category/product-category.service.ts`
- `tests/backend/suites/modules/extended/module.db-consistency.ps1`
- `tests/backend/suites/modules/core/module.reports-products-config.ps1`
- `tests/backend/runners/run-backend-module-regression.ps1`

## Files Updated For Traceability

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so isolated runs still need explicit `MONGODB_URI`
- `DB-05`, `DB-06`, `CON-09`, and `LOAD-*` remain open after this activation

## Next Test Step

1. Expand `module.db-consistency.ps1` for `DB-05` and `CON-09`.
2. Add the `DB-06` seed/cleanup checklist.
3. Continue with `e2e.return-ripple.ps1` and `e2e.order-update-ripple.ps1`.
