# Ket qua Prompt 3 - PR-2.3A Pre-export Sync & Freshness Gate Technical Spec / Gap Plan

## 1. Executive Summary

ERP co du nen de xay dung pre-export freshness gate, nhung chua du an toan de bat provider sync tu dong trong official export ngay lap tuc.

- Nen hien co: AI Data Pack read-only exports, metadata/quality contracts, decision gates, Google Ads read-only sync rieng, Google Ads sync-run audit, timestamps tren phan lon model noi bo, RBAC hien tai va secret redaction.
- Khoang trong chinh: chua co ExportJob, source registry, freshness policy theo source, snapshot bat bien, distributed lock, idempotency cho export, hay pre-export orchestrator.
- Read-only sync san dung tot nhat: `GoogleAdsReadonlySyncService`. Service chi dung `googleAds:searchStream`, tu choi query co tu `mutate`, ghi `google_ads_sync_runs`, va cap nhat du lieu local.
- Read-only sync chi partial/chua du audit de dung ngay: Meta/Google/TikTok advertising-cost sync va Facebook ad-group metadata sync. Cac service nay khong co durable run contract dong nhat, va mot so module nam canh cac duong auto-control/mutation.
- Chi co the dung freshness theo local watermark nhu `max(updatedAt)`: CRM leads, lead/sale activity, orders, payments, finance, debt schedule, supplier settlement, tier-2 agent commission, product mapping, operations, returns, decision history, system settings.
- Unsupported/not configured: Zalo Ads sync, external accounting sync, durable sale activity/call log, customer referral graph, operations SLA/status history. Khong duoc danh dau cac source nay la fresh.
- `official_export`: gate nghiem; critical source stale/missing/failed phai block theo policy da approve.
- `partial_export`: cho phep xuat voi warning va decision gates bi ha.
- `cached_export`: khong sync; chi dung ky thuat/test; phai gan `cached_export=true`.
- Khong nen code PR-2.3B truoc khi ChatGPT Web Pro Extended review va giam doc approve technical spec/threshold/criticality/RBAC.
- Sau approval, scope nho nhat nen la PR-2.3B-1: ExportJob + cached-export wrapper + DB-only freshness assessment. Khong provider call.

Nhung phan chua duoc code khi chua co xac nhan BA/giam doc: threshold chinh thuc, critical/optional source theo tung pack, official-export block policy, quyen tao official export, supplier/tier-2 settlement policy, partial export khi finance stale, va retention cua artifact/audit.

## 2. Scope Control

PR-2.3A nay chi la technical spec/gap plan.

Included:

- Doc source code, docs va sample exports.
- Inventory sync/freshness/source-of-truth.
- De xuat freshness gate, export job lifecycle, metadata, DQ, RBAC va PR-2.3B plan.
- Tao tai lieu trong `docs/ai-data-pack/`.

Excluded:

- Khong sua source code.
- Khong migration, model/schema hay endpoint moi.
- Khong provider API call, provider sync that, provider mutation.
- Khong OpenAI key, upload normalization, action import, generic dry-run hay live execution.
- Khong sua DB production/local.
- Khong tu chuyen sang PR-2.3B hay Phase 3.

Working tree hien co rat nhieu file untracked/thay doi tu cac nhip truoc. PR-2.3A chi them tai lieu Prompt 3 va khong sua cac thay doi ngoai scope.

## 3. Current AI Data Pack Export Baseline

Sau PR-2.2:

- 7 read-only endpoints da tra HTTP 200 trong acceptance run.
- Sample v2 tai `docs/ai-data-pack/sample-exports/20260612-v2/` da verify XLSX empty-sheet metadata, normalized actor, deterministic content checksum, finance quality split, value states, redaction va safe decision gates.
- Decision gates van safe: action draft co the tao; import, generic dry-run, live execution, strong LTV va ads scale van false khi quality khong dat.
- Existing GET exports query DB truc tiep. Khong co ExportJob, source freshness orchestration, snapshot hay provider sync truoc export.
- `DirectorDataPackService` hien gan `freshness_status=ok` neu co timestamp, chua so sanh threshold.
- `DataQualityReportService` moi co threshold ads freshness 24 gio; chua co gate freshness cho CRM/orders/payments/finance/supplier/returns.
- Sample report date `2026-06-12` sparse: khong co report-date orders/leads/Google Ads metrics/sync runs, nen khong the ket luan manh du metadata/format da dung.

