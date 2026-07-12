# Backend QA Summary - Module Regression Closure - 2026-04-19 04:18:12 +07

## Scope

- Close the canonical `22`-module regression after the concurrent-finance product fix
- Preserve the failed wrong-target regression attempt for audit
- Fix the remaining clean-DB false fail in `module.ads-alerts-kpi.ps1`

## Environment

- Canonical regression backend: `http://localhost:3676/api`
- Health endpoint: `http://localhost:3676/health`
- Mongo runtime: explicit `MONGODB_URI` on `127.0.0.1:27017`
- Runtime note:
  - `backend/.env` still points to `127.0.0.1:27019`
  - this rerun exported `BACKEND_BASE_URL` and `BACKEND_HEALTH_URL` so the module runner would not fall back to `3000`

## Progression History

- `module-regression-20260419-041141.json`
  - status: `FAILED_HARNESS_ENV`
  - result: `0 PASS / 29 FAIL`
  - root issue: module runner targeted `http://localhost:3000` without isolated-backend env override
- `module.ads-alerts-kpi-rerun-20260419-0520.log`
  - status: `FAILED_HARNESS`
  - result: `26 PASS / 1 FAIL`
  - root issue: empty snapshot array from `capital-allocation/snapshots` was treated as `$null`
- `module.ads-alerts-kpi-rerun-20260419-0530.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - result: `27 PASS / 0 FAIL`
- `full-module-regression-rerun-20260419-0530.log`
  - status: `FAILED_HARNESS_ENV -> FIXED_ENV -> PASSED`
  - result: `934 PASS / 0 FAIL`, `22 / 22` modules
  - json artifacts:
    - `tests/backend/artifacts/results/module-regression-20260419-041812.json`
    - `tests/backend/artifacts/results/module-regression-latest.json`

## Failed -> Fixed -> Passed

### Module runner wrong-target environment

- Failed audit kept:
  - `module-regression-20260419-041141.json`
  - all suites hit wrong-target `403/404` because the runner fell back to `http://localhost:3000`
- Environment correction:
  - exported `BACKEND_BASE_URL='http://localhost:3676/api'`
  - exported `BACKEND_HEALTH_URL='http://localhost:3676/health'`
- Rerun status:
  - `FAILED_HARNESS_ENV -> FIXED_ENV -> PASSED`
  - canonical module regression closed at `934 PASS / 0 FAIL`

### `module.ads-alerts-kpi.ps1` clean-DB snapshot list

- Reproduce before fix:
  - clean DB returned `[]` for `GET /capital-allocation/snapshots?limit=5`
  - suite still emitted `List snapshots failed`
- Root cause:
  - `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`
  - empty `@()` result from a PowerShell `if` expression collapsed to `$null`
- Fix:
  - wrapped the normalization path in `@(...)`
- Rerun status:
  - `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - `module.ads-alerts-kpi.ps1` closed at `27 PASS / 0 FAIL`

## Related Inputs To This Closure

- `e2e.concurrent-finance-ripple.ps1`: `40 PASS / 0 FAIL`
- `e2e.agent-role-payment.ps1`: `46 PASS / 0 FAIL`
- `e2e.order-finance-impact.ps1`: `56 PASS / 0 FAIL`

## Files Changed In This Round

- `tests/backend/suites/modules/core/module.ads-alerts-kpi.ps1`
- `tests/backend/suites/e2e-flows/e2e.agent-role-payment.ps1`
- `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
- `backend/src/test-order2/services/order-payment.service.ts`

## Files Updated For Traceability

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live).
- `CON-08`, `CON-09`, `DB-*`, and `LOAD-*` remain open after this closure.

## Next Test Step

1. Standardize local QA Mongo configuration.
2. Continue with `module.db-consistency.ps1`.
