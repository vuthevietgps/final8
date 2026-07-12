# Backend Test Scenario Matrix

Tai lieu nay tach rieng khoi `backend-test-plan.md` de phuc vu 3 viec:

- phan loai scenario theo muc do uu tien `P0..P3`
- gan trang thai `active_automated`, `planned`, `blocked_runtime`, `manual`
- map scenario vao suite hien co hoac suite backlog can tao

## Legend

### Priority

- `P0`: release gate, fail la dung deploy
- `P1`: rui ro nghiep vu / tai chinh cao
- `P2`: mo rong coverage, resilience, boundary
- `P3`: deep diagnostics, soak, exploratory, long-run

### Status

- `active_automated`: da co suite file active bao phu mot phan dang ke
- `planned`: da xac nhan can test, chua co suite rieng hoac chua du coverage
- `blocked_runtime`: co source/controller nhung runtime hien tai chua expose/wire
- `manual`: nen co checklist/harness rieng, chua phu hop day vao regression moi lan

## Current Execution Snapshot

- Targeted verification timestamp: `2026-04-25 11:16:11 +07`
- Targeted owner-fund ObjectId normalization results:
  - `tests/backend/artifacts/results/module.owner-fund-objectid-normalize-direct-run-20260425-000805.err.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/module.owner-fund-objectid-normalize-direct-run-20260425-000902.out.log`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - `tests/backend/artifacts/results/module.owner-fund-objectid-normalize-rerun-20260425-001052.out.log`: `PASSED`
  - `tests/backend/artifacts/results/module.owner-fund-objectid-normalize-deleteguard-rerun-20260425-001836.out.log`: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`, `43 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.owner-fund-loan-cleanupfix-rerun-20260425-002706.out.log`: `PASSED`, `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.finance-control-funds-objectidguard-rerun-20260425-001924.out.log`: `PASSED`, `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-objectidguard-rerun-20260425-001924.out.log`: `PASSED`, `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module-regression-20260425-002807.json`: `PASSED`, `1254 PASS / 0 FAIL / 0 BLOCKED`, `27/27` suites
  - `tests/backend/artifacts/results/owner-fund-objectid-normalize-dryrun-real-20260425-001107.json`: `FAILED_PRODUCT`, `98` convertible refs (`40` `withdrawals.ownerId`, `29` `withdrawals.approvedBy`, `11` `fund_transactions.ownerId`, `18` `fund_transactions.createdBy`)
  - `tests/backend/artifacts/results/owner-fund-objectid-normalize-apply-real-20260425-001132.json`: `FAILED_PRODUCT -> FIXED_PRODUCT`, `98` refs updated
  - `tests/backend/artifacts/results/owner-fund-objectid-normalize-verify-real-20260425-001143.json`: `PASSED`, `0` convertible refs remain
  - `tests/backend/artifacts/results/owner-fund-delete-guard-repro-pass-20260425-003420.json`: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - `tests/backend/artifacts/results/owner-fund-orphan-owner-audit-real-20260425-111459.json`: `FAILED_PRODUCT`, `15` orphan owner refs, `37` orphan withdrawals, `26` orphan fund transactions
- Targeted runtime note:
  - `BE-OWN-06` is now active and covers mixed BSON owner-fund normalization plus the owner delete guard that blocks deleting an owner with existing financial history
  - the same-round full regression stayed green at `27/27`, so the owner-fund normalization and delete-guard closure did not reopen finance, cashflow, or concurrency regressions
  - the remaining real-QA orphan-owner issue is historical identity loss, not a surviving type-normalization bug; the safe path is read-only audit until an authoritative restore source exists
- Detailed trace:
  - `tests/backend/artifacts/results/qa-owner-fund-objectid-normalize-summary-20260425-111459.md`
- Targeted verification timestamp: `2026-04-24 23:43:45 +07`
- Targeted owner-fund historical results:
  - `tests/backend/artifacts/results/module.owner-fund-ledger-reconcile-rerun-20260424-231537.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/module.owner-fund-ledger-reconcile-rerun-20260424-231811.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/module.owner-fund-ledger-reconcile-rerun-20260424-233235.log`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, `26 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.owner-fund-loan-rerun-20260424-233410.log`: `PASSED`, `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.finance-control-funds-rerun-20260424-233410.log`: `PASSED`, `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-rerun-20260424-233410.log`: `PASSED`, `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module-regression-20260424-233705.json`: `PASSED`, `1212 PASS / 0 FAIL / 0 BLOCKED`, `26/26` suites
  - `tests/backend/artifacts/results/owner-fund-ledger-reconcile-dryrun-real-20260424-234202.json`: `FAILED_PRODUCT`, `18` anomalies / `55,840,000` missing amount
  - `tests/backend/artifacts/results/owner-fund-ledger-reconcile-apply-real-20260424-234211.json`: `FAILED_PRODUCT -> FIXED_PRODUCT`, `18` inserted
  - `tests/backend/artifacts/results/owner-fund-ledger-reconcile-verify-real-20260424-234218.json`: `PASSED`, `0` anomalies
- Targeted runtime note:
  - owner-fund historical reconcile closed a deeper root cause than fresh-path ledger creation: owner-fund `ObjectId` decorator metadata had compiled as Mongoose `Mixed`, so legacy/live rows used string `ownerId` while reconcile/backfill rows used `ObjectId`
  - owner-scoped owner-fund reads now match by stringified `ownerId`, and the reconcile script reconstructs owner history with the same mixed-type tolerance
  - `BE-OWN-05` is now active and covers historical owner-withdrawal backfill + idempotence, while the same-round real QA DB repair proved the path on `htxbachgia`
- Detailed trace:
  - `tests/backend/artifacts/results/qa-owner-fund-historical-reconcile-summary-20260424-234345.md`
- Targeted verification timestamp: `2026-04-24 22:54:25 +07`
- Targeted owner-fund results:
  - `tests/backend/artifacts/results/module.owner-fund-loan-ledger-rerun-20260424-223653.log`: `FAILED_PRODUCT`, `45 PASS / 3 FAIL`
  - `tests/backend/artifacts/results/module.owner-fund-loan-ledgerfix-rerun-20260424-224104.log`: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`, `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260424-224135.log`: `FAILED_HARNESS`, `61 PASS / 3 FAIL`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-run-20260424-224220.log`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, `67 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module.finance-control-funds-ownerfund-rerun-20260424-224617.log`: `FAILED_HARNESS_ENV -> FIXED_HARNESS_ENV -> PASSED`, `40 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/module-regression-20260424-224736.json`: `PASSED`, `1186 PASS / 0 FAIL / 0 BLOCKED`, `25/25` suites
- Targeted runtime note:
  - baseline owner-fund module failure was a real product signal: approved/completed withdrawals changed owner money state but did not appear in owner transaction history or `fund-summary.summary.totalOut`
  - `OwnerFundService.approveWithdrawal()` now writes exactly one linked `FundTransaction` in the same transaction, `completeWithdrawal()` only updates linked reference metadata, and owner-fund approval emits `OWNER_FUND_CHANGED` after commit for finance/funds refresh
  - `CON-07` now verifies exact-once ledger rows for approve-vs-approve, approve-vs-reject, and approve-vs-cancel; rejected/cancelled terminal outcomes must leave zero withdrawal ledger rows
  - the only same-round non-product red after the service fix was a PowerShell singleton collection unwrap in the E2E helper; it was fixed before the final pass and is preserved as `FAILED_HARNESS`
- Detailed trace:
  - `tests/backend/artifacts/results/qa-owner-fund-ledger-fix-summary-20260424-225425.md`

- Targeted verification timestamp: `2026-04-24 22:13:08 +07`
- Targeted perf results:
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260424-215242.json`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260424-220622.json`: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - `tests/backend/artifacts/results/module-regression-20260424-220747.json`: `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, `25/25` suites
- Targeted runtime note:
  - the valid-contract local control stayed red before the fix, so this round treated `LOAD-03` as a real product signal rather than a runtime-contract artifact
  - `OrderCalculationService.recalculateOrdersForDate()` now drains same-day recalculation through a per-day single-flight loop instead of launching overlapping duplicate recalculations
  - `FinanceEventListenerService` now coalesces `ops`, `agent`, and `supplier` snapshot refresh bursts per domain, which removed the cross-scenario DB storm seen under concurrent payment/return/other-cost traffic
  - canonical post-fix ripple regression stayed green on isolated backend `http://localhost:50896/api`