## 4. Pre-export Sync Business Goal

Khi giam doc bam xuat Data Pack chinh thuc, ERP phai:

1. Xac dinh source bat buoc cho pack/request.
2. Danh gia freshness bang durable sync run, `lastSyncAt`, snapshot, hoac `max(updatedAt)` da khai bao.
3. Chi sync provider qua adapter read-only duoc allowlist va audit.
4. Danh dau ro `fresh`, `stale`, `missing`, `not_configured`, `unsupported`, `failed` hoac `skipped_fresh_enough`.
5. Block official export hoac ha decision gates neu critical source khong dat.
6. Tao snapshot/watermark truoc khi render file de ChatGPT Web biet chinh xac du lieu nao da duoc dung.

Read-only provider sync chi duoc doc provider va upsert local cache/audit. No khong duoc thay doi budget, campaign, ad group, keyword, creative, status hay bat ky business state nao. ERP van la he thong duy nhat duoc validate, approve va execute Google Ads actions; pre-export sync khong tham gia execution flow.

## 5. Source Inventory

| source_key | domain / importance | current support | existing evidence | read-only sync | freshness signal | mutation risk | recommended V1 / V2 | priority |
|---|---|---|---|---|---|---|---|---|
| `google_ads` | ads, critical | found | `GoogleAdsReadonlySyncService`, Google Ads entity schemas, sync runs | yes | `sync_run` + entity `lastSyncAt` | low if service injected directly; high if broad module/controller used | V1 allowlisted adapter after locks; V2 per-account coverage | P0 |
| `meta_ads` | ads, critical when used | partial | Facebook advertising-cost sync; Facebook ad-group metadata sync | partial | latest cost `updatedAt`; ad account/group `lastSyncAt`; no durable run | medium due broad modules/auto-control adjacency | V1 health/watermark only; V2 audited isolated adapter + run | P0 |
| `tiktok_ads` | ads, critical when used | partial | TikTok advertising-cost sync | partial | latest cost `updatedAt`; no durable run | medium | V1 health/watermark only; V2 audited adapter + run | P0 |
| `zalo_ads` | ads, optional until configured | missing | enums/token validation only | no | none | unclear | V1 `unsupported`/`not_configured`; V2 only after explicit integration | P2 |
| `advertising_costs` | ads/profit, critical | found/partial | `advertisingcosts`, FB/Google/TikTok sync services, health endpoints | partial | `max(updatedAt)` + latest record date | medium; cleanup and provider reads need audit | V1 watermark/coverage; V2 unified source/run policy | P0 |
| `crm_leads` | CRM/sales, critical | partial | `MarketingLead`, explicit create plus inferred signals | no external sync | `max(updatedAt, leadCreatedAt)` | low provider risk; medium semantic risk | V1 local watermark + inference warning; V2 durable ingestion/run | P0 |
| `lead_activity` | CRM, important | partial | lead timestamps, chat messages | no | local max timestamps | low | V1 partial; V2 durable activity model | P1 |
| `sale_activity` | sales, important | partial | assigned sale, first response, follow-up fields | no | local max timestamps | low | V1 partial/weak; V2 activity/call log | P1 |
| `orders` | orders/profit, critical | found | `TestOrder2` local ERP records | no external sync | `max(updatedAt)` + report-date coverage | low for read; high if recalculation/sheet sync called | V1 DB-only watermark; never call sheet sync | P0 |
| `payments` | finance/profit, critical | partial | order payment fields, statements, loan payments | no external sync | max payment/order/statement timestamps | high if statement payment sync methods invoked | V1 DB-only watermark; V2 canonical payment ledger | P0 |
| `accounting` | finance, critical if claimed | missing/unclear | no canonical external accounting sync found | no | none | unclear | V1 missing/unsupported; do not claim accounting freshness | P1 |
| `finance_cashflow` | finance, critical | found/partial | `FinancialControlService`, `FinanceService`, `CashflowEntry`, settings/snapshots | no external sync | collection max timestamps + calculation time | high if budget/allocation/execution services used | V1 DB-only freshness; V2 canonical finance snapshot/run | P0 |
| `loans_debt_schedule` | finance, critical | found | loan contracts/repayments with timestamps and due dates | no | max contract/repayment `updatedAt` + schedule coverage | high if payment/disbursement methods called | V1 DB-only freshness plus completeness gate | P0 |
| `supplier_settlement` | dropship/profit, critical candidate | found/partial | supplier payable/statements, timestamps | no | max statement/payable/payment timestamps | high if add/close/sync-to-order called | V1 DB-only watermark; criticality needs approval | P0 |
| `tier2_agent_commission` | dropship/profit, critical candidate | found/partial | agent statements, timestamps | no | max statement/payment/order timestamps | high if payment sync-to-order called | V1 DB-only watermark; terminology/policy confirmation | P0 |
| `product_service_mapping` | mapping/profit, critical for scale | partial | products/categories/ad-group mappings | no | `max(updatedAt)` plus mapping completion | low | V1 DB-only + mapping gate; V2 versioned mapping | P0 |
| `operations_status` | operations, important | partial | current order status counts | no | max order `updatedAt` | low read risk; semantic risk due no history/SLA | V1 current-status only; V2 status history/SLA | P1 |
| `return_refund` | profit/operations, important | partial | return request/report, timestamps | no | max return `updatedAt/resolvedAt` | low | V1 DB-only watermark; stale blocks adjusted conclusions | P1 |
| `customer_referral` | growth/LTV, optional | missing | no durable referral graph | no | none | low | V1 unsupported/schema-only; V2 dedicated model | P2 |
| `decision_history` | governance, important | partial | Google action logs/evaluations and legacy evaluations | no | max execution/evaluation timestamps | high if action services invoked | V1 read-only history watermark | P1 |
| `system_settings_director_inputs` | manual policy, important | partial/not configured | `system_settings`, timestamps | no | max `updatedAt`; absence=`not_configured` | high if settings update called | V1 read-only; do not treat absence as stale | P1 |

