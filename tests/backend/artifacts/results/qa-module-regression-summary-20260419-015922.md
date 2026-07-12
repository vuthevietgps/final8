# Backend QA Regression Summary - 2026-04-19 01:59:22 +07

## Scope

- Activate `tests/backend/suites/modules/core/module.api-token-timezone.ps1`
- Fix strict timezone PATCH-bypass in `backend/src/ad-account/ad-account.service.ts`
- Rerun related `ad-account` regression
- Rerun canonical backend module regression after adding the new suite to the runner

## Environment

- Default backend: `http://localhost:3600/api`
- Strict timezone backend: `http://localhost:3610/api`
- MongoDB override: `mongodb://127.0.0.1:27017/htxbachgia`
- Baseline users: `tests/backend/setup/ensure-regression-users.ps1`
- Shell runner: Windows PowerShell
- Environment note:
  - `backend/.env` still points to `127.0.0.1:27019`
  - live QA Mongo service for this round listened on `127.0.0.1:27017`
  - all real reruns in this round used explicit `MONGODB_URI`

## Progression History

- `module.api-token-timezone-rerun-20260419-015734.log`
  - status: `FAILED_HARNESS`
  - cause: suite helper used unsupported `ConvertFrom-Json -Depth` on the current PowerShell path
- `module.api-token-timezone-rerun-20260419-015810.log`
  - status: `FIXED_HARNESS -> PASSED`
  - result: `22 PASS / 0 FAIL / 0 BLOCKED`
- `module.ad-account-ad-group-rerun-20260419-015912.log`
  - status: `PASSED`
  - result: `35 PASS / 0 FAIL`
- `module-regression-20260419-015922.json`
  - status: `FIXED_RUNNER -> PASSED`
  - result: `879 PASS / 0 FAIL` across `21` modules

## Failed -> Fixed -> Passed

### `ad-account` strict timezone PATCH bypass

- Reproduce before fix:
  - on strict backend `3610`, created a `zalo` ad account
  - patched the same record to `accountType=facebook` and a Facebook account id
  - actual result before fix: `200`
- Root cause:
  - `create()` enforced timezone validation, but `update()` did not revalidate when provider-backed account identity changed
- Fix:
  - `backend/src/ad-account/ad-account.service.ts`
  - `update()` now reloads current identity fields and revalidates timezone when `accountType`, `accountId`, or `loginCustomerId` changes into a provider-backed account path
- Rerun status:
  - `FAILED -> FIXED -> PASSED`
  - strict PATCH path now returns `400`
- Ripple check:
  - `module.ad-account-ad-group.ps1` rerun stayed green
  - full module regression `20260419-015922` stayed green for ads foundation, ad-group, advertising-cost, KPI, alerts, and all current module suites

### `module.api-token-timezone.ps1` activation harness

- First run status:
  - `FAILED_HARNESS`
- Root cause:
  - response JSON parser used unsupported `ConvertFrom-Json -Depth` in the current PowerShell execution path
- Fix:
  - `tests/backend/suites/modules/core/module.api-token-timezone.ps1`
  - switched helper parsing to PowerShell-compatible JSON parsing
  - preserved actual HTTP status codes
  - tracked imported fanpage tokens for deterministic cleanup
- Rerun status:
  - `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - `22 PASS / 0 FAIL / 0 BLOCKED`

## Current Regression Snapshot

- Targeted suite:
  - `module.api-token-timezone.ps1`: `22 PASS / 0 FAIL / 0 BLOCKED`
- Related rerun:
  - `module.ad-account-ad-group.ps1`: `35 PASS / 0 FAIL`
- Canonical full module regression:
  - `21 / 21` modules passed
  - `879 PASS / 0 FAIL`

## Files Changed In This Round

- `backend/src/ad-account/ad-account.service.ts`
- `tests/backend/suites/modules/core/module.api-token-timezone.ps1`
- `tests/backend/runners/run-backend-module-regression.ps1`

## Logs And Artifacts

- `tests/backend/artifacts/results/module.api-token-timezone-rerun-20260419-015734.log`
- `tests/backend/artifacts/results/module.api-token-timezone-rerun-20260419-015810.log`
- `tests/backend/artifacts/results/module.ad-account-ad-group-rerun-20260419-015912.log`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-015921.log`
- `tests/backend/artifacts/results/module-regression-20260419-015922.json`
- `tests/backend/artifacts/results/module-regression-latest.json`
- `tests/backend/artifacts/results/qa-api-token-timezone-summary-20260419-015922.md`
- `tests/backend/artifacts/results/qa-api-token-timezone-summary-20260419-015922.json`
- `tests/backend/artifacts/results/qa-module-regression-summary-20260419-015922.md`
- `tests/backend/artifacts/results/qa-module-regression-summary-20260419-015922.json`

## Files Updated For Traceability

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so suites remain vulnerable to `BLOCKED_ENV` unless `MONGODB_URI` is overridden.
- Several `api-token` command endpoints still use default NestJS `POST` status semantics even when no resource is created; this round verified handled payloads but did not normalize those HTTP status codes.
- Planned gaps outside this round remain for `module.order-sheet-sync-ops.ps1`, concurrency-focused ripple suites, public-contract suites, DB consistency suites, and load/perf harnesses.

## Next Test Step

1. Standardize local QA Mongo configuration so canonical setup stops depending on `MONGODB_URI` override.
2. Continue with the next P1 planned gap after `api-token/timezone`, starting with `module.order-sheet-sync-ops.ps1`.