- Detailed trace:
  - `tests/backend/artifacts/results/qa-load03-product-fix-summary-20260424-221308.md`

- Targeted verification timestamp: `2026-04-24 21:26:01 +07`
- Targeted perf results:
  - `tests/backend/artifacts/results/run-load03-write-contention-fix3-20260424-210944.log` + `tests/backend/artifacts/results/perf.write-contention-summary-runtime-manifest-20260424-210953.json`: `FAILED_HARNESS`
  - `tests/backend/runners/run-backend-perf-write-contention.ps1` first local bootstrap invocation: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260424-212539.json`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
- Targeted runtime note:
  - stale backend collision audit: runtime manifest/state claimed DB `htxbachgia_load03_fix3_20260424210944`, but fixture order `69eb79b73303fa63856acae5` existed only in `htxbachgia_load03_fix_step_20260424210049`; `http://localhost:62922/api` was serving the wrong live backend
  - local bootstrap runner now starts a dedicated backend on `http://localhost:64646/api`, health `http://localhost:64646/health`, Mongo `mongodb://127.0.0.1:27017/htxbachgia_load03_local_20260424212450`, and shared media root `tests/backend/artifacts/results/tmp-load03-local-media-20260424212450`
  - clean isolated rerun reproduced no backend product defect; this round closed a harness class, not a product regression
- Detailed trace:
  - `tests/backend/artifacts/results/qa-load03-local-bootstrap-summary-20260424-212601.md`
- Previous cross-shell/container module-runner closure remains traceable at:
  - `tests/backend/artifacts/results/qa-runtime-manifest-summary-20260424-201107.md`

- Verified activation timestamp: `2026-04-19 14:32:36 +07`
- `perf.write-contention.k6.js` result: `120` iterations, `293` HTTP requests, `PASS / 0 FAIL`
- Detailed trace:
  - latest harness re-verify: `tests/backend/artifacts/results/qa-load03-local-bootstrap-summary-20260424-212601.md`
  - historical product-fix baseline: `tests/backend/artifacts/results/qa-write-contention-summary-20260419-143957.md`
- Activation note:
  - owner withdrawal approval no longer allows two concurrent winners on the same pending withdrawal
  - return resolve now rejects duplicate races earlier and stays inside the `LOAD-03` latency budget without recomputing quote snapshots
  - active write-contention harness now keeps real write pressure on supplier payment batch, agent payment batch, owner withdrawal approve, return resolve, and other-cost confirm
- Latest harness re-verification timestamp: `2026-04-24 21:26:01 +07`
- Latest harness re-verification result:
  - `perf.write-contention.k6.js`: `FAILED_HARNESS (stale backend collision) -> FAILED_HARNESS (local wrapper arg binding) -> FIXED_HARNESS -> PASSED`
  - dedicated local bootstrap pass: `120` iterations, `293` HTTP requests, `0.00% http_req_failed`, global `p95=1391.47ms`
- Latest harness note:
  - bad `fix3` artifact is now classified as `FAILED_HARNESS`, not product fail, because `62922` served stale `fix_step` backend state while the runtime manifest/state claimed `fix3`
  - no related product regression rerun was required in the `2026-04-24` reverify; the clean isolated rerun reproduced no backend defect
- Verified regression timestamp: `2026-04-19 14:35:20 +07`
- Related regression results:
  - `e2e.concurrent-finance-ripple.ps1`: `40 PASS / 0 FAIL`
  - `module.db-consistency.ps1`: `68 PASS / 0 FAIL`
  - `e2e.return-ripple.ps1`: `64 PASS / 0 FAIL`