## 6. Existing Sync/Refresh Capabilities

### 6.1 Google Ads

- `GoogleAdsReadonlySyncService.sync()` reads account, campaign, campaign budget, ad group, keyword, responsive search ad and daily metrics.
- Provider calls use only `googleAds:searchStream`; the service rejects a query containing `mutate` before credentials/provider call.
- The service writes durable `google_ads_sync_runs` with run ID, running/success/partial/failed status, date range, customer IDs, counts, sanitized errors and completion time.
- Synced entities receive `lastSyncAt`.
- Provider validate-only and execution are separate mutation flows. They are not pre-export freshness mechanisms and must stay excluded.
- The read-only service is sufficiently separated at class level, but it has no distributed source lock, export idempotency, timeout policy or duplicate-run prevention.
- Safe future integration must inject the read-only service directly through a narrow adapter. It must not call a broad Google Ads controller or mutation-capable execution/validation service.

### 6.2 Multi-channel ads / advertising costs

- Facebook, Google and TikTok advertising-cost services perform provider reads and local upserts. They expose health based mainly on latest cost record date/`updatedAt` and token/config state.
- They do not share a durable cross-channel SyncRun contract. Facebook failure counters are process-memory state.
- The finance `DataCollectionService` calls all three provider syncs and then recalculates orders/reports. Therefore it is not a safe pre-export read-only adapter.
- Facebook ad-group sync reads provider metadata, but its surrounding module includes import/auto-control paths. It needs method extraction/allowlist before use.
- No Zalo Ads sync implementation was found.
- V1 should assess multi-channel freshness from local watermarks/coverage only. V2 may add isolated read-only adapters and durable sync runs after audit.

### 6.3 CRM / Leads / Sales

- `MarketingLead` can be explicitly created and can be inferred/backfilled from inbound chat, pending orders and orders.
- A maintenance cron runs lead signal sync and action evaluation. This is local derivation, not proof of external CRM freshness.
- No external CRM/sheet/inbox SyncRun was found.
- `max(updatedAt, leadCreatedAt)` can be used as a local activity watermark, but metadata must state that some leads are inferred.
- Sale activity has assignment/response/follow-up fields but no durable call/activity/status-history model.

