# Backend Test Suite Backlog

Danh sach suite de xuat chua ton tai trong active tree, dung de chuyen tu test plan sang implementation.

## Proposed Suites

- Khong con proposed module suite nao trong active product backlog.
- `BE-SUP-04` da duoc chuyen sang active tree bang `tests/backend/suites/modules/extended/module.purchase-inventory.ps1` trong round `2026-04-24 16:48:58 +07`.
- `BE-OWN-05` da duoc chuyen sang active tree bang `tests/backend/suites/modules/extended/module.owner-fund-ledger-reconcile.ps1` trong round `2026-04-24 23:37:05 +07`; same-round real QA DB reconcile da dong `18` missing historical withdrawal ledger rows.
- `BE-OWN-06` da duoc chuyen sang active tree bang `tests/backend/suites/modules/extended/module.owner-fund-objectid-normalize.ps1` trong round `2026-04-25 00:28:07 +07`; same-round real QA DB normalize da cap nhat `98` owner-fund refs, delete-owner voi financial history da bi chan `HTTP 400`, va canonical full regression xanh `1254 PASS / 0 FAIL / 0 BLOCKED`, `27/27` suites.
- `BE-OWN-07` khong con la live anomaly tren current QA DB sau round `2026-04-25 11:56:15 +07`: pre-audit `FAILED_PRODUCT` (`15` orphan owner refs / `37` withdrawals / `26` fund transactions) da duoc dong bang snapshot-scoped exact-pattern cleanup `FAILED_PRODUCT -> FIXED_DATA -> PASSED`, serial verify ve `0` orphan, va idempotent re-apply deleted `0`. Backlog con lai la governance/manual recovery, khong phai proposed active suite moi.

## Performance Harness Backlog

| Proposed file | Scope | Scenario IDs |
|---|---|---|
| `tests/backend/perf/perf.soak-analytics.k6.js` | soak 2-8h | `LOAD-05` |
| `tests/backend/perf/perf.recovery-chaos-checklist.md` | dependency degradation and recovery | `LOAD-06` |

## Notes

- `e2e.public-contracts-resilience.ps1` da duoc kich hoat vao active tree va verify bang round `2026-04-19 03:24:15 +07`; public/bootstrap/media/chat contract gap khong con nam trong backlog de xuat.
- `module.auth-hardening.ps1` da duoc kich hoat vao active tree va verify bang targeted round `2026-04-15`.
- `module.user-import-export.ps1` da duoc kich hoat vao active tree va verify bang full regression `2026-04-19 01:40:52 +07`.
- `module.api-token-timezone.ps1` da duoc kich hoat vao active tree va verify bang round `2026-04-19 01:58:10 +07`.
- `module.order-sheet-sync-ops.ps1` da duoc kich hoat vao active tree va verify bang targeted round `2026-04-19 02:28 +07`; canonical full regression `2026-04-19 02:37:52 +07` xanh `22/22`.
- `e2e.concurrent-finance-ripple.ps1` da duoc kich hoat vao active tree va verify bang round `2026-04-19 04:11:09 +07`; duplicate supplier/agent payment retry va owner-withdrawal approve race da duoc bao phu trong active catalog.
- `e2e.return-ripple.ps1` da duoc kich hoat vao active tree va verify bang activation round `2026-04-19`; rerun sau finance follow-up tai `2026-04-19 10:31:04 +07` van xanh `64 PASS / 0 FAIL`.
- `e2e.order-update-ripple.ps1` da duoc kich hoat vao active tree va verify bang round `2026-04-19 11:35:53 +07`; `E2E-RIPPLE-06` khong con nam trong backlog de xuat.
- `module.db-consistency.ps1` da duoc mo rong va verify bang round `2026-04-19 11:50:21 +07`; `DB-01..05`, `CON-08`, va `CON-09` khong con nam trong backlog de xuat.
- `module.db-seed-cleanup.ps1` da duoc kich hoat vao active tree va verify bang round `2026-04-19 12:15:55 +07`; `DB-06` khong con nam trong backlog de xuat.
- `tests/backend/perf/perf.load-smoke.k6.js` da duoc kich hoat vao active tree va verify bang round `2026-04-19 12:57:02 +07`; `LOAD-01` khong con nam trong backlog de xuat.
- `tests/backend/perf/perf.spike-public.k6.js` da duoc kich hoat vao active tree va verify bang round `2026-04-19 13:43:09 +07`; `LOAD-02` khong con nam trong backlog de xuat.
- `tests/backend/perf/perf.write-contention.k6.js` da duoc kich hoat vao active tree va verify bang round `2026-04-19 14:32:36 +07`; `LOAD-03` khong con nam trong backlog de xuat.
- `tests/backend/perf/perf.analytics-read.k6.js` da duoc kich hoat vao active tree va verify bang round `2026-04-19 17:11:15 +07`; `LOAD-04` khong con nam trong backlog de xuat.
- Same-day audit trail for DB suite expansion is preserved:
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-114841.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-115021.log`: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - `tests/backend/artifacts/results/module.db-seed-cleanup-rerun-20260419-121310.log`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/module.db-seed-cleanup-rerun-20260419-121555.log`: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-121722.log`: `BLOCKED_ENV`
  - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-121806.log`: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
- Same-day audit trail for load activation is preserved:
  - `tests/backend/artifacts/results/tmp-load-smoke-backend-3687-20260419-123033.out.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-123253.json`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-124509.json`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/perf.load-smoke-summary-20260419-125702.json`: `FAILED_HARNESS -> FAILED_PRODUCT -> FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-125944.log`: `BLOCKED_ENV`
  - `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-130726.log`: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
  - `tests/backend/artifacts/results/module.finance-control-funds-rerun-20260419-130726.log`: `PASSED`
  - `tests/backend/artifacts/results/e2e.order-finance-impact-rerun-20260419-130726.log`: `PASSED`
  - `tests/backend/artifacts/results/e2e.ops-payroll-rerun-20260419-125944.log`: `PASSED`
