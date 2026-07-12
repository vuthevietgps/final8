# QA Summary - Owner Fund ObjectId Normalize

- Timestamp: `2026-04-25 11:16:11 +07`
- Scope:
  - activate and harden `module.owner-fund-objectid-normalize.ps1`
  - normalize mixed owner-fund BSON refs on real QA DB
  - fix owner delete guard so financial history cannot be orphaned going forward
  - rerun related owner-fund/finance regressions and canonical full module regression
  - keep residual orphan-owner data as audit-only, not auto-repair

## Cases Run

- `module.owner-fund-objectid-normalize.ps1`
  - `module.owner-fund-objectid-normalize-direct-run-20260425-000805.err.log`
  - `FAILED_HARNESS`
- `module.owner-fund-objectid-normalize.ps1`
  - `module.owner-fund-objectid-normalize-direct-run-20260425-000902.out.log`
  - `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
- `module.owner-fund-objectid-normalize.ps1`
  - `module.owner-fund-objectid-normalize-rerun-20260425-001052.out.log`
  - `PASSED`
- `module.owner-fund-objectid-normalize.ps1`
  - `module.owner-fund-objectid-normalize-deleteguard-rerun-20260425-001836.out.log`
  - `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
  - final `43 PASS / 0 FAIL / 0 BLOCKED`
- Real QA DB normalize dry-run
  - `owner-fund-objectid-normalize-dryrun-real-20260425-001107.json`
  - `FAILED_PRODUCT`
  - `98` convertible refs, `0` invalid strings, `0` unexpected BSON-type blockers
- Real QA DB normalize apply
  - `owner-fund-objectid-normalize-apply-real-20260425-001132.json`
  - `FAILED_PRODUCT -> FIXED_PRODUCT`
  - `98` refs updated
- Real QA DB normalize verify
  - `owner-fund-objectid-normalize-verify-real-20260425-001143.json`
  - `PASSED`
  - `0` convertible refs remain
- Owner delete guard repro
  - `owner-fund-delete-guard-repro-pass-20260425-003420.json`
  - `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
- Related reruns
  - `module.owner-fund-loan-cleanupfix-rerun-20260425-002706.out.log`: `PASSED`, `67 PASS / 0 FAIL`
  - `module.finance-control-funds-objectidguard-rerun-20260425-001924.out.log`: `PASSED`, `40 PASS / 0 FAIL`
  - `e2e.concurrent-finance-ripple-objectidguard-rerun-20260425-001924.out.log`: `PASSED`, `67 PASS / 0 FAIL`
  - `module-regression-20260425-002807.json`: `PASSED`, `1254 PASS / 0 FAIL / 0 BLOCKED`, `27/27` suites
- Residual data audit
  - `owner-fund-orphan-owner-audit-real-20260425-111459.json`
  - `FAILED_PRODUCT`
  - `ownersTotal=5`, `15` orphan owner refs, `37` orphan withdrawals, `26` orphan fund transactions

## Bugs Found

- Harness bug: initial normalize suite activation had PowerShell/parser drift and did not produce a trustworthy product signal.
- Product bug: `OwnerFundService.deleteOwner()` allowed deleting an owner with existing withdrawal/fund-transaction history, creating ownerless financial rows.
- Data bug still open on real QA DB: historical owner-fund rows still reference `15` deleted owner ids after the forward delete guard was fixed.

## Fixes

- `backend/scripts/normalize-owner-fund-objectids.js`
  - dry-run now blocks on invalid strings and unexpected BSON types
  - apply now uses compare-and-set filters instead of blind `_id`-only updates
- `backend/src/owner-fund/owner-fund.service.ts`
  - `deleteOwner()` now rejects deletion when any withdrawal or fund transaction still references the owner id
- `tests/backend/suites/modules/extended/module.owner-fund-objectid-normalize.ps1`
  - active lane now covers normalize dry-run/apply/re-apply plus delete-owner-with-history contract
- `tests/backend/suites/modules/core/module.owner-fund-loan.ps1`
  - cleanup now removes dependent owner-fund rows before deleting seeded owners
- `backend/scripts/audit-owner-fund-orphan-owners.js`
  - read-only audit path for real-QA orphan-owner detection; no repair side effects

## Open Risk

- The remaining orphan-owner issue is historical identity loss, not surviving type drift.
- Child rows do not contain authoritative owner identity fields, so a safe repair cannot invent placeholder owners or rebind rows heuristically.
- Current safe status: audit-only until an authoritative restore source exists.