### 6.4 Orders / Payments / Accounting

- Orders are local ERP writes. No inbound external order sync was found.
- `OrderSheetSyncService` is outbound and writes/clears Google Sheets; it must never be called by pre-export sync.
- Payment and settlement methods can update statements and orders; they must not be called by pre-export sync.
- Orders freshness: `max(ordertest2.updatedAt)` plus explicit report-date row coverage.
- Payments freshness: max of relevant order payment timestamps, statement `updatedAt`, embedded payment `paidAt`, and loan payment/repayment timestamps.
- No canonical external accounting sync was found. Accounting must remain `missing`/`unsupported`.

### 6.5 Finance / Loans / Debt

- AI Data Pack currently uses canonical finance services and local collections. `FinancialControlService` calculation time is useful output metadata but is not a durable source sync proof.
- `CashflowEntry`, `LoanContract`, `LoanRepayment`, funding/settings and finance snapshot models provide timestamps.
- Debt freshness must combine max contract/repayment timestamps with schedule completeness, overdue alerts and requested horizon coverage.
- Freshness alone cannot make an incomplete debt schedule trustworthy.
- Forbidden canonical sources remain forbidden: `computeAvailableFunds`, `getCollectedRevenueToday`, `getLoanRoomAvailable`, and mock/random sources.

### 6.6 Supplier / Agent / Dropship settlement

- Supplier payable/statement and agent statement models support balances, payments, periods and timestamps.
- Payment/close/reopen/sync-to-order methods mutate business state and must not be called.
- V1 can use DB-only max timestamps and period coverage. Criticality and terminology must be confirmed because legacy names invert common payable/receivable meanings.

### 6.7 Operations / Returns / Customer referrals

- Operations currently exposes current status counts, not durable SLA/status history. Freshness can use order `updatedAt`, but decision confidence remains weak.
- Return requests have `createdAt`, `updatedAt`, `resolvedAt`; return reports aggregate local data. V1 freshness is possible with DB-only watermarks.
- No durable customer-to-customer referral graph was found. It remains unsupported.

## 7. Freshness Requirements & Gate Rules

Freshness must be evaluated using both:

- `last_source_data_at` or `last_successful_sync_at`.
- Coverage for the requested report date/range.

A recent timestamp with no requested-date records is not sufficient. Thresholds below are proposed defaults and require director/BA approval.

| source | proposed max staleness | missing/stale official behavior | partial behavior | decision impact |
|---|---:|---|---|---|
| `google_ads` | 60 min; hard-stale 180 min | block ads-dependent official pack when configured/critical | allow with explicit warning | `can_recommend_ads_scale=false` |
| `meta_ads` | 180 min; hard-stale 720 min | block only when channel is active and critical | allow | no strong Meta scale/channel conclusion |
| `tiktok_ads` | 180 min; hard-stale 720 min | block only when channel is active and critical | allow | no strong TikTok scale/channel conclusion |
| `zalo_ads` | none until supported | `not_configured` or `unsupported`, never fresh | allow if optional | no Zalo conclusion |
| `advertising_costs` | 360 min; hard-stale 1440 min | block strong ads/profit conclusion | allow | ads/profit cautious |
| `crm_leads` | 120 min; hard-stale 480 min | block strong sales conclusion | allow | sales performance cautious/no |
| `orders` | 60 min; hard-stale 240 min | block strong profit/operations conclusion | allow | `can_conclude_profit=false` |
| `payments` | 120 min; hard-stale 720 min | block realized-profit/cash conclusion | allow | realized profit/cash cautious |
| `finance_cashflow` | 60 min; hard-stale 240 min | block official Director budget/cash decision | allow only with strong warning | no budget increase/loan conclusion |
| `loans_debt_schedule` | 1440 min; hard-stale 2880 min | block if stale or schedule incomplete | allow | no strong debt/cashflow conclusion |
| `supplier_settlement` | 1440 min; hard-stale 2880 min | proposed block product/supplier scale; needs approval | allow | no strong supplier/product scale |
| `tier2_agent_commission` | 1440 min; hard-stale 2880 min | proposed block realized margin; needs approval | allow | profit cautious |
| `product_service_mapping` | 1440 min; hard-stale 4320 min | stale/missing mapping blocks scale | allow | mapping/scale blocked |
| `operations_status` | 120 min; hard-stale 480 min | block strong capacity conclusion | allow | operations cautious/no |
| `return_refund` | 1440 min; hard-stale 2880 min | optional initially; stale blocks adjusted conclusion | allow | no return-adjusted strong conclusion |
| `decision_history` | 1440 min; hard-stale 4320 min | warning unless governance review requested | allow | history completeness warning |

