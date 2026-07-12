# Backend QA Regression Summary - 2026-04-19 01:40:52 +07

## Scope

- Activate and verify `tests/backend/suites/modules/core/module.user-import-export.ps1` for `BE-MASTER-04`, `BE-MASTER-05`, and `BE-MASTER-06`
- Rerun related auth regression after tightening `import-users` / `export-users` permissions
- Rerun canonical backend module regression after adding the new suite to `tests/backend/runners/run-backend-module-regression.ps1`

## Environment

- Backend base URL: `http://localhost:3600/api`
- Backend health URL: `http://localhost:3600/health`
- MongoDB override: `mongodb://127.0.0.1:27017/htxbachgia`
- Baseline users: `tests/backend/setup/ensure-regression-users.ps1`
- Shell runner: Windows PowerShell
- Environment note:
  - `backend/.env` still points to `127.0.0.1:27019`
  - live QA Mongo service for this round listened on `127.0.0.1:27017`
  - all real reruns in this round used explicit `MONGODB_URI`

## Progression History

- `module.user-import-export-rerun-20260419-0121.log`
  - status: `BLOCKED_ENV`
  - cause: `ensure-regression-users.ps1` read `backend/.env` and hit Mongo drift (`27019` vs live `27017`)
- `module.user-import-export-rerun-20260419-013505.log`
  - status: `FAILED_HARNESS`
  - result: `28 PASS / 3 FAIL`
  - cause:
    - suite reused template-derived localized header that was not stable under the current PowerShell/runtime encoding path
    - an intermediate row-shape fix attempt wrapped CSV rows one level too deep and broke good-import expectations
- `module.user-import-export-rerun-20260419-013643.log`
  - status: `FIXED_HARNESS -> PASSED`
  - result: `32 PASS / 0 FAIL`
- `module.auth-rbac-rerun-20260419-013729.log`
  - status: `PASSED`
  - result: `25 PASS / 0 FAIL`
- `module-regression-20260419-013748.json`
  - status: `PASS_WITH_CATALOG_GAP`
  - result: `825 PASS / 0 FAIL`
  - note: canonical runner still listed `19` modules and omitted `module.user-import-export.ps1`
- `module-regression-20260419-014052.json`
  - status: `FIXED_RUNNER -> PASSED`
  - result: `857 PASS / 0 FAIL` across `20` modules

## Bugs Fixed In This Round

### `import-users` / `export-users` security hardening

- Manual reproduce before fix:
  - unauthenticated `GET /api/export-users/stats` returned `200`
  - unauthenticated `GET /api/export-users/csv` returned `200`
  - unauthenticated `GET /api/import-users/template` returned `200`
  - unauthenticated `GET /api/import-users/instructions` returned `200`
  - unauthenticated `POST /api/import-users/validate` returned `201`
  - unauthenticated `POST /api/import-users/csv` returned `201` and created a real probe user
  - exported CSV emitted raw spreadsheet formula payloads in `fullName` and `notes`
- Root cause:
  - controllers had no `JwtAuthGuard` / `RolesGuard` / `RequirePermissions('users')`
  - export CSV path did not neutralize spreadsheet formula payloads
- Fix:
  - added auth + role guard + `users` permission to `backend/src/export-user/export-user.controller.ts`
  - added auth + role guard + `users` permission to `backend/src/import-user/import-user.controller.ts`
  - neutralized spreadsheet formula prefixes in `backend/src/export-user/export-user.service.ts`
- Verification:
  - isolated backend on `3600` returned `401` for the unauthenticated import/export endpoints after the fix
  - `module.user-import-export.ps1` passed formula-neutralization and auth-boundary assertions
  - `module.auth-rbac.ps1` rerun stayed green

### `module.user-import-export.ps1` harness hardening

- Root cause:
  - template-derived localized header was not stable for the suite's upload path on the current Windows PowerShell execution path
  - the first row-array workaround produced CSV rows as single space-joined cells instead of comma-delimited fields
- Fix:
  - switched generated import payloads to a canonical English header accepted by `ImportUserService`
  - kept template coverage as a contract check instead of a header source of truth
  - corrected generated CSV row shape for mixed import and malformed-row checks
- Files:
  - `tests/backend/suites/modules/core/module.user-import-export.ps1`
  - `tests/backend/runners/run-backend-module-regression.ps1`

## Regression Results

- Targeted suite:
  - `module.user-import-export.ps1`: `32 PASS / 0 FAIL`
- Related auth regression:
  - `module.auth-rbac.ps1`: `25 PASS / 0 FAIL`
- Full module regression:
  - `20 / 20` modules passed
  - `857 PASS / 0 FAIL`
- Ripple areas checked by rerun:
  - `auth`
  - `user selectors`
  - `reports/export`
  - `finance`, `cashflow`, `alerts`, `orders`, `supplier/product`, and ads-budget flows via the full canonical regression

## Cleanup Performed

- Deleted manual reproduce users:
  - `unauth.import.probe.20260419@test.com`
  - `csv.injection.probe.20260419@test.com`
  - `user-import-export.manual.20260419@test.com`
  - `unauth.import.probe2.20260419@test.com`

## Files Verified In This Round

- `backend/src/export-user/export-user.controller.ts`
- `backend/src/import-user/import-user.controller.ts`
- `backend/src/export-user/export-user.service.ts`
- `tests/backend/suites/modules/core/module.user-import-export.ps1`
- `tests/backend/runners/run-backend-module-regression.ps1`

## Logs And Artifacts

- `tests/backend/artifacts/results/module.user-import-export-rerun-20260419-0121.log`
- `tests/backend/artifacts/results/module.user-import-export-rerun-20260419-013505.log`
- `tests/backend/artifacts/results/module.user-import-export-rerun-20260419-013643.log`
- `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-013729.log`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-013747.log`
- `tests/backend/artifacts/results/module-regression-20260419-013748.json`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-014051.log`
- `tests/backend/artifacts/results/module-regression-20260419-014052.json`
- `tests/backend/artifacts/results/module-regression-latest.json`
- `tests/backend/artifacts/results/qa-module-regression-summary-20260419-014052.md`
- `tests/backend/artifacts/results/qa-module-regression-summary-20260419-014052.json`

## Open Risks

- `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so suites remain vulnerable to `BLOCKED_ENV` unless `MONGODB_URI` is overridden.
- Export hardening coverage now proves common formula-prefix neutralization, but deeper round-trip spreadsheet behavior is still only partially covered.
- Planned gaps outside this round remain for `module.api-token-timezone.ps1`, `module.order-sheet-sync-ops.ps1`, concurrency ripple suites, and other matrix items still marked planned.

## Next Test Step

1. Standardize the local QA Mongo configuration so the canonical setup path stops depending on `MONGODB_URI` overrides.
2. Continue with the next P1 planned gap outside the now-active user import/export surface, starting with `module.api-token-timezone.ps1` or `module.order-sheet-sync-ops.ps1`.
