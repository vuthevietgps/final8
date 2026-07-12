# Google Ads Inventory

## Primary read-only sync

| Item | Current implementation |
|---|---|
| Service | `backend/src/google-ads/google-ads-readonly-sync.service.ts` / `GoogleAdsReadonlySyncService` |
| Public methods | `sync(params)` and `getLatestRun()` |
| Provider endpoint | `POST .../customers/{customerId}/googleAds:searchStream` |
| Provider resources | customer, campaign, campaign budget, ad group, keyword view, responsive search ads, campaign/ad-group/keyword/ad daily metrics |
| Provider mutation | None in this class |
| Local writes | `adaccounts`, `google_ads_campaigns`, `google_ads_campaign_budgets`, `google_ads_ad_groups`, `google_ads_keywords`, `google_ads_ads`, `google_ads_daily_metrics`, `google_ads_sync_runs` |
| Scope | Active local Google ad accounts, optionally filtered by requested customer IDs |
| Audit | Durable sync run with status, dates, customer IDs, counts, sanitized errors, and completion time |
| Tests | Metrics mapping, read query contents, and rejection of a query containing `mutate` before credential load |

The service updates `adaccounts.lastSyncAt`, `lastSyncStatus`, and
`lastSyncError`; all entity and metric upserts carry `lastSyncAt`. The sync-run
model records `running|success|partial|failed`, counts, and errors.

## Current callers

| Caller | Behavior | Pre-export decision |
|---|---|---|
| `GoogleAdsController.syncReadonly()` | Manual provider sync through `POST /google-ads/sync/readonly` | Do not call; broad route permission and controller/module surface |
| `GoogleAdsEvaluationService.evaluateJob()` | Syncs evaluation windows, then writes evaluation state | Execution/evaluation path; do not call |
| `GoogleAdsPostExecutionService.handleSuccessfulExecution()` | Syncs after live mutation, then writes change/evaluation records | Execution path; do not call |

`GoogleAdsEvaluationService.runEvaluationCron()` runs hourly. The primary
read-only sync service itself has no cron decorator.

## Other Google provider reads

| Service | Read behavior | Concern |
|---|---|---|
| `AdvertisingCostGoogleSyncService` | Uses `searchStream`, writes `advertisingcosts` | Cron helper can schedule business recalculation; no durable Google sync run; weaker error redaction |
| `EmergencyActionVerificationService` | Uses `searchStream` to verify emergency task results | Emergency-action semantics, mixed-provider class, and raw error/detail exposure |
| `AdAccountTimezoneCheckService` | Reads Google customer timezone | Coupled to ad-account create/update validation, not data-pack sync |
| `GoogleAdsExportService` | Reads local MongoDB and writes local ZIP/export audit | No provider read; not an adapter candidate |

## Mutation and execution inventory

- `GoogleAdsOperationBuilderService`: builds create/update/pause/resume mutate
  operations.
- `GoogleAdsProviderValidationService`: calls `googleAds:mutate` with
  `validateOnly=true` and writes action-plan validation state.
- `GoogleAdsExecutionService`: calls `googleAds:mutate` with
  `validateOnly=false`, writes execution logs, and starts post-execution work.
- `GoogleAdsActionPlanImportService`, `GoogleAdsActionPlanService`,
  `GoogleAdsActionApprovalPolicyService`, and `GoogleAdsExecutionPolicyService`:
  action pipeline; never pre-export dependencies.
- `AdGroupAutoControlService.pauseGoogleAdGroup()`: calls `adGroups:mutate`.
- `BudgetApplyService`: calls Google Ads mutation endpoints.

## Current gaps

- No request timeout or total sync deadline.
- No retry/backoff or explicit rate-limit handling.
- No distributed lock or provider-sync idempotency.
- No explicit maximum range or `dateFrom <= dateTo` policy.
- Unknown requested customer IDs produce no match rather than a fail-closed
  scope error.
- No dedicated customer/login-customer allowlist at the sync boundary.
- A failure before final sync-run update can leave a run in `running`.
- No export-job linkage or per-account durable result.
- No transport-level test proving that only `searchStream` can be called.

