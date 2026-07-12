# Backend QA Summary - API Token / Timezone Activation - 2026-04-19 01:59:22 +07

## Scope

- Activate `tests/backend/suites/modules/core/module.api-token-timezone.ps1`
- Verify `BE-ADS-05` and `BE-ADS-06` with real execution
- Fix and rerun the strict timezone PATCH-bypass bug in `ad-account`
- Rerun related `ad-account` regression and the canonical backend module regression

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

## Reproduce -> Fix -> Verify

### Bug: strict timezone enforcement bypassed through `PATCH /api/ad-accounts/:id`

- Reproduce before fix:
  - started strict backend on `http://localhost:3610/api` with `ENFORCE_AD_ACCOUNT_TIMEZONE=true`
  - created a `zalo` ad account successfully
  - patched the same record to `accountType=facebook` and `accountId=123456789012345`
  - actual result before fix: `200`, so strict timezone gate was bypassed on update
- Root cause:
  - `backend/src/ad-account/ad-account.service.ts` validated timezone in `create()`, but `update()` did not re-run timezone validation when `accountType`, `accountId`, or `loginCustomerId` changed
- Fix:
  - `backend/src/ad-account/ad-account.service.ts`
  - `update()` now reloads current identity fields and revalidates timezone when provider-backed account identity changes
- Verification after fix:
  - same strict PATCH path now returns `400`
  - strict create path blocks missing provider lookup for Facebook / Google / TikTok
  - non-strict default path still allows create when lookup is unavailable

## Suite Results

### `module.api-token-timezone.ps1`

- Run: `2026-04-19 01:58:10 +07`
- Artifact: `tests/backend/artifacts/results/module.api-token-timezone-rerun-20260419-015810.log`
- Result: `22 PASS / 0 FAIL / 0 BLOCKED`
- Covered:
  - `api-tokens/settings` permission boundary: director + manager allowed, employee blocked
  - `ad-accounts` permission boundary: director allowed, employee blocked
  - Google settings save/readback with database-source masking
  - Google test endpoint handled failure payload with fake credentials
  - TikTok settings/test handled failure payload without access token
  - `sync/from-fanpages`, `set-primary`, `rotate`, and deterministic Google `validate`
  - strict vs non-strict ad-account timezone behavior, including strict PATCH bypass regression

### Related regression: `module.ad-account-ad-group.ps1`

- Run: `2026-04-19 01:59:12 +07`
- Artifact: `tests/backend/artifacts/results/module.ad-account-ad-group-rerun-20260419-015912.log`
- Result: `35 PASS / 0 FAIL`
- Purpose:
  - check ripple after the `AdAccountService.update()` timezone fix on the core ad-account CRUD path

### Canonical full module regression

- Run: `2026-04-19 01:59:22 +07`
- Artifacts:
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-015921.log`
  - `tests/backend/artifacts/results/module-regression-20260419-015922.json`
  - `tests/backend/artifacts/results/module-regression-latest.json`
- Result: `879 PASS / 0 FAIL`
- Catalog: `21 / 21` modules passed

## Status Progression

- `module.api-token-timezone.ps1`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - first local run failed because response JSON parsing used unsupported `ConvertFrom-Json -Depth` in the current PowerShell path
  - suite helper was fixed to parse JSON compatibly and preserve actual HTTP status codes
- `ad-account strict PATCH bypass`: `FAILED -> FIXED -> PASSED`
- `module.ad-account-ad-group.ps1`: `PASSED`
- canonical module regression: `FIXED_RUNNER -> PASSED`
  - runner now includes `module.api-token-timezone.ps1`

## Files Changed In This Round

- `backend/src/ad-account/ad-account.service.ts`
- `tests/backend/suites/modules/core/module.api-token-timezone.ps1`
- `tests/backend/runners/run-backend-module-regression.ps1`

## Ripple Areas Verified

- `ad-account`
- `api-token`
- `ads foundation`
- `ad-group` / `advertising-cost` via targeted rerun
- full canonical regression remained green for `order`, `finance`, `cashflow`, `reports`, `alerts`, `media`, `auth`, `supplier/product`, and ads-budget flows

## Open Risks

- `backend/.env` still drifts from live QA Mongo port (`27019` in file vs `27017` live), so suite runners remain exposed to `BLOCKED_ENV` unless `MONGODB_URI` is overridden.
- `api-token` command endpoints still use default NestJS `POST` status semantics on several non-create actions; this round verified handled payloads, but did not normalize those HTTP status codes.
- Planned gaps outside this round remain for `module.order-sheet-sync-ops.ps1`, concurrency-focused ripple suites, public-contract suites, DB consistency suites, and load/perf harnesses.

## Next Test Step

1. Standardize local QA Mongo configuration so canonical setup stops depending on `MONGODB_URI` override.
2. Continue with the next P1 planned gap after `api-token/timezone`, starting with `module.order-sheet-sync-ops.ps1`.
