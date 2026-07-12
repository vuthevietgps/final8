# Backend QA Summary - DB Consistency Expansion - 2026-04-19 09:18:26 +07

## Scope

- Expand `tests/backend/suites/modules/extended/module.db-consistency.ps1` to cover `CON-09`
- Reproduce and fix `other-cost` Bangkok timezone boundary drift across list, summary, cashflow, snapshot, and `financial-control`
- Rerun canonical module regression on an isolated backend after the product fix

## Environment

- Targeted suite backend:
  - `http://localhost:3680/api`
  - Mongo URI: `mongodb://127.0.0.1:27017/htxbachgia_db_consistency_20260419080903`
  - rerun Mongo URI: `mongodb://127.0.0.1:27017/htxbachgia_db_consistency_20260419081106`
- Canonical regression attempt kept for audit:
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-081155.log`
  - status: `BLOCKED_ENV`
  - note: default runner hit `http://localhost:3000`, where a non-QA service returned `/health=404` and auth `401/403`
- Canonical regression closure:
  - `http://localhost:3684/api`
  - Mongo URI: `mongodb://127.0.0.1:27017/htxbachgia_module_regression_20260419-091342`
- Baseline users:
  - `tests/backend/setup/ensure-regression-users.ps1`

## Progression History

- `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-080903.log`
  - `2026-04-19 08:09:03 +07`
  - status: `FAILED`
  - result: `51 PASS / 6 FAIL`
  - failures:
    - same-day `other-cost` list filter missed the boundary record
    - same-day summary returned `count=0`, `amount=0`
    - `dueByDay7d` shifted the same Bangkok day to yesterday
    - overdue alert fired on a same-day due date
    - `ops` snapshot stored the shifted day
- `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-081105.log`
  - `2026-04-19 08:11:05 +07`
  - status: `FAILED -> FIXED_PRODUCT -> PASSED`
  - result: `57 PASS / 0 FAIL`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-081155.log`
  - `2026-04-19 08:11:55 +07`
  - status: `BLOCKED_ENV`
  - note: runner used `http://localhost:3000` without explicit override and hit the wrong service
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-091342.log`
  - `tests/backend/artifacts/results/module-regression-20260419-091356.json`
  - status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
  - result: `991 PASS / 0 FAIL`, `23 / 23` modules

## Failed -> Fixed -> Passed

### Other-cost Bangkok business-day drift

- Reproduce before fix:
  - create `other-cost` with `date` and `dueDate` at `2026-04-19T00:30:00+07:00`
  - query `GET /api/other-cost?from=2026-04-19&to=2026-04-19`
  - query `GET /api/other-cost/summary?from=2026-04-19&to=2026-04-19`
  - query `GET /api/other-cost/summary/cashflow?windowDays=14`
  - query raw `cashflow_summary_snapshots` for `domain='ops', windowDays=14`
- Broken behavior before fix:
  - list and summary treated the record as outside the same Bangkok day
  - `dueByDay7d` emitted the previous UTC day
  - same-day due date was marked overdue
  - `ops` snapshot copied the shifted date
- Root cause:
  - `backend/src/other-cost/other-cost.service.ts`
  - date-only range filters used raw `new Date('YYYY-MM-DD')`, which is UTC midnight
  - cashflow summary derived `today` from `now.toISOString().split('T')[0]`
  - `$dateToString` grouped `dueDate` without `timezone: 'Asia/Bangkok'`
- Fix:
  - added explicit Bangkok business-day helpers for day formatting and range boundaries
  - changed date-only filters in `findAll()` and `getSummary()` to use Bangkok start/end-of-day windows
  - changed cashflow summary to compute `today` from Bangkok business day
  - changed `dueByDay7d` and `nextDueDate` grouping to use `timezone: 'Asia/Bangkok'`
- Rerun status:
  - `FAILED -> FIXED_PRODUCT -> PASSED`
  - same-day list/summary now include the boundary record
  - `dueByDay7d` keeps `2026-04-19`
  - overdue alert no longer fires for the same Bangkok day
  - `ops` snapshot and `financial-control` stay aligned across create, confirm, and delete

## Related Regression

- Canonical full module regression:
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-091342.log`
  - `tests/backend/artifacts/results/module-regression-20260419-091356.json`
  - `tests/backend/artifacts/results/module-regression-latest.json`
  - result: `991 PASS / 0 FAIL`, `23 / 23` modules
- Downstream suites covered by the full rerun:
  - `module.labor-other-cost.ps1`: `32 PASS / 0 FAIL`
  - `module.finance-control-funds.ps1`: `40 PASS / 0 FAIL`
  - `module.db-consistency.ps1`: `57 PASS / 0 FAIL`

## Files Changed In This Round

- `backend/src/other-cost/other-cost.service.ts`
- `tests/backend/suites/modules/extended/module.db-consistency.ps1`

## Files Updated For Traceability

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live)
- local full-run commands still need explicit `BACKEND_BASE_URL` and `BACKEND_HEALTH_URL` when `localhost:3000` is occupied by a non-QA service
- `DB-05`, `DB-06`, `E2E-RIPPLE-04`, `E2E-RIPPLE-06`, and `LOAD-*` remain open

## Next Test Step

1. Expand `module.db-consistency.ps1` for `DB-05`.
2. Add the `DB-06` seed/cleanup checklist.
3. Continue with `e2e.return-ripple.ps1` and `e2e.order-update-ripple.ps1`.
