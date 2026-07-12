# Write Telemetry

`actual_write_telemetry=implemented`

The legacy sync service now records validated telemetry for each successful local write in the current sync path.

Telemetry fields:

```text
targetCollection
operationType=insert|update|upsert
recordCount
deleteAttempted=false
sourceStep
```

Allowed sync targets:

- `adaccounts.approved_sync_metadata`
- `google_ads_campaigns`
- `google_ads_campaign_budgets`
- `google_ads_ad_groups`
- `google_ads_keywords`
- `google_ads_ads`
- `google_ads_daily_metrics`
- `google_ads_sync_runs`

The adapter rejects:

- missing telemetry;
- forbidden targets;
- delete attempts;
- action/execution/evaluation/business-control targets.

The adapter result now includes `writeTelemetrySummary`, and `SourceSyncAuditService` persists that summary into `ai_data_pack_source_sync_audits`.

This is sufficient for the current legacy sync path. It is not claimed as a global database write firewall outside this service.
