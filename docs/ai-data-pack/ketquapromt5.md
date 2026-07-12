# Ket qua Prompt 5 - PR-2.3B-2 Source Registry + DB-only Freshness/Coverage Gate

## 1. Executive Summary

PR-2.3B-2 is completed within the authorized DB-only scope.

- Added an internal allowlisted source registry for 19 required sources.
- Added direct read-only MongoDB watermark assessment without injecting provider, sync, mutation, payment, sheet, recalculation, action or execution services.
- Added separate report-date/date-range coverage assessment.
- Added conservative decision gates for ads scale, profit, sales, finance and LTV.
- Unsupported, missing, unknown and not-configured sources are never classified as fresh.
- Fresh data without report-date coverage is not considered strong-decision ready.
- Cached ExportJob remains unchanged with `freshness_gate_evaluated=false`.
- Existing GET controller remains unchanged and side-effect-free.
- No public endpoint, official/partial export, provider adapter or live/action flow was added.

Final verification:

- `npm run build`: passed.
- `npm test -- --runInBand source-registry`: passed, 1 suite / 10 tests.
- `npm test -- --runInBand export-job`: passed, 1 suite / 10 tests.
- `npm test -- --runInBand ai-data-pack`: passed, 4 suites / 40 tests.
- Prettier check for touched code: passed.

## 2. Scope Control

Included:

- Static internal source registry with source criticality/relevance, default thresholds, evidence methods and DB read definitions.
- DB-only freshness/watermark service.
- DB-only report-date/date-range coverage service.
- Internal combined freshness/coverage and decision gate service.
- Focused tests, security guards and Prompt 5 reports.
- Internal DI wiring in `AiDataPackModule`.

Excluded and not implemented:

- Google Ads, Meta, TikTok, Zalo or any provider API call.
- Provider read-only adapter or provider sync orchestration.
- Official export, partial export or automatic cached-export freshness evaluation.
- Public endpoint, RBAC, status polling or download.
- Action import, generic dry-run or live execution.
- Provider mutation, sheet write/clear, payment/settlement mutation, order recalculation or auto-control.
- OpenAI/upload work, new BA domains, SQL migration and Phase 3.

`blocked_by_scope=false`.

The PR-2.3B-1 BA addendum was reviewed from
`C:\Users\PC\Downloads\ba-pr-2-3b-1-exportjob-cached-wrapper-addendum.md`.
No separate ChatGPT Web Prompt 4 approval artifact was found; Prompt 5 supplied the explicit authorization for PR-2.3B-2.

## 3. Files Changed

Code and tests:

- `backend/src/ai-data-pack/source-registry/source-registry.types.ts`
- `backend/src/ai-data-pack/source-registry/source-registry.service.ts`
- `backend/src/ai-data-pack/source-registry/db-watermark.service.ts`
- `backend/src/ai-data-pack/source-registry/coverage-gate.service.ts`
- `backend/src/ai-data-pack/source-registry/freshness-gate.service.ts`
- `backend/src/ai-data-pack/source-registry/source-registry.service.spec.ts`
- `backend/src/ai-data-pack/ai-data-pack.module.ts`

Reports:

- `docs/ai-data-pack/ketquapromt5.md`
- `docs/ai-data-pack/ketquapromt5.json`
- `docs/ai-data-pack/review-packets/promt5/*`

No Prompt 5 change was made to `ai-data-pack.controller.ts`, cached ExportJob source, existing export builders, provider modules or action/execution modules.

## 4. Source Registry Implemented

The registry contains:

```text
google_ads
meta_ads
tiktok_ads
zalo_ads
advertising_costs
crm_leads
orders
payments_or_order_payments
finance
loans_debt
operations
product_mapping
decision_history
external_market
supplier_settlement
return_refund
customer_referral
employee_activity_payroll
system_settings
```

Every source records:

```text
domain
business importance
pack relevance
default max staleness
freshness method
coverage method
readOnlyDbOnly=true
providerSyncAllowedInThisPr=false
mutationAllowed=false
availability and evidence notes
```

Unsupported sources are explicit: `zalo_ads`, `external_market`, `customer_referral` and `employee_activity_payroll`. They are never promoted to fresh. `system_settings` becomes `not_configured` when no local configuration row exists.

## 5. DB-only Freshness/Coverage Gate Implemented

Freshness and coverage are evaluated separately.

Freshness evidence:

- Successful Google Ads sync-run completion plus local Google daily metric watermarks.
- Local `max(updatedAt)`, `lastSyncAt` or latest record date for confirmed collections.
- Static configuration timestamp for system settings.
- No provider call and no service with sync/apply/execute/recalculate/write capability is injected.

Coverage evidence:

- `report_date_count` for daily/event sources.
- `date_range_count` for loan and supplier statement ranges.
- `not_applicable` for static mapping/config sources.
- `unsupported` for unsupported sources.

