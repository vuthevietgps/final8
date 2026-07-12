# Owner-Fund Ledger Fix Summary

- Timestamp: `2026-04-24 22:54:25 +07`
- Scope: reproduce missing ledger/history for owner withdrawals, fix root cause in `owner-fund.service.ts`, rerun owner-fund, concurrency, finance/funds, and full canonical module regression.

## Product failure reproduced

- Suite: `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
- Baseline status: `FAILED_PRODUCT`
- Evidence log: `tests/backend/artifacts/results/module.owner-fund-loan-ledger-rerun-20260424-223653.log`
- Actual failures:
  - completed withdrawal missing from owner transaction history
  - owner transaction history `summary.totalOut=0`
  - `fund-summary.summary.totalOut=0`
- Interpretation:
  - withdrawal approval/complete changed owner money state (`totalWithdrawn`, `availableBalance`) but the owner-fund ledger APIs still saw no matching `fund_transactions` row

## Root-cause fix

- File: `backend/src/owner-fund/owner-fund.service.ts`
- Fixes applied:
  - `approveWithdrawal()` now creates exactly one `FundTransaction` inside the same transaction that marks the withdrawal approved and debits owner balance
  - the ledger row is linked by `referenceId=withdrawalId`, `referenceType='withdrawal'`, mapped to the correct withdrawal category
  - `completeWithdrawal()` only updates the linked ledger reference metadata when a final bank transaction reference is supplied; it does not create a second money-out row
  - approval now emits `OWNER_FUND_CHANGED` after the transaction commits so finance/funds caches invalidate on the real money-out transition

## Same-round test results

- `backend npm run build`
  - `PASSED`
- `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
  - `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - baseline log: `tests/backend/artifacts/results/module.owner-fund-loan-ledger-rerun-20260424-223653.log`
  - rerun log: `tests/backend/artifacts/results/module.owner-fund-loan-ledgerfix-rerun-20260424-224104.log`
  - final result: `67 PASS / 0 FAIL`
- `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`
  - `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - same-round harness issue: singleton collection from owner transaction history was unwrapped by PowerShell helper, hiding `.Count` for one ledger row
  - failed log: `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260424-224135.log`
  - rerun log: `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260424-224220.log`
  - final result: `67 PASS / 0 FAIL`
  - verified exact-once ledger rows for:
    - approve vs approve
    - approve vs reject
    - approve vs cancel
- `tests/backend/suites/modules/core/module.finance-control-funds.ps1`
  - `FAILED_HARNESS_ENV -> FIXED_HARNESS_ENV -> PASSED`
  - first ad hoc isolated backend bootstrap failed because `dist/main.js` was missing in that shell flow
  - rerun log: `tests/backend/artifacts/results/module.finance-control-funds-ownerfund-rerun-20260424-224617.log`
  - final result: `40 PASS / 0 FAIL`
- `powershell -ExecutionPolicy Bypass -File .\\test-all-modules.ps1`
  - `PASSED`
  - canonical full regression: `1186 PASS / 0 FAIL / 0 BLOCKED`, `25/25` suites
  - JSON: `tests/backend/artifacts/results/module-regression-20260424-224736.json`
  - latest pointer: `tests/backend/artifacts/results/module-regression-latest.json`

## Open risks

- Pre-existing `approved/completed` withdrawals created before this fix still need a separate backfill/migration if ledger/history parity is required historically.
- The current round fixed fresh-path correctness and exact-once race behavior; it did not fabricate legacy ledger rows.

## Files updated in this round

- `backend/src/owner-fund/owner-fund.service.ts`
- `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
- `tests/backend/suites/e2e-flows/e2e.concurrent-finance-ripple.ps1`
- `tests/backend/README.md`
- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/suites/suite-index.md`
