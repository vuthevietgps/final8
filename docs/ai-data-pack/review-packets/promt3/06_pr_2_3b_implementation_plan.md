# PR-2.3B Implementation Plan

Do not start until PR-2.3A is reviewed and approved.

## PR-2.3B-1: ExportJob + Cached Wrapper

- Scope: job contract/model/service, cached mode, idempotency, audit and artifact lifecycle.
- Tests: no sync/provider/action call; cached flag; duplicate job prevention; existing GET unchanged.
- Acceptance: deterministic cached job lifecycle and artifacts.
- Excludes: provider sync and new decision thresholds.

## PR-2.3B-2: Source Registry + DB-only Freshness Gate

- Scope: code allowlist registry, local watermarks, report-date coverage and approved threshold policy.
- Tests: fresh/stale/missing/not-configured/unsupported, official block and partial warning.
- Acceptance: every source result explains its evidence; no provider call.
- Excludes: provider adapters.

## PR-2.3B-3: Google Ads Read-only Adapter

- Scope: narrow direct adapter around `GoogleAdsReadonlySyncService`, source lock, timeout, sanitized run linkage.
- Tests: SearchStream-only provider mock, mutate rejection, duplicate lock, failure block, fresh skip.
- Acceptance: no mutation-capable service injection; ExportJob links durable sync run.
- Excludes: Meta/TikTok/Zalo and all action flows.

## PR-2.3B-4: Metadata, DQ and Snapshot Integration

- Scope: `metadata.pre_export_sync`, freshness metrics, decision-gate impacts and immutable snapshots/checksums.
- Tests: JSON/XLSX metadata, stale gates, freshness versus completeness.
- Acceptance: consistent source/job/policy facts in all requested packs.

## PR-2.3B-5: Endpoints, RBAC and Download

- Scope: POST/status/download endpoints, permissions and sanitized responses.
- Tests: RBAC matrix, ownership/download, invalid mode/policy, no secret/PII.
- Acceptance: only authorized actors can create/read/download appropriate jobs.

## Required Verification Per Sub-PR

- Focused unit/integration tests for the slice.
- Backend build.
- Explicit command/result summary.
- No provider call in tests except mocked read-only adapter behavior.
- Safe gates remain: import/dry-run/live false.

Later separate work: Meta/TikTok adapters, Zalo, accounting, durable CRM/sales activity, operations history and referrals.
