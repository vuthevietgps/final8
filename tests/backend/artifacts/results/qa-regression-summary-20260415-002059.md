# Backend QA Regression Summary - 2026-04-15 00:20:59 +07

## Scope

- Full backend module regression via `tests/backend/runners/run-backend-module-regression.ps1`
- Targeted reruns for:
  - `module.labor-other-cost.ps1`
  - `module.reports-products-config.ps1`
  - `module.agent-supplier-quotes.ps1`

## Environment

- App URL: `http://localhost:3000`
- Backend health: `GET /health` was healthy during execution
- Baseline users: ensured by `tests/backend/setup/ensure-regression-users.ps1`
- Mongo topology: standalone Mongo without replica set transaction support

## Full Regression Result

- Start timestamp: `20260415-002059`
- Result artifact JSON:
  - `tests/backend/artifacts/results/module-regression-20260415-002059.json`
  - `tests/backend/artifacts/results/module-regression-latest.json`
- Final total: `763 PASS / 1 FAIL` across `18` modules and `764` assertions

## Progression History

- Previous full regression `20260415-000937`: `740 PASS / 16 FAIL`
- Targeted rerun `module.labor-other-cost.ps1`: `23 PASS / 1 FAIL -> 32 PASS / 0 FAIL`
- Targeted rerun `module.reports-products-config.ps1`: `39 PASS / 2 FAIL -> 40 PASS / 1 FAIL`
- Targeted rerun `module.agent-supplier-quotes.ps1`: `5 PASS / 13 FAIL -> 18 PASS / 0 FAIL`
- Current full regression `20260415-002059`: `763 PASS / 1 FAIL`

## Failed -> Fixed -> Passed

### `Labor Cost & Other Cost`

- Previous failure:
  - `Create labor statement failed`
- Root cause:
  - Suite used a fixed statement period and collided with surviving confirmed/closed statements from earlier runs.
- Action:
  - Updated `tests/backend/suites/modules/core/module.labor-other-cost.ps1` to create a run-specific statement date.
- Verification:
  - `tests/backend/artifacts/results/tmp-module.labor-other-cost-rerun-20260415b.log`
- Status:
  - `FAILED -> FIXED -> PASSED`

### `Reports, Products & Config`

- Previous failure:
  - `Salary config failed`
- Root cause:
  - `GET /api/salary-config` returned `200 []`, but `Invoke-RestMethod` collapsed the empty array into `$null`.
- Action:
  - Updated `tests/backend/suites/modules/core/module.reports-products-config.ps1` to read the raw HTTP response and treat `[]` as a valid empty result.
- Verification:
  - `tests/backend/artifacts/results/tmp-module.reports-products-config-rerun-20260415b.log`
- Status:
  - `FAILED -> FIXED -> PASSED` for `Salary config`

### `Agent & Supplier Quotes`

- Previous failures:
  - Setup incomplete
  - Create quote failed
  - Create second quote failed
  - Quotes by agent failed
  - Quotes by product failed
  - Create supplier quote failed
  - Create second supplier quote failed
  - Latest supplier quote failed
  - Effective supplier quote failed
  - Price history failed
  - Quotes by supplier failed
- Root cause:
  - Suite setup was non-deterministic and depended on global user state and duplicate fixed emails.
  - Response shape handling for supplier quote list/history was incomplete.
- Action:
  - Updated `tests/backend/suites/modules/core/module.agent-supplier-quotes.ps1` to prefer ensured regression users, fall back to unique temp users, and normalize supplier quote response counting.
- Verification:
  - `tests/backend/artifacts/results/tmp-module.agent-supplier-quotes-rerun-20260415b.log`
- Status:
  - `FAILED -> FIXED -> PASSED`

## Failed -> Blocked

### `Return request resolve`

- Suite:
  - `tests/backend/suites/modules/core/module.reports-products-config.ps1`
- Case:
  - `PATCH /api/returns/:id/resolve`
- Current result:
  - `FAILED -> BLOCKED_ENV`
- Reason:
  - Backend path is transactional and current Mongo topology is standalone.
  - Runtime error observed in backend log:
    - `MongoServerError: Transaction numbers are only allowed on a replica set member or mongos`
- Evidence:
  - `backend/qa-test-run.err.log`
- Code path:
  - `backend/src/return-request/return-request.service.ts`
- Required next step:
  - Run this case on Mongo replica set or mongos.

## Files Changed In This Round

- `tests/backend/suites/modules/core/module.labor-other-cost.ps1`
- `tests/backend/suites/modules/core/module.reports-products-config.ps1`
- `tests/backend/suites/modules/core/module.agent-supplier-quotes.ps1`

## Open Risks

- The active PowerShell runner still reports only `PASS/FAIL`; it does not yet expose a first-class `BLOCKED` state in summary output.
- Transaction-dependent flows should be executed in a replica-set-backed environment before release sign-off.

## Next Test Step

1. Add a runner/suite convention for `BLOCKED_ENV` so transaction-gated cases are visible without being misread as product failures.
2. Re-run `module.reports-products-config.ps1` on a Mongo replica set and close the remaining blocker.