- Same-round baseline/fix history kept:
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-141816.json`
    - `FAILED_PRODUCT`
    - owner withdrawal approve race returned `201, 201` on the same withdrawal
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-142358.json`
    - `FAILED_PRODUCT`
    - mixed `return_resolve` contention still failed the latency gate
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-142859.json`
    - `FAILED_PRODUCT`
    - `return_resolve_commit_duration p95=3942ms`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-143119.json`
    - `FAILED_PRODUCT`
    - `return_resolve_commit_duration p95=2525.60ms`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-143236.json`
    - `FAILED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> PASSED`

- Verified activation timestamp: `2026-04-19 13:43:09 +07`
- `perf.spike-public.k6.js` result: `2432 requests`, `2429` iterations, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-spike-public-summary-20260419-134820.md`
- Activation note:
  - `chat-message` webhook idempotency no longer leaks `platformEventKey=null` into Mongo upserts
  - chat-message module init now unsets legacy blank/null platform keys and aligns partial unique indexes for `platformMessageId` and `platformEventKey`
  - active spike harness now keeps real burst coverage on `webhook/messenger`, `advertising-cost-public`, `order-update/preview`, and `test-order2`
- Verified regression timestamp: `2026-04-19 13:46:57 +07`
- Related regression results:
  - `e2e.public-contracts-resilience.ps1`: `61 PASS / 0 FAIL`
  - `module.media-chat-config.ps1`: `33 PASS / 0 FAIL`
- Same-round baseline/fix history kept:
  - `tests/backend/artifacts/results/tmp-spike-public-backend-3696-20260419-133036.err.log`
    - `FAILED_HARNESS/BLOCKED_ENV`
    - first isolate runner collided on port `3696`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-133229.json`
    - `FAILED_PRODUCT`
    - webhook ACK path exposed `chatmessages.platformEventKey=null` duplicate-key pressure
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-134125.json`
    - `FAILED_HARNESS`
    - rerun injected `/api` twice into the harness base URL
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-134309.json`
    - `FAILED_HARNESS/BLOCKED_ENV -> FAILED_PRODUCT -> FAILED_HARNESS -> FIXED_PRODUCT -> PASSED`

- Verified activation timestamp: `2026-04-19 08:11:05 +07`
- `module.db-consistency.ps1` result: `57 assertions`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-db-consistency-summary-20260419-091826.md`
- Activation note:
  - same-day `other-cost` list/summary filters now honor the Bangkok business day for date-only queries
  - same-day Bangkok `dueDate` no longer shifts into yesterday/overdue in `dueByDay7d` or the `ops` snapshot
  - create, confirm, and delete on the boundary row now keep `ops` snapshot and `financial-control` committed cash aligned
- Verified regression timestamp: `2026-04-19 09:13:56 +07`
- Full module regression result: `991 assertions`, `23/23 modules`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-module-regression-summary-20260419-091826.md`
- Same-round baseline/fix history kept:
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-080903.log`
    - `FAILED`
    - `2026-04-19 08:09:03 +07`: `51 PASS / 6 FAIL`, exposing Bangkok date-boundary drift in `other-cost`
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-081105.log`
    - `FAILED -> FIXED_PRODUCT -> PASSED`
    - `57 PASS / 0 FAIL`
  - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-081155.log`
    - `BLOCKED_ENV`
    - default runner hit `http://localhost:3000`, where `/health` returned `404` and auth returned `401/403`
- Related regression note:
  - canonical runner stayed green at `23/23` after rerunning on isolated `http://localhost:3684/api`
  - `module.labor-other-cost.ps1` and `module.finance-control-funds.ps1` both stayed green in the same closure
- Verified activation timestamp: `2026-04-19 04:56:45 +07`
- `module.db-consistency.ps1` result: `32 assertions`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-db-consistency-summary-20260419-045816.md`
- Activation note:
  - `return-request` line items now persist stable `_id` values and reject unknown/partial resolve payloads before mutating request status or inventory
  - deleting a product category that is still referenced now returns `409` and no longer leaves orphan `product.categoryId` values in Mongo
- Verified regression timestamp: `2026-04-19 04:58:16 +07`
- Full module regression result: `966 assertions`, `23/23 modules`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-module-regression-summary-20260419-045816.md`
- Same-round baseline/fix history kept:
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-0453.log`
    - `FAILED_HARNESS -> FIXED_HARNESS -> FAILED -> FIXED_PRODUCT -> PASSED`
    - `2026-04-19 04:53 +07`: `31 PASS / 1 FAIL` after closing parser/login drift and exposing the raw orphan-category bug
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-0456.log`
    - `32 PASS / 0 FAIL`
- Related regression note:
  - canonical runner now includes `module.db-consistency.ps1`
  - `module.reports-products-config.ps1` stayed green in the `23/23` closure after removing the fallback that previously masked missing return item ids
- Verified activation timestamp: `2026-04-19 04:11:09 +07`
- `e2e.concurrent-finance-ripple.ps1` result: `40 assertions`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-concurrent-finance-ripple-summary-20260419-041812.md`
- Activation note:
  - duplicate supplier/agent payment retries no longer overwrite batch metadata or re-pay the same order
  - owner-withdrawal approve race and agent atomic race both close with exactly one winner
- Verified regression timestamp: `2026-04-19 04:18:12 +07`
- Full module regression result: `934 assertions`, `22/22 modules`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-module-regression-summary-20260419-041812.md`
- Same-day failed audit kept:
  - `2026-04-19 04:11:41 +07`
  - full module runner fell back to `http://localhost:3000` without `BACKEND_BASE_URL`, producing `0 PASS / 29 FAIL`
  - artifact: `tests/backend/artifacts/results/module-regression-20260419-041141.json`
- Related reruns in the same round:
  - `e2e.agent-role-payment.ps1`: `FAILED -> FIXED_EXPECTATION -> PASSED`, `46 PASS / 0 FAIL`
  - `e2e.order-finance-impact.ps1`: `FAILED -> FIXED_EXPECTATION -> PASSED`, `56 PASS / 0 FAIL`
  - `module.ads-alerts-kpi.ps1`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, `27 PASS / 0 FAIL`
- Latest finance/return follow-up `2026-04-19 10:31:04 +07`:
  - `e2e.order-finance-impact.ps1`: `BLOCKED_ENV -> FIXED_ENV -> PASSED`, `57 PASS / 0 FAIL`
  - targeted loan repayment probe: `FAILED -> FIXED_PRODUCT -> PASSED`, `bankBalance 5000000 -> 4000000`, `debt 5000000 -> 4000000`
  - `e2e.return-ripple.ps1`: `FAILED -> FIXED_PRODUCT -> PASSED` on activation round, latest rerun `PASSED`, `64 PASS / 0 FAIL`
