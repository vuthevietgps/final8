# QA Summary - Order Update Ripple Closure

- Timestamp: `2026-04-19 11:36:29 +07`
- Scope: `E2E-RIPPLE-06` order-update Excel ripple, plus finance-control and reports regression guards
- Environment:
  - isolated backend: `http://localhost:3699/api`
  - health: `http://localhost:3699/health`
  - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_e2e_order_update_20260419_04`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1` with explicit `MONGODB_URI`

## Executed Cases

- `tests/backend/suites/e2e-flows/e2e.order-update-ripple.ps1`
  - audit trail:
    - `e2e.order-update-ripple-rerun-20260419-104930.log`: `FAILED_HARNESS`
    - `e2e.order-update-ripple-rerun-20260419-110022.log`: `FAILED_HARNESS`
    - `e2e.order-update-ripple-rerun-20260419-110102.log`: `FAILED_PRODUCT`
    - `e2e.order-update-ripple-rerun-20260419-110248.log`: `FAILED_PRODUCT`
    - `e2e.order-update-ripple-rerun-20260419-110332.log`: `FAILED_PRODUCT -> FAILED_EXPECTATION`
    - `e2e.order-update-ripple-rerun-20260419-113126.log`: `FAILED -> FIXED_PRODUCT -> FIXED_EXPECTATION -> PASSED`, `72 PASS / 0 FAIL`
  - validated:
    - preview/check/apply against real uploaded workbook
    - leading-zero tracking normalization
    - order payment ripple
    - daily report ripple
    - pending supplier / pending agent ripple
    - financial-control dashboard monthlyBurn ripple
    - partial update preservation
    - schema-valid but business-invalid workbook stays error
- `tests/backend/suites/e2e-flows/e2e.order-finance-impact.ps1`
  - `e2e.order-finance-impact-rerun-20260419-113147.log`
  - result: `PASSED`, `57 PASS / 0 FAIL`
- `tests/backend/suites/modules/core/module.finance-control-funds.ps1`
  - `module.finance-control-funds-rerun-20260419-113545.log`
  - result: `PASSED`, `40 PASS / 0 FAIL`
- `tests/backend/suites/modules/core/module.reports-products-config.ps1`
  - `module.reports-products-config-rerun-20260419-113552.log`
  - result: `PASSED`, `41 PASS / 0 FAIL`

## Bugs Found

- `OU-RIPPLE-01`
  - symptom: Excel apply updated order fields but skipped canonical payment/profit/report/dashboard ripple
  - reproduce: run `e2e.order-update-ripple.ps1`, apply valid workbook, then verify `supplierPaymentStatus`, `agentPaymentStatus`, `agentPaidAmount`, daily report, and dashboard
  - root cause: `backend/src/order-update/order-update.service.ts` used raw `updateMany()` and bypassed `TestOrder2Service.update()`
- `AGENT-SNAPSHOT-01`
  - symptom: `financial-control.monthlyBurn` increased only by supplier pending amount, not supplier + agent ripple
  - reproduce: same valid workbook run after `OU-RIPPLE-01` fix, then compare dashboard delta vs pending supplier + pending agent totals
  - root cause: `backend/src/agent-receivable/agent-receivable.service.ts#getCashflowSummary()` used legacy aggregate logic instead of canonical `agentPaidAmount` / `agentPaymentStatus`
- `TEST-DRIFT-OU-01`
  - symptom: suite expected gross profit omitted `returnFee`, while product formula legitimately included it
  - reproduce: compare order gross profit after valid workbook against order formula with supplier quote `returnFee=25000`
  - root cause: suite fixture kept implicit return-fee expectation instead of explicit `returnFee=25000`

## Fixes Applied

- `backend/src/order-update/order-update.service.ts`
  - replaced raw `updateMany()` apply path with per-order canonical `TestOrder2Service.update()`
- `backend/src/agent-receivable/agent-receivable.service.ts`
  - `getCashflowSummary()` now reads:
    - `COMPLETED_ORDER_STATUSES`
    - `RETURN_ORDER_STATUSES`
    - `agentPaidAmount`
    - `agentPaymentStatus`
  - due/byAgent/clawback aggregates now align with canonical order payment state
- `tests/backend/suites/e2e-flows/e2e.order-update-ripple.ps1`
  - fixture and expected gross-profit path now keep explicit `returnFee=25000`

## Environment Audit

- `tmp-order-update-backend-3698-20260419.stderr.log`
  - status: `BLOCKED_ENV`
  - issue: background PowerShell start command lost inline `$env:` assignments and fell back to `3000`, causing `EADDRINUSE`
- final isolate used for verdict:
  - backend `3699`
  - clean DB `htxbachgia_e2e_order_update_20260419_04`

## Docs Updated

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks / Next Steps

- Open gaps remaining: `DB-05`, `DB-06`, `LOAD-*`
- Environment discipline still required: always pin `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `MONGODB_URI`, and `PORT` when local `3000` is occupied
- Most reasonable next step: expand `module.db-consistency.ps1` for `DB-05`, then add the `DB-06` seed/cleanup safety checklist without reducing data volume or cleanup guards
