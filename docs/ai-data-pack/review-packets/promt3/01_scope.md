# Scope

## Included

- Read prior Prompt 1/2 reports, sample v2 outputs and BA Master.
- Inspect current AI Data Pack, provider sync, local domain models/services, schedulers and RBAC.
- Inventory source support, freshness evidence, sync availability and mutation risk.
- Specify official/partial/cached export behavior.
- Specify future ExportJob lifecycle, source registry, locks, snapshots, metadata, data quality and permissions.
- Plan PR-2.3B in small reviewable sub-PRs.

## Excluded

- Source code edits, migrations, schemas/models and endpoints.
- Provider API calls or real sync runs.
- Provider or business-state mutation.
- OpenAI key/integration, upload normalization, action-file import, generic dry-run and live execution.
- Database changes.
- PR-2.3B and Phase 3 implementation.

## Out-of-scope paths explicitly rejected

- Calling `DataCollectionService` from pre-export because it syncs provider cost and recalculates orders/reports.
- Calling `OrderSheetSyncService` because it writes/clears Google Sheets.
- Calling statement payment, close/reopen or sync-to-order methods.
- Calling ad-group auto-control, budget apply, validation/execution or mutation-capable Google Ads services.
- Treating a timestamp, unsupported source or missing configuration as proof of fresh data.

The working tree already contains unrelated/untracked changes. They were observed and not modified.