- Verified activation timestamp: `2026-04-19 03:24:15 +07`
- `e2e.public-contracts-resilience.ps1` result: `61 assertions`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-public-contracts-resilience-summary-20260419-032552.md`
- Activation note: `chat-message` image send outside 24h no longer bypasses the 24h gate, and `/api/media/serve/...` alias parity is now enforced by explicit runtime routing.
- Verified regression timestamp: `2026-04-19 03:25:52 +07`
- Full module regression result: `935 assertions`, `22/22 modules`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-module-regression-summary-20260419-032552.md`
- Related rerun: `module.media-chat-config.ps1` closed `33 PASS / 0 FAIL`
- Verified regression timestamp: `2026-04-19 02:37:52 +07`
- Full module regression result: `934 assertions`, `22/22 modules`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-module-regression-summary-20260419-023752.md`
- Active catalog note: `module.order-sheet-sync-ops.ps1` is now in the active tree and covers `BE-OPS-04/05/06`; clean-DB harness false fails in `module.owner-fund-loan.ps1` and `module.ads-alerts-kpi.ps1` were closed in the same round.
- Verified regression timestamp: `2026-04-19 01:59:22 +07`
- Full module regression result: `879 assertions`, `21/21 modules`, `PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-module-regression-summary-20260419-015922.md`
- Active catalog note: `module.user-import-export.ps1` and `module.api-token-timezone.ps1` are now in the active tree and cover `BE-MASTER-04/05/06` plus `BE-ADS-05/06`.
- Verified regression timestamp: `2026-04-19 00:54:12 +07`
- Full module regression result: `825 PASS / 0 FAIL`
- Detailed trace: `tests/backend/artifacts/results/qa-module-regression-summary-20260419-005412.md`
- Same-day failed baseline kept for audit:
  - `2026-04-19 00:21:55 +07`
  - `766 PASS / 17 FAIL`
  - `tests/backend/artifacts/results/module-regression-20260419-002155.json`
- Same-day targeted rerun after fixes:
  - `2026-04-19 00:35:03 +07`
  - `TARGETED_RERUN_PASSED=5/5`
  - `tests/backend/artifacts/results/targeted-fail-suite-rerun-20260419-003503.log`
- Latest targeted auth verification round: `2026-04-19 00:09:19 +07`
- Latest targeted auth result: `60 PASS / 0 FAIL`
- Latest auth trace: `tests/backend/artifacts/results/qa-auth-regression-summary-20260419-000919.md`
- Environment note:
  - local QA Mongo service for this round ran on `127.0.0.1:27017` (`rs0`)
  - run used `MONGODB_URI` override because `backend/.env` still points to `127.0.0.1:27019`
- Previous targeted auth activation round: `2026-04-15 07:42:39 +07`
- Previous targeted auth result: `68 PASS / 0 FAIL`
- Previous detailed auth trace: `tests/backend/artifacts/results/qa-auth-hardening-summary-20260415-074300.md`
- Previous blocked snapshot kept for history: `tests/backend/artifacts/results/qa-regression-summary-20260415-002059.md`

| Scenario ID | Active suite | Latest execution | Note |
|---|---|---|---|
| `BE-OWN-01` | `module.owner-fund-loan.ps1` | `PASSED` | Latest rerun `2026-04-24 22:41 +07`: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`; approved/completed owner withdrawals now appear exactly once in owner transaction history, and history/fund summary `totalOut` includes the committed money-out row |
| `BE-OWN-02` | `module.owner-fund-loan.ps1` + `e2e.concurrent-finance-ripple.ps1` | `PASSED` | Latest rerun `2026-04-24 22:42 +07`: module closure fixed fresh-path approve/complete ledger visibility, and `CON-07` kept zero ledger leaks for reject/cancel while preserving exactly one ledger row for the winning approved terminal path |
| `BE-OWN-03` | `module.owner-fund-loan.ps1` | `PASSED` | Latest rerun `2026-04-19 02:46 +07`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED` after treating valid empty `GET /finance/available-funds` snapshot lists as passable contract responses on clean DB; full regression `934 PASS / 0 FAIL` confirmed no owner-fund or finance ripple |
| `BE-OWN-05` | `module.owner-fund-ledger-reconcile.ps1` | `PASSED` | Latest activation/rerun `2026-04-24 23:33 +07`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, `26 PASS / 0 FAIL`; same-round real QA DB dry-run/apply/verify closed `18` missing historical withdrawal ledger rows totaling `55,840,000` |
| `BE-OWN-06` | `module.owner-fund-objectid-normalize.ps1` | `PASSED` | Latest rerun `2026-04-25 00:18 +07`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, then same-round delete-guard hardening closed `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED` at `43 PASS / 0 FAIL`; real QA DB dry-run found `98` convertible refs, apply updated `98`, verify found `0` remaining convertible refs |
| `BE-OWN-07` | `backend/scripts/audit-owner-fund-orphan-owners.js` + `backend/scripts/cleanup-owner-fund-orphan-fixtures.js` + `module.owner-fund-orphan-fixture-cleanup.ps1` | `PASSED` | Latest manual-governed real QA DB closure `2026-04-25 11:56 +07`: `FAILED_PRODUCT -> FIXED_DATA -> PASSED`; pre-audit found `15` orphan owner refs across `37` withdrawal docs and `26` fund transactions, dry-run classified `15` eligible exact fixture clusters (`11` `module.owner-fund-loan`, `4` `synthetic.emergency-owner-fund`) with `0` blocked / `0` unknown, apply deleted `63` docs, serial verify returned `0` orphans, and idempotent re-apply deleted `0`; helper remains snapshot-scoped/manual and does not prove provenance of the `synthetic.emergency-owner-fund` family to any current active suite |
| `BE-SMOKE-03` | `e2e.public-contracts-resilience.ps1` | `PASSED` | Activation round `2026-04-19 03:24:15 +07`: `FAILED_HARNESS -> FIXED_HARNESS -> FIXED_PRODUCT -> PASSED` at `61 PASS / 0 FAIL`; public `/health`, `/api/health/db`, webhook, advertising-cost-public, media aliases, and protected `/api/media` boundary stayed green |
| `BE-MEDIA-03` | `e2e.public-contracts-resilience.ps1` | `PASSED` | `/api/media/serve/...` alias parity, encoded traversal `403`, and DB fallback were verified after explicit runtime route fix in `backend/src/media/media.controller.ts`; related `module.media-chat-config.ps1` rerun stayed green at `33 PASS / 0 FAIL` |
| `BE-CHAT-03` | `e2e.public-contracts-resilience.ps1` | `PASSED` | Image URL and multipart send paths no longer bypass the 24h gate when `FB_SENDING_ENABLED=0`; manual reproduce changed from `TEXT=400 / IMAGE=201` to `TEXT=400 / IMAGE=400` before final suite pass |
| `BE-PUB-01` | `e2e.public-contracts-resilience.ps1` | `PASSED` | `advertising-cost-public/yesterday-spent` stayed public and stable for both empty and seeded datasets |
| `BE-PUB-02` | `e2e.public-contracts-resilience.ps1` | `PASSED` | `MESSENGER_VERIFY_TOKEN`, dev fallback token, `PUBLIC_ORIGIN`, and `APP_PUBLIC_ORIGIN` bootstrap/env precedence were verified on dual isolated backends |
| `BE-PUB-03` | `e2e.public-contracts-resilience.ps1` | `PASSED` | Supplier statement public PDF returned `401` for missing/invalid/expired token and `200` HTML for valid JWT |
| `BE-PUB-04` | `e2e.public-contracts-resilience.ps1` | `PASSED` | Deprecated `google-sync/cred-check` contract kept explicit `DEPRECATED` status and replacement pointers |
| `BE-OPS-04` | `module.order-sheet-sync-ops.ps1` | `PASSED` | Activation round `2026-04-19 02:28 +07`: `FAILED -> FIXED_HARNESS -> FIXED_PRODUCT -> PASSED` after `syncAllAgents()` stopped counting inner `success=false` results as success; full regression `934 PASS / 0 FAIL` stayed green |
| `BE-OPS-05` | `module.order-sheet-sync-ops.ps1` | `PASSED` | Latest rerun verified status/diff/error handling for `order-sheet-sync` plus malformed credentials payloads and permission boundaries |
| `BE-OPS-06` | `module.order-sheet-sync-ops.ps1` | `PASSED` | Latest rerun verified emergency overdue tasks, bulk-sync diff semantics, verification-failed alert surfacing, and cleanup on isolated Mongo DB |
| `BE-PAY-02` | `module.labor-other-cost.ps1` | `PASSED` | Suite drift fixed by removing fixed-period collision in labor statement setup |
| `BE-SUP-01` | `module.agent-supplier-quotes.ps1` | `PASSED` | Latest rerun `2026-04-19`: `FAILED -> FIXED -> PASSED` after idempotent category/product reuse and duplicate-key contract hardening in `product-category` |
| `BE-SUP-02` | `module.supply-chain.ps1` | `PASSED` | Latest rerun `2026-04-24 18:38:59 +07`: `28 PASS / 0 FAIL` on isolated backend after purchase ObjectId contract hardening; prior env-sensitive direct invocation still remains documented as `BLOCKED_ENV` |
| `BE-SUP-03` | `module.supply-chain.ps1` | `PASSED` | Latest rerun `2026-04-24 18:38:59 +07`: supplier handoff and receivable/payable summaries stayed green after purchase `price-history` and malformed-id contract fixes |
| `BE-SUP-04` | `module.purchase-inventory.ps1` | `PASSED` | Latest rerun `2026-04-24 18:29:22 +07`: `84 PASS / 0 FAIL` activation baseline expanded to `101 PASS / 0 FAIL` after `purchase-orders/:id` + `supplierId` malformed/missing contract coverage; product fix lives in `backend/src/purchase/purchase-order.service.ts` |
| `BE-SUP-05` | `e2e.concurrent-finance-ripple.ps1` | `PASSED` | Latest rerun `2026-04-19 04:11:09 +07`: duplicate supplier and agent payment retries now reject the second batch and preserve the first `paidAt` / batch-id metadata after `backend/src/test-order2/services/order-payment.service.ts` hardening |
| `BE-RET-02` | `module.reports-products-config.ps1` | `PASSED` | Latest rerun `2026-04-19`: `FAILED -> FIXED -> PASSED` after pending-order approval created or reused a fallback product fixture instead of depending on ambient catalog data |
| `BE-AUTH-05` | `module.auth-hardening.ps1` | `PASSED` | Latest rerun `2026-04-19`: `FAILED -> FIXED_HARNESS_ENV -> FIXED_CLEANUP -> PASSED` after quoting `cmd set` env values, trimming `AUTH_ENABLE_IP_RESTRICTION`, and cleaning up the real `3100` listener PID |
| `BE-AUTH-06` | `module.auth-hardening.ps1` | `PASSED` | Latest rerun `2026-04-19`: manager without `allowedLoginIps` now returns `401`, disallowed `X-Forwarded-For` returns `401`, and allowed forwarded chain still succeeds under explicit IP restriction |
| `CON-05` | `e2e.concurrent-finance-ripple.ps1` | `PASSED` | Supplier payment retry is now idempotent: baseline `34 PASS / 6 FAIL` became `40 PASS / 0 FAIL` after duplicate batch guards and atomic eligible-order filters were added |
| `CON-06` | `e2e.concurrent-finance-ripple.ps1` | `PASSED` | Agent payment retry is now idempotent and the atomic race still closes with `success=1 / failure=1`; related external-agent commission suites were re-baselined to the current product rule |
| `CON-07` | `e2e.concurrent-finance-ripple.ps1` | `PASSED` | Latest rerun `2026-04-24 22:42 +07`: same-round ledger exact-once hardening closed `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`; approve-vs-approve, approve-vs-reject, and approve-vs-cancel all finished with one committed terminal winner, coherent balance/approval metadata, exactly one ledger row for the winning approved path, and zero ledger rows for rejected/cancelled terminal paths |
| `CON-10` | `e2e.concurrent-finance-ripple.ps1` | `PASSED` | Post-ripple reconciliation now verifies paid statuses and batch metadata remain stable after retry/race paths |
| `CON-08` | `module.db-consistency.ps1` | `active_automated` | Latest activation `2026-04-19 04:56:45 +07`: invalid `itemId` resolve now returns `400`, request stays `pending`, and inventory remains unchanged until a valid resolve commits |
| `CON-09` | `module.db-consistency.ps1` | `active_automated` | Latest rerun `2026-04-24 16:27:12 +07`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED` on the same shared DB after replacing clean-DB absolute totals with baseline-aware delta assertions for `other-cost` Bangkok boundary ripple |

