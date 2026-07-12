# Dependency Boundary

## Reused Boundary

The only allowed underlying provider service is `GoogleAdsReadonlySyncService`, bound behind `GOOGLE_ADS_READONLY_SYNC_PORT`.

`GoogleAdsReadonlyAdapterModule`:

- Does not import broad `GoogleAdsModule`.
- Imports `ApiTokenModule`.
- Directly registers only `AdAccount` and the read-only Google cache/sync-run models.
- Exports only `AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER`.

## Isolation Guards

Source tests reject references to operation builder, provider validation, execution, post-execution, evaluation, action-plan, emergency-action, auto-control, budget-apply, and advertising-cost sync services.

Source tests also prove the adapter is not wired into:

- `AiDataPackModule`
- cached ExportJob
- public AI data pack controller

Conclusion: `blocked_by_dependency_boundary=false`.

