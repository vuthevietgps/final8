# Backend QA Regression Summary - 2026-04-15 00:34:57 +07

## Scope

- Full backend module regression via `tests/backend/runners/run-backend-module-regression.ps1`
- Targeted reruns for:
  - `module.reports-products-config.ps1`
  - `module.return-report-product-rate.ps1`

## Environment

- App URL: `http://localhost:3000`
- Backend health: `GET /health` was healthy during execution
- Baseline users: ensured by `tests/backend/setup/ensure-regression-users.ps1`
- Mongo topology: single-node replica set on `127.0.0.1:27019` with transaction support enabled
- Historical note:
  - the previous run `20260415-002059` used the same QA dataset on standalone Mongo and left `return-request resolve` in `BLOCKED_ENV`

## Full Regression Result

- Start timestamp: `20260415-003457`
- Result artifact JSON:
  - `tests/backend/artifacts/results/module-regression-20260415-003457.json`
  - `tests/backend/artifacts/results/module-regression-latest.json`
- Final total: `764 PASS / 0 FAIL` across `18` modules and `764` assertions

## Progression History

- Previous full regression `20260415-000937`: `740 PASS / 16 FAIL`
- Targeted rerun `module.labor-other-cost.ps1`: `23 PASS / 1 FAIL -> 32 PASS / 0 FAIL`
- Targeted rerun `module.reports-products-config.ps1`: `39 PASS / 2 FAIL -> 40 PASS / 1 FAIL -> 41 PASS / 0 FAIL`
- Targeted rerun `module.agent-supplier-quotes.ps1`: `5 PASS / 13 FAIL -> 18 PASS / 0 FAIL`
- Previous full regression `20260415-002059`: `763 PASS / 1 FAIL`
- Targeted rerun `module.return-report-product-rate.ps1`: `20 PASS / 0 FAIL`
- Current full regression `20260415-003457`: `764 PASS / 0 FAIL`

## Failed -> Blocked_Env -> Fixed_Env -> Passed

### `Return request resolve`

- Suite:
  - `tests/backend/suites/modules/core/module.reports-products-config.ps1`
- Case:
  - `PATCH /api/returns/:id/resolve`
- Previous state:
  - `FAILED -> BLOCKED_ENV`
- Root cause:
  - Backend path is transactional and the earlier QA Mongo topology was standalone.
- Environment action:
  - Recreated the active QA Mongo on `127.0.0.1:27019` as a single-node replica set and verified transaction support before rerun.
- Verification:
  - `tests/backend/artifacts/results/tmp-module.reports-products-config-rerun-20260415c.log`
  - `tests/backend/artifacts/results/tmp-module.return-report-product-rate-rerun-20260415c.log`
  - `tests/backend/artifacts/results/module-regression-20260415-003457.json`
- Status:
  - `FAILED -> BLOCKED_ENV -> FIXED_ENV -> PASSED`

## Files Changed In This Closing Round

- `tests/backend/artifacts/results/qa-regression-summary-20260415-003457.md`
- `tests/backend/README.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`

## Open Risks

- Current module regression baseline is green.
- Transaction-dependent local QA now depends on keeping Mongo on `127.0.0.1:27019` in replica-set mode.
- `purchase` / `inventory` remain `blocked_runtime` until they are wired into `AppModule`.

## Next Test Step

1. Keep an explicit transaction-support preflight in the backlog so local QA fails fast if Mongo falls back to standalone mode.
2. Move to the next P0/P1 backlog suites: `module.auth-hardening.ps1`, `module.user-import-export.ps1`, `module.api-token-timezone.ps1`, and `module.order-sheet-sync-ops.ps1`.