## Release Gate Matrix

| Scenario ID | Priority | Status | Target suite |
|---|---|---|---|
| `BE-SMOKE-01` | P0 | `active_automated` | `module.auth-rbac.ps1` + future `smoke.public-contracts.ps1` |
| `BE-SMOKE-02` | P0 | `active_automated` | `module.auth-rbac.ps1` |
| `BE-SMOKE-03` | P0 | `active_automated` | `e2e.public-contracts-resilience.ps1` |
| `BE-AUTH-01` | P0 | `active_automated` | `module.auth-rbac.ps1` |
| `BE-AUTH-02` | P0 | `active_automated` | `module.auth-rbac.ps1` |
| `BE-AUTH-03` | P0 | `active_automated` | `module.auth-rbac.ps1` |
| `BE-AUTH-04` | P0 | `active_automated` | `module.auth-rbac.ps1` |
| `BE-AUTH-05` | P0 | `active_automated` | `module.auth-hardening.ps1` |
| `BE-AUTH-06` | P0 | `active_automated` | `module.auth-hardening.ps1` |
| `BE-ORD-01` | P0 | `active_automated` | `e2e.order-to-cashflow.ps1` |
| `BE-ORD-02` | P0 | `active_automated` | `e2e.order-finance-impact.ps1` |
| `BE-ORD-03` | P0 | `active_automated` | `e2e.order-to-cashflow.ps1` |
| `BE-ORD-04` | P0 | `active_automated` | `e2e.agent-role-payment.ps1` + `e2e.concurrent-finance-ripple.ps1` |
| `BE-FIN-01` | P0 | `active_automated` | `module.finance-control-funds.ps1` |
| `BE-FIN-02` | P0 | `active_automated` | `module.finance-control-funds.ps1` |
| `BE-FIN-03` | P0 | `active_automated` | `module.finance-control-funds.ps1` |
| `BE-FIN-04` | P0 | `active_automated` | `module.finance-control-funds.ps1` |
| `BE-FIN-05` | P0 | `active_automated` | `module.finance-control-funds.ps1` |
| `CON-01` | P0 | `active_automated` | `e2e.agent-role-payment.ps1` |
| `CON-05` | P0 | `active_automated` | `e2e.concurrent-finance-ripple.ps1` |
| `CON-06` | P0 | `active_automated` | `e2e.concurrent-finance-ripple.ps1` |
| `CON-10` | P0 | `active_automated` | `e2e.concurrent-finance-ripple.ps1` |
| `E2E-RIPPLE-01` | P0 | `active_automated` | `e2e.order-to-cashflow.ps1` + `e2e.order-finance-impact.ps1` |

