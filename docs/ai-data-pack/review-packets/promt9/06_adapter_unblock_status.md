# Adapter Unblock Status

`blocked_by_transport_integration=false`

The fail-closed raw sync blocker was removed because all required safety conditions for this phase are met:

- legacy searchStream calls use `GoogleAdsReadonlyTransportService`;
- legacy sync no longer builds raw GAQL;
- transport deadline is propagated from adapter to sync to wrapper;
- actual write telemetry is required and validated;
- adapter audit includes write telemetry summary;
- source guards still block forbidden dependencies;
- cached ExportJob and GET exports still do not call the adapter;
- focused tests use mocked transport and make no provider calls.

Current adapter raw sync binding:

```text
GOOGLE_ADS_READONLY_RAW_SYNC_PORT -> GoogleAdsReadonlySyncPortService -> GoogleAdsReadonlySyncService.syncWithTelemetry()
```

The adapter module still exports only `AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER` and does not import broad `GoogleAdsModule`.
