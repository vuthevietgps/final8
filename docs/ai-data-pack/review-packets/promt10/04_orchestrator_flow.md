# Orchestrator Flow

`SourceSyncOrchestratorService.prepareSourcesForExportJob()`:

1. Normalizes `exportJobId`, `correlationId`, `policyVersion`, dates, pack types, source keys, customer IDs, and internal requester.
2. Runs DB-only pre-assessment through `FreshnessGateService.assessAll()`.
3. Decides whether Google Ads should call the adapter:
   - `export_cached`: skip.
   - `sync_if_stale`: skip if fresh and covered; otherwise call only when scope and permission are valid.
   - `sync_required`: same call policy, but unavailable/failed/not-fresh results become blocking reasons.
4. Calls the adapter only through `AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER`.
5. Re-runs DB-only post-assessment after any adapter invocation.
6. Builds source decisions, source impact, warnings, blocking reasons, and safety gates from post-assessment.

Adapter summaries are bounded and keep customer details out of the high-level result by reporting counts and categories rather than raw provider payloads.