## High Risk Business Matrix

| Scenario ID | Priority | Status | Target suite |
|---|---|---|---|
| `BE-ADS-01` | P1 | `active_automated` | `module.ad-account-ad-group.ps1` |
| `BE-ADS-02` | P1 | `active_automated` | `module.ads-alerts-kpi.ps1` |
| `BE-ADS-03` | P1 | `active_automated` | `module.net-profit-ad-group.ps1` |
| `BE-ADS-04` | P1 | `active_automated` | `e2e.ads-auto-scale.ps1` |
| `BE-ADS-05` | P1 | `active_automated` | `module.api-token-timezone.ps1` |
| `BE-ADS-06` | P1 | `active_automated` | `module.api-token-timezone.ps1` |
| `BE-OWN-01` | P1 | `active_automated` | `module.owner-fund-loan.ps1` |
| `BE-OWN-02` | P1 | `active_automated` | `module.owner-fund-loan.ps1` + `e2e.concurrent-finance-ripple.ps1` |
| `BE-OWN-03` | P1 | `active_automated` | `module.owner-fund-loan.ps1` |
| `BE-OWN-04` | P1 | `active_automated` | `scenario.05-loan-owner-fund.ps1` |
| `BE-OWN-05` | P1 | `active_automated` | `module.owner-fund-ledger-reconcile.ps1` |
| `BE-OWN-06` | P1 | `active_automated` | `module.owner-fund-objectid-normalize.ps1` |
| `BE-OWN-07` | P1 | `manual` | `backend/scripts/audit-owner-fund-orphan-owners.js` + `backend/scripts/cleanup-owner-fund-orphan-fixtures.js` + `tests/backend/suites/modules/extended/module.owner-fund-orphan-fixture-cleanup.ps1` + future owner-identity restore playbook |
| `BE-PAY-01` | P1 | `active_automated` | `e2e.ops-payroll.ps1` |
| `BE-PAY-02` | P1 | `active_automated` | `module.labor-other-cost.ps1` |
| `BE-SUP-01` | P1 | `active_automated` | `module.agent-supplier-quotes.ps1` |
| `BE-SUP-02` | P1 | `active_automated` | `module.supply-chain.ps1` |
| `BE-SUP-03` | P1 | `active_automated` | `module.supply-chain.ps1` |
| `BE-SUP-04` | P1 | `active_automated` | `tests/backend/suites/modules/extended/module.purchase-inventory.ps1` |
| `BE-SUP-05` | P1 | `active_automated` | `e2e.concurrent-finance-ripple.ps1` |
| `BE-RET-01` | P1 | `active_automated` | `module.return-report-product-rate.ps1` |
| `BE-RET-02` | P1 | `active_automated` | `module.reports-products-config.ps1` + `module.return-report-product-rate.ps1` |
| `CON-07` | P1 | `active_automated` | `e2e.concurrent-finance-ripple.ps1` |
| `CON-08` | P1 | `active_automated` | `module.db-consistency.ps1` |
| `E2E-RIPPLE-02` | P1 | `active_automated` | `e2e.ads-auto-scale.ps1` |
| `E2E-RIPPLE-03` | P1 | `active_automated` | `e2e.ops-payroll.ps1` |
| `E2E-RIPPLE-04` | P1 | `active_automated` | `e2e.return-ripple.ps1` |
| `E2E-RIPPLE-05` | P1 | `active_automated` | `scenario.05-loan-owner-fund.ps1` + `e2e.order-finance-impact.ps1` |
| `E2E-RIPPLE-06` | P1 | `active_automated` | `e2e.order-update-ripple.ps1` |