Assessment output includes source status, separate freshness and coverage status, timestamps/counts, threshold calculations, evidence, warnings, blocking reasons and `canUseForDecision`.

Example enforced by test:

```text
latest local row is fresh
+ no record for report_date
=> freshnessStatus=fresh
=> coverageStatus=no_records_for_report_date
=> canUseForDecision=cautious
```

## 6. Decision Gate Impact

Internal decision gates:

```text
canRecommendAdsScale
canConcludeProfitStrongly
canEvaluateSalesToday
canEvaluateFinanceStrongly
canUseLtvStrongly
canGenerateActionDraft
canImportActionFile=false
canDryRun=false
canExecuteLive=false
```

Conservative rules:

- Ads scale requires fresh/covered Google Ads, advertising costs and product mapping.
- Strong profit requires fresh/covered orders, order-payment evidence and advertising costs.
- Sales-today evaluation requires fresh/covered CRM leads.
- Strong finance evaluation requires fresh/covered finance and loans/debt.
- Strong LTV requires fresh/covered customer referral and product mapping; it remains false while customer referral is unsupported.
- Action draft remains possible, but no import/dry-run/live authority is created.

## 7. Cached Export Semantics Preserved

Prompt 5 did not integrate the new gate into cached ExportJob.

Cached behavior remains:

```text
export_mode=cached_export
sync_policy=export_cached
cached_export=true
provider_sync_attempted=false
freshness_gate_evaluated=false
live_execution=false
```

The existing GET controller does not reference the source registry or freshness gate and has no POST route.

## 8. Security / No-provider / No-mutation Guard

Production source only uses:

- `SourceRegistryService`.
- Direct Mongoose `Connection.collection(...).findOne/countDocuments` reads.
- Internal watermark, coverage and decision-gate services.

It does not inject or call:

- Provider API/sync services.
- `DataCollectionService` or `OrderSheetSyncService`.
- Payment/statement/settlement mutation.
- Order recalculation or auto-control.
- Action validation/execution or live execution.
- OpenAI/upload services.

DB read errors are converted to generic warnings. Raw error text, stack traces, secrets, tokens and PII are not returned in assessments. Focused tests prove provider-like secret/error text is not leaked.

## 9. Tests Run

```text
cd backend
npm run build
```

Passed.

```text
npm test -- --runInBand source-registry
```

Passed: 1 suite / 10 tests.

```text
npm test -- --runInBand export-job
```

Passed: 1 suite / 10 tests.

```text
npm test -- --runInBand ai-data-pack
```

Passed: 4 suites / 40 tests.

```text
npx prettier --check "src/ai-data-pack/source-registry/*.ts" "src/ai-data-pack/ai-data-pack.module.ts"
```

Passed.

Full repository tests and live/local database assessment were not run.

## 10. Acceptance Checklist

| Item | Status | Evidence |
|---|---|---|
| Minimum source registry present | passed | 19-source registry test |
| Unsupported/not-configured never fresh | passed | focused tests |
| DB-only fresh/stale/missing works | passed | focused watermark fixtures |
| Covered versus no-report-date distinguished | passed | focused coverage fixtures |
| Fresh without coverage is not strong-ready | passed | cautious assessment test |
| Ads stale/missing blocks scale | passed | decision gate test |
| Finance stale/missing blocks strong finance | passed | decision gate test |
| Orders/payments stale/missing blocks strong profit | passed | decision gate test |
| Import/dry-run/live remain false | passed | decision gate test |
| No provider service injected/called | passed | source guard and dependency design |
| Cached ExportJob freshness remains false | passed | source guard and ExportJob regression |
| Existing GET remains side-effect-free | passed | controller source guard and regression |
| No secret/PII/raw error leakage | passed | failing DB read test |

## 11. Risks and Assumptions

- Default staleness thresholds remain proposed defaults pending final Director/BA approval.
- Some collection names rely on confirmed Mongoose default pluralization rather than explicit `collection` options.
- Several sources only prove local DB activity through `max(updatedAt)`; they do not prove provider or external-system synchronization.
- Meta/TikTok use local `advertisingcosts` evidence only.
- Payments use partial order-level payment evidence because no canonical payment ledger was confirmed.
- Operations uses current order state and has no durable SLA/status history.
- Supplier settlement criticality remains pending approval.
- Fresh data may still lack report-date coverage or mapping/completeness.
- There is no public endpoint/RBAC/download, official/partial export, provider adapter or snapshot integration.
- Full repository tests and real DB assessment were not run.

## 12. Next Recommendation

Stop after PR-2.3B-2.

If this phase is separately reviewed and approved, the only recommended next phase is:

```text
PR-2.3B-3A - Google Ads Read-only Adapter Technical Spec / Security Review, no code
```

Do not start provider adapter code, official/partial export, endpoint/RBAC/download, action/live execution or Phase 3 without separate authorization.