- Same-day audit trail for `LOAD-02` activation is preserved:
  - `tests/backend/artifacts/results/tmp-spike-public-backend-3696-20260419-133036.err.log`: `FAILED_HARNESS/BLOCKED_ENV`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-133229.json`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-134125.json`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/perf.spike-public-summary-20260419-134309.json`: `FAILED_HARNESS/BLOCKED_ENV -> FAILED_PRODUCT -> FAILED_HARNESS -> FIXED_PRODUCT -> PASSED`
  - `tests/backend/artifacts/results/e2e.public-contracts-resilience-rerun-20260419-134548.log`: `PASSED`
  - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-134657.log`: `PASSED`
- Same-day audit trail for `LOAD-03` activation is preserved:
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-141816.json`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-142358.json`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-142859.json`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-143119.json`: `FAILED_PRODUCT`
  - `tests/backend/artifacts/results/perf.write-contention-summary-20260419-143236.json`: `FAILED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - `tests/backend/artifacts/results/e2e.concurrent-finance-ripple-rerun-20260419-143338.log`: `PASSED`
  - `tests/backend/artifacts/results/module.db-consistency-rerun-20260419-143409.log`: `PASSED`
  - `tests/backend/artifacts/results/e2e.return-ripple-rerun-20260419-143449.log`: `PASSED`
- Same-day audit trail for `LOAD-04` activation is preserved:
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170009.log`: `FAILED_HARNESS/BLOCKED_ENV`
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170436.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170817.log`: `FAILED_HARNESS`
  - `tests/backend/artifacts/results/perf.analytics-read-seed-setup-20260419-170954.log`: `FIXED_ENV -> FIXED_HARNESS -> FIXED_HARNESS -> FIXED_HARNESS -> PASSED`
  - `tests/backend/artifacts/results/perf.analytics-read-summary-20260419-171115.json`: `PASSED`
- `purchase-orders` da duoc wire vao `AppModule` trong round `2026-04-24`; `inventory/*` da live tu truoc qua transitive imports.
- `backend/scripts/audit-owner-fund-orphan-owners.js` la read-only audit path hien hanh cho `BE-OWN-07`; script nay khong tu tao owner placeholder, khong rebind lich su, va khong duoc dung de "lam xanh" du lieu bang cach phat minh identity.
- `backend/scripts/cleanup-owner-fund-orphan-fixtures.js` va `tests/backend/suites/modules/extended/module.owner-fund-orphan-fixture-cleanup.ps1` da ton tai nhu manual/admin recovery path cho `BE-OWN-07`; helper nay chi dung cho snapshot/family exact-match, khong duoc kich hoat vao active full regression va khong duoc mo rong thanh generic orphan deleter.
- `BE-SUP-04` khong con nam trong backlog: suite active da cover full create -> receive -> inventory summary/transactions -> price-history, va related `module.supply-chain.ps1` ripple rerun cung xanh.
- Activation audit trail cho `BE-SUP-04` duoc giu lai:
  - `tests/backend/artifacts/results/tmp-purchase-inventory-3686-20260424-164034.out.log`: `FAILED_PRODUCT + FAILED_HARNESS`
  - `tests/backend/artifacts/results/tmp-purchase-inventory-3686-20260424-164034.err.log`: `FAILED_PRODUCT + FAILED_HARNESS`
  - `tests/backend/artifacts/results/module.purchase-inventory-rerun-20260424-1649.log`: `FAILED_PRODUCT + FAILED_HARNESS -> FIXED_PRODUCT -> FIXED_HARNESS -> PASSED`
  - `tests/backend/artifacts/results/module.supply-chain-rerun-20260424-1649.log`: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
  - `tests/backend/artifacts/results/qa-purchase-inventory-activation-summary-20260424-164858.md`: activation summary
- `module.db-consistency.ps1` shared-DB rerun ngay `2026-04-24` da ghi nhan `FAILED_HARNESS -> FIXED_HARNESS -> PASSED` cho `CON-09`; suite nay khong con gia dinh clean DB tuyet doi khi `BACKEND_BASE_URL` / `MONGODB_URI` tro vao backend dung chung.
- Nhom `perf/*` backlog con lai nen tach khoi regression moi PR, bat dau tu `LOAD-05`.
- Nhom `manual` van phai co checklist ket qua mong doi, khong de thanh "nho test sau".

## Harness Improvements From Latest Execution

| Proposed file or work item | Scope | Reason |
|---|---|---|
| `tests/backend/setup/ensure-regression-users.ps1` effective-target echo / preflight | make isolated Mongo target explicit before auth-dependent suites start | latest finance follow-up first blocked because baseline users were seeded into the wrong DB before `MONGODB_URI` override was applied |
| `tests/backend/runners/run-backend-module-regression.ps1` transaction-preflight enhancement | surface transaction readiness before transaction suites start | latest regression is green, but local QA should fail fast if Mongo falls back from replica set to standalone mode |
| `tests/backend/suites/modules/extended/module.return-request-transaction-env.ps1` | preflight Mongo transaction support for return resolve and rollback paths | current baseline passes on replica-set Mongo; keep an explicit env-gated check so transaction-dependent flows remain diagnosable |
| `tests/backend/suites/modules/core/module.media-chat-config.ps1` deterministic import-by-url positive path | replace external placeholder dependency with a local/seeded media source so successful import is asserted, not just endpoint response | latest isolated rerun hit outbound `ECONNRESET` to `https://via.placeholder.com/150`, so current suite still leaves a real success-path gap |
