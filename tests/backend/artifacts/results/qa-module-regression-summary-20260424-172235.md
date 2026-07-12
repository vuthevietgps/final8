# QA Module Regression Summary - 2026-04-24 17:22:35 +07

## Scope

- Close the only failing suite from the isolated canonical full regression on `2026-04-24 17:00:22 +07`.
- Preserve audit trail for `FAILED -> FIXED -> PASSED`.
- Re-run the full `25`-suite backend module catalog after the fix.

## Environment

- Backend base URL: `http://127.0.0.1:3697/api`
- Backend health: `http://127.0.0.1:3697/health`
- Mongo override: `mongodb://127.0.0.1:27017/htxbachgia_full_module_20260424-172224`
- Runtime: Windows PowerShell + built backend `dist/main.js`
- Baseline users: `tests/backend/setup/ensure-regression-users.js`

## Audit Trail

- Pre-fix full regression:
  - log: `tests/backend/artifacts/results/module-regression-rerun-20260424-170012.log`
  - json: `tests/backend/artifacts/results/module-regression-20260424-170022.json`
  - status: `FAILED_HARNESS`
  - result: `1141 PASS / 3 FAIL`, `24/25` modules passed
  - failing suite: `module.finance-survival-alerts.ps1`
  - failing assertions:
    - `DSO was not greater than DPO`
    - `Cashflow status missing`
    - `Missing DPO_LESS_THAN_DSO alert`
- Focused suite rerun after fix:
  - log: `tests/backend/artifacts/results/module.finance-survival-alerts-rerun-20260424-172136.log`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - result: `18 PASS / 0 FAIL`
- Post-fix full regression:
  - log: `tests/backend/artifacts/results/module-regression-rerun-20260424-172224.log`
  - json: `tests/backend/artifacts/results/module-regression-20260424-172235.json`
  - status: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - result: `1145 PASS / 0 FAIL`, `25/25` modules passed

## Root Cause

- `module.finance-survival-alerts.ps1` Phase 1 drives `GET /finance/cashflow-health`.
- Scenario helper `backend/scripts/test-scenario-4-finance-health.js` seeded `agentQuote`, but the current `cashflow-health` implementation computes `dso` from `AgentReceivableService.getCashflowSummary()`, which reads `ordertest2.agentPaidAmount`.
- On a clean isolated DB, Scenario 1 returned:
  - `dso=0`
  - `dpo=2.1`
  - `status=safe`
  - `alerts=[]`
- Probe confirmation on the same isolated setup showed that setting `agentPaidAmount=6_900_000` changed the payload to:
  - `dso=6.9`
  - `dpo=2.1`
  - `status=warning`
  - `alerts[0].code=DPO_LESS_THAN_DSO`

## Fix

- File changed: `backend/scripts/test-scenario-4-finance-health.js`
- Action:
  - Seeded `agentPaidAmount: 6_900_000` in `setupScenario1`.
  - Kept assertions unchanged.
  - Kept teardown boundary unchanged because the scenario still owns only its tagged `ordertest2` fixture and related support entities.

## Cases Executed

- `module.finance-survival-alerts.ps1`
  - pre-fix: `14 PASS / 3 FAIL`
  - post-fix: `18 PASS / 0 FAIL`
- `run-backend-module-regression.ps1`
  - pre-fix: `1141 PASS / 3 FAIL`
  - post-fix: `1145 PASS / 0 FAIL`

## Open Risks

- `backend/.env` still defaults to `127.0.0.1:27019`, so local QA remains `BLOCKED_ENV` unless `MONGODB_URI` is overridden or the env file is aligned.
- `purchase-orders/:id` malformed `ObjectId` hardening is still an open product-risk note from the previous round; it was not in scope for this closure.