Additional rules:

- `not_configured` is valid only when configuration is genuinely absent and the source is optional. It cannot hide a failed configured source.
- `unsupported` must be explicit and never converted to fresh.
- `unknown` is not fresh.
- Any provider sync failure must preserve last known watermark and report the failure separately.
- Critical source status `stale`, `missing`, `failed`, `unknown` or `unsupported` blocks official export unless an approved policy explicitly permits `completed_with_warnings`.
- Stale ads: `can_recommend_ads_scale=false`; recommendations limited to monitor/investigate.
- Stale finance: no ads budget increase and no strong loan/cashflow recommendation.
- Stale orders/payments: `can_conclude_profit=false`.
- Stale CRM: no strong sale-performance conclusion.
- Stale supplier settlement: no strong product/supplier scale recommendation.
- Stale returns: no strong return-adjusted ads/product conclusion.

## 8. Export Modes

### 8.1 `official_export`

- Purpose: director daily decision support.
- Default `sync_policy=sync_required`, `allow_partial_export=false`.
- Check required source set for requested packs.
- Run only allowlisted read-only adapters for stale configured sources.
- Re-check freshness after sync, then snapshot and export.
- Block if any critical source still fails the approved policy.
- Optional-source failures may produce `completed_with_warnings` only if policy explicitly permits it.

### 8.2 `partial_export`

- Default `sync_policy=sync_if_stale`, `allow_partial_export=true`.
- May attempt approved read-only sync adapters.
- Always include blocking reasons, missing/unsupported source statuses and lowered decision gates.
- Output is suitable for cautious analysis, not strong decisions.

### 8.3 `cached_export`

- `sync_policy=export_cached`.
- Never calls provider sync or local business-state recalculation.
- Must include `cached_export=true` and source freshness based on existing DB only.
- Intended for technical/test/review usage.
- Strong decision gates remain false/cautious whenever required freshness or coverage is not proven.

Existing GET endpoints must remain side-effect-free. A future job endpoint may wrap them, but GET must never trigger sync.

## 9. Proposed Technical Design for PR-2.3B

Proposed module structure:

```text
backend/src/ai-data-pack/pre-export-sync/
  ai-data-pack-export-job.service.ts
  ai-data-pack-pre-export-sync.service.ts
  ai-data-pack-freshness-gate.service.ts
  ai-data-pack-snapshot.service.ts
  pre-export-sync.contract.ts
  source-registry.ts
  adapters/
    google-ads-readonly-source.adapter.ts
    local-watermark-source.adapter.ts
```

Future schemas, only after approval:

```text
backend/src/ai-data-pack/schemas/
  ai-data-pack-export-job.schema.ts
  ai-data-pack-source-sync-run.schema.ts
  ai-data-pack-snapshot.schema.ts
```

The source registry should initially be code/config allowlist, not mutable DB configuration. Each source definition declares:

- source key, criticality by pack, threshold policy version.
- freshness provider and coverage check.
- whether provider sync exists.
- exact allowlisted adapter.
- `provider_mutation_allowed=false`.
- timeout/retry policy and sanitized error policy.

Adapter contract should expose only operations equivalent to:

```text
assessFreshness(context)
syncReadOnly(context) // optional, allowlisted only
captureWatermark(context)
```

It must not expose `mutate`, `apply`, `execute`, `approve`, `pause`, `create`, `delete`, budget update, statement payment, order recalculation or sheet-write methods.

