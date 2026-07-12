# QA DB Consistency Summary - 2026-04-19 11:50:21 +07

## Scope

- Suite: `tests/backend/suites/modules/extended/module.db-consistency.ps1`
- Environment:
  - failed harness run: isolated backend `http://localhost:3682/api`, Mongo `mongodb://127.0.0.1:27017/htxbachgia_db_consistency_20260419114841`
  - rerun after harness fix: isolated backend `http://localhost:3683/api`, Mongo `mongodb://127.0.0.1:27017/htxbachgia_db_consistency_20260419115021`
- Cases covered in final rerun: `DB-01`, `DB-02`, `DB-03`, `DB-04`, `DB-05`, `CON-08`, `CON-09`

## Audit Trail

- `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-114841.log`
  - status: `FAILED_HARNESS`
  - result: `60 PASS / 7 FAIL`
  - failure signal:
    - `PATCH /api/returns/:id/resolve` valid-path returned `404`
    - root cause: suite linked `return-request` to `fakeOrderId`, so valid resolve hit real linked-order lookup and failed for harness reasons
- `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-115021.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - result: `68 PASS / 0 FAIL`

## Cases And Results

- `DB-01 / CON-08`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - reproduce: previous suite created `return-request` with fake linked order id
  - final verification: invalid resolve still rejected `400`; valid resolve succeeded; duplicate resolve rejected `400`; inventory and request state stayed single-write
- `DB-02`: `PASSED`
  - category delete remained blocked/clean while product reference existed
- `DB-03`: `PASSED`
  - duplicate email create rejected `409`; DB kept exactly one row
- `DB-04`: `PASSED`
  - active capital policy and latest snapshot remained coherent after create/update
- `DB-05`: `PASSED`
  - target path: `GET /api/test-order2`
  - query shape: `page`, `limit`, `adGroupId`, `q`, `isActive`, `orderStatus`, `sortBy=orderDate`, `sortOrder=desc`
  - mutation model: repeated in-filter non-sort updates on `receiverAddress` and `serviceDetails`
  - result: no overlap across page boundaries, no missing/unexpected ids, metadata stayed stable
- `CON-09`: `PASSED`
  - Bangkok boundary create/confirm/delete still green after suite expansion

## Fixes Applied

- `tests/backend/suites/modules/extended/module.db-consistency.ps1`
  - added real linked `test-order2` fixture for `DB-01 / CON-08`
  - added active `DB-05` phase before `CON-09`
  - renumbered `CON-09` steps to preserve suite traceability

## Regression

- Rerun executed on the full `module.db-consistency.ps1` suite after harness fix.
- No additional product regression was required in this round because no backend application code changed.

## Open Risks

- Remaining DB gap: `DB-06`
- Remaining non-DB gaps: `LOAD-01..06`
- `DB-05` is now active, but load/stress-style pagination drift under heavier concurrent write volume still belongs to `LOAD-*`, not this deterministic suite