- Latest activation `2026-04-19 11:35:53 +07`:
  - `e2e.order-update-ripple.ps1`: `FAILED_HARNESS -> FIXED_HARNESS -> FAILED_PRODUCT -> FIXED_PRODUCT -> FIXED_EXPECTATION -> PASSED`, `72 PASS / 0 FAIL`
  - related regression: `e2e.order-finance-impact.ps1` -> `57 PASS / 0 FAIL`, `module.finance-control-funds.ps1` -> `40 PASS / 0 FAIL`, `module.reports-products-config.ps1` -> `41 PASS / 0 FAIL`
  - product fixes verified: `backend/src/order-update/order-update.service.ts`, `backend/src/agent-receivable/agent-receivable.service.ts`
- Latest finance/cashflow closure `2026-04-24 17:22:35 +07`:
  - pre-fix canonical full regression: `module.finance-survival-alerts.ps1` blocked `25`-suite closure with `14 PASS / 3 FAIL`
  - root cause: `backend/scripts/test-scenario-4-finance-health.js` Phase 1 fixture missed `agentPaidAmount`, while the current `cashflow-health` path reads that field for `dso`
  - targeted rerun after fix: `module.finance-survival-alerts.ps1` -> `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`, `18 PASS / 0 FAIL`
  - canonical full rerun after fix: `tests/backend/runners/run-backend-module-regression.ps1` -> `1145 PASS / 0 FAIL`, `25/25` suites
  - traceable summary: `tests/backend/artifacts/results/qa-module-regression-summary-20260424-172235.md`
- Latest runner bootstrap/env closure `2026-04-24 19:19:52 +07`:
  - harness fix: `tests/backend/runners/run-backend-module-regression.ps1`
  - canonical runner now aliases `MEDIA_DIR -> DB06_MEDIA_DIR` for the same-shell external-backend flow when `BACKEND_BASE_URL` is provided and `DB06_MEDIA_DIR` is missing
  - canonical runner now parses structured `BLOCKED` summaries with `FAIL` higher priority than `BLOCKED`
  - canonical JSON output now keeps per-module and total `Blocked` counts
  - direct suite audit kept:
    - `module.db-seed-cleanup.ps1` -> `BLOCKED`, `0 PASS / 0 FAIL / 1 BLOCKED` when `BACKEND_BASE_URL` is external and `DB06_MEDIA_DIR` is omitted
  - canonical pass verification:
    - `tests/backend/runners/run-backend-module-regression.ps1` -> `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, same external backend with backend `MEDIA_DIR` exported in the runner shell and `DB06_MEDIA_DIR` omitted
  - canonical blocked verification:
  - `tests/backend/runners/run-backend-module-regression.ps1` -> `BLOCKED`, `1112 PASS / 0 FAIL / 1 BLOCKED`, same external backend after removing both `MEDIA_DIR` and `DB06_MEDIA_DIR` from the runner shell
  - traceable summary: `tests/backend/artifacts/results/qa-runner-bootstrap-summary-20260424-191952.md`
- Latest local QA bootstrap closure `2026-04-24 19:44:06 +07`:
  - harness fixes:
    - `tests/backend/runners/run-backend-module-regression-local.ps1`
    - `test-all-modules.ps1`
  - bootstrap smoke audit:
    - `FAILED_HARNESS -> FIXED_HARNESS`
    - wrapper build step originally surfaced `Unknown command: "pm"` until the local runner switched to `npm.cmd run build`
  - shared-DB local bootstrap verification:
    - `test-all-modules.ps1` -> `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, backend `http://localhost:60384/api`
  - clean-shell local bootstrap verification:
    - `test-all-modules.ps1` -> `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, backend `http://localhost:60707/api`
  - traceable summary: `tests/backend/artifacts/results/qa-local-bootstrap-summary-20260424-194406.md`
