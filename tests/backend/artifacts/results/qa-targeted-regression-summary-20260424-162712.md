# QA Targeted Regression Summary - 2026-04-24 16:27:12 +07

## Scope

- Frontend unit lane on `frontend`
- Backend targeted auth regression on `http://localhost:3000/api`
- Backend purchase runtime wiring verification on `http://localhost:3000/api`
- Backend supply-chain / DB consistency ripple reruns on `http://localhost:3000/api`

## Environment

- Shell runner: Windows PowerShell
- Backend runtime: built Nest backend started with explicit `MONGODB_URI=mongodb://127.0.0.1:27017/htxbachgia`
- Shared local QA DB: `mongodb://127.0.0.1:27017/htxbachgia`
- Known env drift still present in `backend/.env`:
  - file value: `mongodb://127.0.0.1:27019/htxbachgia`
  - live local Mongo used in this round: `mongodb://127.0.0.1:27017/htxbachgia`

## Audit Trail

- Frontend unit lane:
  - initial command `cd frontend && npm test -- --watch=false --browsers=ChromeHeadless`
  - status: `FAILED_HARNESS -> FIXED_TEST -> PASSED`
  - final result: `TOTAL: 3 SUCCESS`
  - fixed files:
    - `frontend/src/app/app.spec.ts`
    - `frontend/src/app/features/user/user-list/user-list.spec.ts`
- Backend auth hardening:
  - suite: `tests/backend/suites/modules/core/module.auth-hardening.ps1`
  - first cold run status: `BLOCKED_ENV`
  - root issue: no default backend was listening on `localhost:3000`
  - rerun artifact: `tests/backend/artifacts/results/module.auth-hardening-rerun-20260424-1608.log`
  - rerun status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
  - rerun result: `35 PASS / 0 FAIL`
- Backend auth RBAC:
  - setup artifact: `tests/backend/artifacts/results/ensure-regression-users-20260424-161119.log`
  - suite artifact: `tests/backend/artifacts/results/module.auth-rbac-rerun-20260424-161119.log`
  - status: `PASSED`
  - result: `25 PASS / 0 FAIL`
- Purchase runtime wiring:
  - pre-fix reproduce at review time:
    - `GET /api/purchase-orders` -> `404`
    - `GET /api/inventory/summary` -> `401`
  - fix applied:
    - imported `PurchaseOrderModule` in `backend/src/app.module.ts`
  - post-fix probe artifacts:
    - `tests/backend/artifacts/results/purchase-wiring-probe-20260424-161119.txt`
    - `tests/backend/artifacts/results/purchase-auth-probe-20260424-161234.json`
  - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - post-fix result:
    - `/health` -> `200`
    - unauthenticated `GET /api/purchase-orders` -> `401`
    - director `GET /api/purchase-orders` -> `200`
    - director `GET /api/inventory/summary` -> `200`
- Supply-chain ripple rerun:
  - suite artifact: `tests/backend/artifacts/results/module.supply-chain-rerun-20260424-161852.log`
  - status: `PASSED`
  - result: `28 PASS / 0 FAIL`
- DB consistency shared-DB rerun:
  - first suite artifact: `tests/backend/artifacts/results/module.db-consistency-rerun-20260424-161852.log`
  - first status: `FAILED_HARNESS`
  - first result: `60 PASS / 8 FAIL`
  - reproduce signal:
    - phase `CON-09` expected absolute `654321/0` totals
    - live shared DB already contained one unrelated unpaid `other-cost=12345`
  - fix applied:
    - made phase `CON-09` baseline-aware in `tests/backend/suites/modules/extended/module.db-consistency.ps1`
  - rerun artifact: `tests/backend/artifacts/results/module.db-consistency-rerun-20260424-162705.log`
  - rerun status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - rerun result: `77 PASS / 0 FAIL`

## Root Causes

- Frontend specs drifted away from the real standalone Angular app:
  - `app.spec.ts` lacked router/http providers and still asserted the starter-template `<h1>`
  - `user-list.spec.ts` did not match the zoneless Angular setup
- Backend local QA drifted on environment assumptions:
  - `ensure-regression-users.js` follows `backend/.env`, which still points to dead Mongo `27019`
  - auth suites assume a healthy default backend on `localhost:3000`
- Purchase runtime bug:
  - `PurchaseOrderController` existed on disk but `PurchaseOrderModule` was not imported by `AppModule`, so Nest never mounted `/api/purchase-orders`
- DB consistency harness bug on shared DB:
  - `module.db-consistency.ps1` phase `CON-09` asserted absolute unpaid / due totals as if the DB were clean
  - the live shared DB already had one unpaid overdue `other-cost` (`12345`), so the first rerun failed for a valid reason unrelated to Bangkok timezone logic

## Product / Test Fixes Verified

- `backend/src/app.module.ts`
  - `PurchaseOrderModule` is now imported into `AppModule`
- `tests/backend/suites/modules/extended/module.db-consistency.ps1`
  - phase `CON-09` now asserts deltas against the live cashflow / ops baseline instead of assuming a clean shared DB
- `frontend/src/app/app.spec.ts`
  - aligned providers and assertions with the real app runtime
- `frontend/src/app/features/user/user-list/user-list.spec.ts`
  - aligned test setup with zoneless Angular

## Remaining Risks

- Canonical full backend module regression was not rerun in this round; latest full green remains `2026-04-19`
- `backend/.env` still points to `127.0.0.1:27019`, so cold local QA remains `BLOCKED_ENV` without explicit override
- `BE-SUP-04` is no longer blocked by missing route wiring, but it still lacks a dedicated automated suite for create -> receive -> inventory -> price history
