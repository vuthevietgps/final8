# ExportJob and Source Registry Integration Spec

This is a future flow specification only.

```text
create official/partial export job
-> assess google_ads through the existing DB-only source registry/gate
-> if policy allows sync and google_ads is stale or lacks required coverage
-> validate fail-closed customer scope
-> acquire distributed source/customer/date lock
-> call the narrow Google Ads read-only adapter
-> write approved local cache and durable sync-run audit only
-> release lock
-> re-run the existing DB-only freshness and coverage gate
-> apply decision and export eligibility policy
-> snapshot and export the Data Pack
```

## Existing components to reuse

- `SourceRegistryService`: keep `google_ads` as an internal allowlisted source.
- `FreshnessGateService`: reuse DB-only assessment before and after sync.
- `DbWatermarkService` and `CoverageGateService`: remain the source of truth for
  final freshness/coverage, not the adapter response alone.
- Existing Director, Marketer, Data Quality, and Mapping builders/exporters:
  reuse after a future job passes the correct gate.
- Existing cached ExportJob service: preserve unchanged semantics.

## Required future changes before integration

- Add official/partial job modes and lifecycle only in a separately approved PR.
- Add provider-sync audit/linkage fields without weakening cached-job invariants.
- Add a narrow adapter registry/factory that can return only approved read-only
  adapters by source key.
- Add source-sync policy, distributed lock, idempotency, timeout, retry, and
  sanitized sync-result persistence.
- Add post-sync freshness/coverage metadata and decision-gate impact to Data
  Quality output.
- Keep Mapping Report local/DB-only; Google sync may improve source data but
  must not mutate mappings.

## Export-mode behavior

### `cached_export`

- Must remain `cached_export=true`.
- Must keep `sync_policy=export_cached`.
- Must never call the adapter or any provider.
- Must keep `provider_sync_attempted=false` and current
  `freshness_gate_evaluated=false` until a separately approved cached behavior
  change.
- Decision claims remain cautious when freshness/coverage is not proven.

### Future `official_export`

- For ads-dependent claims, block when configured/required Google Ads is stale,
  missing, sync-failed, or lacks report-date coverage.
- `canRecommendAdsScale` remains false unless Google Ads, advertising costs, and
  product mapping are all fresh and covered/not-applicable as required.
- A fresh local timestamp with report-date coverage `0` does not pass.

### Future `partial_export`

- May complete only under an explicit approved policy.
- Must carry source-level sync failure/staleness/coverage warnings.
- Must disable affected strong decision gates, especially ads scale.
- Must not imply that missing/zero coverage is verified zero activity.

## Failure warning examples

- `google_ads_sync_failed_auth`
- `google_ads_sync_rate_limited`
- `google_ads_sync_timed_out`
- `google_ads_sync_partial_accounts`
- `google_ads_stale_after_sync`
- `google_ads_no_records_for_report_date`

Warnings must be sanitized and linked to the durable sync run, not raw provider
payloads.