Future endpoints, not implemented in PR-2.3A:

```text
POST /api/ai/data-pack/export-jobs
GET  /api/ai/data-pack/export-jobs/:jobId
GET  /api/ai/data-pack/export-jobs/:jobId/download?file=...
```

Request and response contracts should follow Prompt 3, with server-enforced `read_only_provider_sync=true` and `live_execution=false`; clients must not be able to override these safeguards.

## 10. Metadata Contract Additions

Add `metadata.pre_export_sync` to every generated pack:

```json
{
  "export_job_id": "string",
  "export_mode": "official_export | partial_export | cached_export",
  "sync_policy": "sync_required | sync_if_stale | export_cached",
  "policy_version": "string",
  "snapshot_id": "string",
  "snapshot_started_at": "ISO-8601",
  "snapshot_finished_at": "ISO-8601",
  "overall_sync_status": "success | partial | failed | skipped_cached",
  "cached_export": false,
  "official_export_allowed": false,
  "sources": [
    {
      "source": "google_ads",
      "status": "success | partial | failed | skipped_fresh_enough | skipped_cached | unsupported | not_configured",
      "freshness_status": "fresh | stale | missing | unknown",
      "coverage_status": "complete | partial | missing | not_applicable | unknown",
      "last_source_data_at": "ISO-8601 or null",
      "last_successful_sync_at": "ISO-8601 or null",
      "freshness_minutes": 10,
      "max_staleness_minutes": 60,
      "sync_run_id": "string or null",
      "records_inserted": 0,
      "records_updated": 0,
      "error_code": "sanitized code or null",
      "error": "sanitized message or null"
    }
  ]
}
```

Do not expose credentials, raw provider response bodies, tokens, query headers, PII or stack traces.

## 11. Data Quality Additions

Add/standardize:

- `ads_data_freshness_hours`
- `crm_data_freshness_hours`
- `orders_data_freshness_hours`
- `payments_data_freshness_hours`
- `finance_data_freshness_hours`
- `supplier_settlement_freshness_hours`
- `return_refund_freshness_hours`
- `source_sync_success_rate`
- `source_sync_blocking_reasons`
- `stale_source_count`
- `critical_stale_source_count`
- `missing_source_count`
- `unsupported_source_count`
- `report_date_coverage_rate`
- `cached_export_flag`
- `official_export_allowed`
- `partial_export_allowed`

Metrics must distinguish freshness from completeness, mapping quality and report-date coverage.

## 12. Mapping / Decision Gate Impact

| gate | freshness impact |
|---|---|
| `can_conclude_profit` | false when orders, payments, advertising costs, required settlement or returns are stale/missing according to policy |
| `can_recommend_ads_scale` | false when ads freshness, attribution, product mapping, finance or required settlement is stale/missing |
| `can_use_ltv_strongly` | remains false until durable customer/order/referral mapping and fresh coverage exist |
| `can_generate_action_draft` | may remain true, but draft must carry freshness blocking reasons and no live authority |
| `can_import_action_file` | remains false in PR-2.3B |
| `can_dry_run` | remains false in PR-2.3B |
| `can_execute_live` | remains false in PR-2.3B |

Freshness never overrides existing mapping/completeness blocks. A source can be fresh but still unusable because its data is sparse, inferred or weakly mapped.

## 13. Concurrency / Idempotency / Locks

- Prevent concurrent active official jobs for the same normalized `report_date + sorted pack_types + requested_by`.
- Use a request idempotency key including report date, sorted pack types/formats, export mode, sync policy and policy version.
- Use source-level distributed lock for provider sync. Google Ads lock scope includes normalized customer IDs and date range.
- Store lock owner, acquired time, expiry and heartbeat. Expired locks may be reclaimed only after job-state verification.
- If source is already fresh and coverage is sufficient, return `skipped_fresh_enough`.
- Set bounded timeout per source; proposed initial provider timeout 120 seconds.
- Retry only transient read failures, maximum 1 retry initially. Never retry indefinitely.
- Do not retry `not_configured`, `unsupported`, authentication/policy rejection or mutation-guard failure.
- Snapshot after final freshness check. Record start/end watermarks and mark warning if data changed during snapshot.
- Use immutable artifact checksums and explicit retention policy. Do not rely on TTL cleanup for exact lock release semantics.

