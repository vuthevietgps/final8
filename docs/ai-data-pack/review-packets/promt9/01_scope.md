# Scope

## Implemented

- Refactored `GoogleAdsReadonlySyncService` to use `GoogleAdsReadonlyTransportService`.
- Replaced legacy in-service GAQL strings with adapter-owned template IDs.
- Added `syncWithTelemetry()` for internal adapter use.
- Added validated write telemetry around sync-run, ad-account metadata, and Google Ads cache writes.
- Added `GoogleAdsReadonlySyncPortService` as the narrow adapter raw sync port.
- Added write telemetry summary persistence to source-sync audit.
- Expanded focused transport, query-template, write-telemetry, adapter, source-guard, and legacy sync tests.

## Not Implemented

- Official export.
- Partial export.
- Public endpoint.
- ExportJob source-sync integration.
- Provider validateOnly.
- Provider mutation.
- Action import, approval, dry-run, live execution.
- OpenAI/upload or Phase 3 work.

`blocked_by_scope=false`.
