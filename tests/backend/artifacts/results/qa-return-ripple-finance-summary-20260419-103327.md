# QA Summary - Return Ripple And Finance Follow-up

- Timestamp: `2026-04-19 10:33:27 +07`
- Scope: `E2E-RIPPLE-04` follow-up, `E2E-RIPPLE-05` bank-balance regression, targeted loan repayment probe
- Environments:
  - watcher backend: `http://localhost:3693/api`
  - built backends: `http://localhost:3694/api`, `http://localhost:3695/api`
  - Mongo overrides:
    - `mongodb://127.0.0.1:27017/htxbachgia_finance_impact_20260419_02`
    - `mongodb://127.0.0.1:27017/htxbachgia_finance_repay_20260419_03`
    - `mongodb://127.0.0.1:27017/htxbachgia_finance_suite_20260419_04`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1` with explicit `MONGODB_URI`

## Execution Trail

1. `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-101125.log`
   - Status: `BLOCKED_ENV`
   - Detail: isolated backend was healthy, but regression users had been seeded into the wrong Mongo because `MONGODB_URI` was not yet overridden for the isolated DB; login returned `401`.
2. `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-101341.log`
   - Status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
   - Result: `57 PASS / 0 FAIL`
   - Note: phase `6.4` correctly blocked repayment because `freeCash` was negative, so the historical repay-fail branch was not exercised in this rerun.
3. Pre-fix targeted repayment repro observed before code change
   - Status: `FAILED`
   - Observation: `bankBalance 10000000 -> 10000000` while `totalDebtOutstanding 10000000 -> 9000000` after `POST /api/loan-management/loans/:id/pay`
   - Detail: this reproduced the product bug even after the first `financial-control` fix.
4. `tests/backend/artifacts/results/finance.loan-repay-probe-20260419-102218.txt`
   - Status: `BLOCKED_ENV`
   - Detail: watcher backend on `3693` restarted into a transient module-resolution failure during rebuild, so the probe could not connect.
5. `tests/backend/artifacts/results/finance.loan-repay-probe-20260419-102524.txt`
   - Status: `FAILED -> FIXED_PRODUCT -> PASSED`
   - Result:
     - `bankBalance 5000000 -> 4000000`
     - `totalDebtOutstanding 5000000 -> 4000000`
6. `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-102708.log`
   - Status: `PASSED`
   - Result: `57 PASS / 0 FAIL`
7. `tests/backend/artifacts/results/e2e.return-ripple-rerun-20260419-103104.log`
   - Status: `PASSED`
   - Result: `64 PASS / 0 FAIL`

## Bugs Found

1. `financial-control` could report stale or incorrect `bankBalance` after cost mutations because it preferred `bank_account.availableBalance` snapshots over the master ledger path.
2. `calculateMasterBankBalance()` did not subtract repayments created through `loan-management/pay`; debt dropped, but bank balance did not.
3. Isolated auth-dependent reruns can be `BLOCKED_ENV` if regression users are seeded without overriding `MONGODB_URI`.

## Fixes Applied

1. `backend/src/finance/financial-control.service.ts`
   - `getBankBalance()` now returns the master-ledger calculation path immediately.
2. `backend/src/finance/finance.service.ts`
   - `calculateMasterBankBalance()` now subtracts loan repayment from `loan_contract.totalPrincipalPaid` and `loan_contract.totalInterestPaid`, which covers both scheduled repayment effects and `loan-management/pay`.

## Regression Outcome

- `e2e.order-finance-impact.ps1`: `PASSED`, `57 PASS / 0 FAIL`
- `finance.loan-repay-probe`: `FAILED -> FIXED_PRODUCT -> PASSED`
- `e2e.return-ripple.ps1`: `PASSED`, `64 PASS / 0 FAIL`

## Open Risks

- `backend/.env` still points to Mongo port `27019` while live QA rounds use `27017`; isolated runs still require explicit `MONGODB_URI`.
- watcher-based `start:dev` remained less stable than a built backend process during rebuild-heavy verification.
- Remaining catalog gaps after this round: `DB-05`, `DB-06`, `E2E-RIPPLE-06`, `LOAD-*`.