Proposed lifecycle:

```text
pending
  -> checking_freshness
  -> syncing (only if policy and allowlist permit)
  -> checking_freshness
  -> snapshotting
  -> exporting
  -> completed | completed_with_warnings

Any stage may end in blocked or failed.
```

## 14. Security & Permission

Current RBAC has pack read permissions but no export-job permissions. Director can read all four current packs; Manager can read marketer/quality/mapping; Investor can read director/quality/mapping. This becomes risky when supplier, payroll or commission sections are added.

Proposed permissions:

- `ai-data-pack.export.cached.create`
- `ai-data-pack.export.partial.create`
- `ai-data-pack.export.official.create`
- `ai-data-pack.export.job.read`
- `ai-data-pack.export.download`
- `ai-data-pack.export.sync-detail.read`
- `ai-data-pack.source-sync.readonly.execute`

Recommended policy:

- Official export: Director and explicitly approved technical admin only.
- Partial export: Director/Manager subject to pack read permissions.
- Cached export: technical/admin and approved reviewers; never a decision-authority shortcut.
- Job read/download: requester plus Director/admin, intersected with pack permissions.
- Detailed sync failures: sanitized and restricted; general viewers receive error code/category only.
- Add immutable export audit: actor, role, request, policy version, source statuses, result, files/checksums and timestamps.
- Add section-level RBAC before exposing payroll, supplier settlement, tier-2 commission or sensitive finance details to broader roles.
- Never log or return secrets, API keys, refresh tokens, credentials, authorization headers, raw provider bodies or unnecessary PII.
- The orchestrator must inject narrow adapters, not mutation-capable controllers/services.

## 15. PR-2.3B Implementation Plan

### PR-2.3B-1 - ExportJob + cached export wrapper

- Scope: job contract/model/service, cached mode only, idempotency, audit, wrap existing read-only builders.
- Likely files: new pre-export-sync contracts/services/schema/module wiring; focused specs.
- Tests: cached export never syncs, marks cached flag, duplicate active job rejected/reused, no action/provider services called.
- Acceptance: deterministic job lifecycle and artifacts; existing GET behavior unchanged.
- Not included: provider sync, new DQ thresholds, live/action flows.
- Risk: artifact retention and multi-pod lock design.

### PR-2.3B-2 - Source registry + DB-only freshness gate

- Scope: code allowlist registry, local watermark/coverage queries, threshold policy, gate results.
- Tests: fresh/stale/missing/not-configured/unsupported, report-date coverage, official block and partial warnings.
- Acceptance: no provider call; every source result explains its evidence.
- Not included: provider adapters.
- Risk: thresholds/criticality require approval.

### PR-2.3B-3 - Google Ads read-only adapter

- Scope: direct adapter around `GoogleAdsReadonlySyncService`, source lock, timeout, sanitized run linkage.
- Tests: search-only provider mock, mutate rejection, duplicate sync lock, sync-required failure blocks, fresh-enough skips.
- Acceptance: no mutation-capable service injected; durable sync run linked to ExportJob.
- Not included: Meta/TikTok/Zalo, validate-only/action execution.
- Risk: provider latency, auth failure, per-account partial coverage.

### PR-2.3B-4 - Metadata and data-quality integration

- Scope: `pre_export_sync` metadata in all packs, freshness DQ metrics, decision gate impacts, snapshots/checksums.
- Tests: metadata in JSON/XLSX, stale-source gate outcomes, freshness distinct from completeness.
- Acceptance: all pack outputs expose same policy/job/source facts.
- Not included: new BA domains.
- Risk: schema-version compatibility.

### PR-2.3B-5 - Job endpoints, permissions and download

- Scope: POST/status/download endpoints, permissions, sanitized responses, audit access.
- Tests: RBAC matrix, ownership/download checks, no secrets/PII, invalid mode/policy rejection.
- Acceptance: only authorized actors can create/read/download appropriate jobs.
- Not included: action import/dry-run/live execution.
- Risk: section-level access and artifact storage.