- Latest external runtime manifest closure `2026-04-24 20:11:07 +07`:
  - harness fixes:
    - `tests/backend/setup/backend-runtime-manifest.ps1`
    - `tests/backend/runners/write-backend-runtime-manifest.ps1`
    - `tests/backend/runners/run-backend-module-regression.ps1`
    - `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1`
  - pre-fix direct reproduce:
    - `module.db-seed-cleanup.ps1` -> `BLOCKED`, `0 PASS / 0 FAIL / 1 BLOCKED`, even though the manifest already contained `db06MediaDir`
  - post-fix direct rerun:
    - `module.db-seed-cleanup.ps1` -> `BLOCKED -> FIXED_HARNESS -> PASSED`, `51 PASS / 0 FAIL`
  - canonical pass verification:
    - `tests/backend/runners/run-backend-module-regression.ps1` -> `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, with `BACKEND_RUNTIME_MANIFEST` only
  - canonical blocked verification:
    - `tests/backend/runners/run-backend-module-regression.ps1` -> `BLOCKED`, `1112 PASS / 0 FAIL / 1 BLOCKED`, with an intentionally incomplete manifest
  - traceable summary: `tests/backend/artifacts/results/qa-runtime-manifest-summary-20260424-201107.md`

## Integration And Public Surface Matrix

| Scenario ID | Priority | Status | Target suite |
|---|---|---|---|
| `BE-MASTER-04` | P1 | `active_automated` | `module.user-import-export.ps1` |
| `BE-MASTER-05` | P1 | `active_automated` | `module.user-import-export.ps1` |
| `BE-MASTER-06` | P1 | `active_automated` | `module.user-import-export.ps1` |
| `BE-MEDIA-01` | P1 | `active_automated` | `module.media-chat-config.ps1` |
| `BE-MEDIA-02` | P1 | `active_automated` | `module.media-chat-config.ps1` |
| `BE-MEDIA-03` | P1 | `active_automated` | `e2e.public-contracts-resilience.ps1` |
| `BE-CHAT-01` | P1 | `active_automated` | `module.media-chat-config.ps1` |
| `BE-CHAT-02` | P1 | `active_automated` | `module.media-chat-config.ps1` |
| `BE-CHAT-03` | P1 | `active_automated` | `e2e.public-contracts-resilience.ps1` |
| `BE-OPS-01` | P1 | `active_automated` | `module.finance-control-funds.ps1` |
| `BE-OPS-02` | P1 | `active_automated` | `module.ads-budget-x-emergency.ps1` |
| `BE-OPS-03` | P2 | `active_automated` | `module.finance-control-funds.ps1` |
| `BE-OPS-04` | P1 | `active_automated` | `module.order-sheet-sync-ops.ps1` |
| `BE-OPS-05` | P1 | `active_automated` | `module.order-sheet-sync-ops.ps1` |
| `BE-OPS-06` | P1 | `active_automated` | `module.order-sheet-sync-ops.ps1` |
| `BE-PUB-01` | P1 | `active_automated` | `e2e.public-contracts-resilience.ps1` |
| `BE-PUB-02` | P1 | `active_automated` | `e2e.public-contracts-resilience.ps1` |
| `BE-PUB-03` | P1 | `active_automated` | `e2e.public-contracts-resilience.ps1` |
| `BE-PUB-04` | P2 | `active_automated` | `e2e.public-contracts-resilience.ps1` |

## Database Interaction Matrix

| Scenario ID | Priority | Status | Target suite |
|---|---|---|---|
| `DB-01` | P1 | `active_automated` | `module.db-consistency.ps1` |
| `DB-02` | P1 | `active_automated` | `module.db-consistency.ps1` |
| `DB-03` | P1 | `active_automated` | `module.db-consistency.ps1` |
| `DB-04` | P1 | `active_automated` | `module.db-consistency.ps1` |
| `DB-05` | P2 | `active_automated` | `module.db-consistency.ps1` |
| `DB-06` | P2 | `active_automated` | `module.db-seed-cleanup.ps1` |
| `CON-09` | P2 | `active_automated` | `module.db-consistency.ps1` |

## Load And Resilience Matrix

| Scenario ID | Priority | Status | Target suite |
|---|---|---|---|
| `LOAD-01` | P2 | `active_automated` | `perf.load-smoke.k6.js` |
| `LOAD-02` | P2 | `active_automated` | `perf.spike-public.k6.js` |
| `LOAD-03` | P1 | `active_automated` | `perf.write-contention.k6.js` |
| `LOAD-04` | P2 | `active_automated` | `perf.analytics-read.k6.js` |
| `LOAD-05` | P3 | `manual` | future `perf.soak-analytics.k6.js` |
| `LOAD-06` | P2 | `manual` | future `perf.recovery-chaos-checklist.md` |

- Latest load closure `2026-04-24 22:06:22 +07`:
  - `tests/backend/perf/perf.write-contention.k6.js`: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - related regression:
    - `test-all-modules.ps1`: `PASSED`, `1163 PASS / 0 FAIL / 0 BLOCKED`, `25/25` suites
  - traceable summary:
    - `tests/backend/artifacts/results/qa-load03-product-fix-summary-20260424-221308.md`
- Latest load closure `2026-04-19 17:11:15 +07`:
  - `tests/backend/perf/perf.analytics-read.k6.js`: `FAILED_HARNESS/BLOCKED_ENV -> FIXED_ENV -> FIXED_HARNESS -> FIXED_HARNESS -> FIXED_HARNESS -> PASSED`
  - scope: `financial-control/dashboard`, `cashflow/dashboard/summary`, `ad-group-profit-report/performance`, `return-report/*`
  - no product regression reruns were required because this round changed harness/env code only
- Latest load closure `2026-04-19 14:32:36 +07`:
  - `tests/backend/perf/perf.write-contention.k6.js`: `FAILED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - related regression:
    - `e2e.concurrent-finance-ripple.ps1`: `PASSED`
    - `module.db-consistency.ps1`: `PASSED`
    - `e2e.return-ripple.ps1`: `PASSED`
- Latest load closure `2026-04-19 12:57:02 +07`:
  - `tests/backend/perf/perf.load-smoke.k6.js`: `FAILED_HARNESS -> FAILED_PRODUCT -> FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - related regression:
    - `module.auth-rbac.ps1`: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
    - `module.finance-control-funds.ps1`: `PASSED`
    - `e2e.order-finance-impact.ps1`: `PASSED`
    - `e2e.ops-payroll.ps1`: `PASSED`
- Latest load closure `2026-04-19 13:43:09 +07`:
  - `tests/backend/perf/perf.spike-public.k6.js`: `FAILED_HARNESS/BLOCKED_ENV -> FAILED_PRODUCT -> FAILED_HARNESS -> FIXED_PRODUCT -> PASSED`
  - related regression:
    - `e2e.public-contracts-resilience.ps1`: `PASSED`
    - `module.media-chat-config.ps1`: `PASSED`

## Recommended Build Order

`e2e.public-contracts-resilience.ps1`, `e2e.concurrent-finance-ripple.ps1`, `e2e.order-update-ripple.ps1`, va `perf.write-contention.k6.js` da duoc kich hoat trong ngay `2026-04-19`; build order ben duoi la cac gap con lai.

- Latest DB activation `2026-04-19 12:15:55 +07`:
  - `module.db-seed-cleanup.ps1`: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`, `50 PASS / 0 FAIL`
  - DB matrix is now active on `DB-01..06` and `CON-09`
  - same-day failed audit kept: `tests/backend/artifacts/results/module.db-seed-cleanup-rerun-20260419-121310.log`

1. Tach rieng nhom perf/load thanh `k6` hoac harness tuong duong, khong tron vao regression moi PR.