Later separate PRs, not part of initial PR-2.3B: audited Meta/TikTok adapters, Zalo integration, external accounting, durable CRM/sales activity, operations history, referral graph.

## 16. Tests Required for PR-2.3B

Tests to implement later, not run in PR-2.3A:

- `export_cached` does not sync and marks `cached_export=true`.
- `sync_if_stale` skips a fresh source.
- `sync_if_stale` plans an allowlisted sync when stale.
- `sync_required` blocks when a critical source remains stale/fails.
- `allow_partial_export` produces `completed_with_warnings`.
- Missing, unsupported and not-configured remain distinct.
- Fresh timestamp without report-date coverage does not pass.
- Ads stale sets `can_recommend_ads_scale=false`.
- Finance stale blocks budget/loan/cashflow strong recommendations.
- Orders/payments stale set `can_conclude_profit=false`.
- Supplier/returns stale lower relevant conclusions according to approved policy.
- No provider mutation call; query containing `mutate` is rejected.
- No OpenAI/upload/action/import/dry-run/live execution call.
- No order sheet sync, statement payment sync, order recalculation or auto-control call.
- No secret/PII/raw provider error leakage.
- Source lock prevents duplicate provider sync.
- Export-job idempotency prevents duplicate official jobs.
- Timeouts/retries are bounded.
- Metadata `pre_export_sync` appears in every requested output pack.
- Snapshot/artifact checksums and audit facts are deterministic.
- Existing read-only GET endpoints remain side-effect-free.
- Focused build/tests plus explicit verification command in every sub-PR.

## 17. Questions for Director / BA Confirmation

1. Official export co block hoan toan neu configured Google Ads sync fail, hay cho `completed_with_warnings`?
2. Threshold chinh thuc cho ads, finance, orders, payments va CRM la bao nhieu?
3. Source nao critical theo tung pack; source nao optional?
4. Channel da configured nhung khong co spend/report-date rows duoc coi la zero, missing hay failed coverage?
5. Cached export co bao gio duoc dung cho quyet dinh that khong?
6. Ai duoc tao official, partial va cached export?
7. Manager co duoc tao partial Marketer export khong?
8. Investor co tiep tuc doc Director Pack khi bo sung supplier/commission/finance chi tiet khong?
9. Co can section-level RBAC truoc khi them supplier/tier-2/payroll data khong?
10. Finance stale co luon block official Director export khong?
11. Supplier settlement stale co block product/supplier scale khong?
12. Tier-2 agent commission co la critical input cua realized profit khong?
13. Return/refund stale co block official export hay chi block return-adjusted conclusions?
14. `MarketingLead` inferred tu chat/order co duoc chap nhan cho official sales analysis khong?
15. Operations current-status-only co duoc dung cho capacity conclusion khong?
16. Official export can report-date data, latest data, hay ca hai?
17. Artifact va audit retention bao lau?
18. Co cho phep provider sync partial theo account/channel hay phai all-or-nothing?
19. Threshold/policy version thay doi co can approval/audit rieng khong?
20. Sau PR-2.3B-2, co approve rieng Google Ads adapter truoc khi bat provider sync khong?

## 18. Final Recommendation

Nen tien den PR-2.3B, nhung khong code ngay trong Prompt 3 va khong bat provider sync trong sub-PR dau tien.

Thu tu de xuat:

1. ChatGPT Web Pro Extended review PR-2.3A.
2. Giam doc/BA approve source criticality, threshold, block policy, RBAC va retention.
3. Code PR-2.3B-1: ExportJob + cached wrapper only.
4. Code PR-2.3B-2: source registry + DB-only freshness gate.
5. Review/approve rieng truoc khi code PR-2.3B-3 Google Ads read-only adapter.

Tuyet doi chua code: Meta/TikTok/Zalo provider orchestration, external accounting, action import, generic dry-run, live execution, OpenAI/upload flows, provider mutation, auto-control, sheet write, payment/settlement mutation, hay Phase 3.

Default recommendation: khong tu code PR-2.3B cho toi khi ChatGPT Web Pro Extended review va giam doc approve technical spec.
