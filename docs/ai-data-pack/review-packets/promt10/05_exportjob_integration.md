# ExportJob Integration

`AiDataPackExportJobService` now exposes:

```ts
prepareSourcesForExportJob(input: SourceSyncPreparationInput): Promise<SourceSyncPreparationResult>
```

This is an internal delegate to `SourceSyncOrchestratorService`.

Preserved behavior:

- `createCachedExport()` does not call source-sync preparation.
- Cached jobs still use `exportMode=cached_export`.
- Cached jobs still use `syncPolicy=export_cached`.
- Cached jobs still store `providerSyncAttempted=false`.
- Cached jobs still do not enter a `syncing` state.
- Existing GET exports remain independent from ExportJob service.

Module-level provider wiring was not changed because `ai-data-pack.module.ts` is outside the allowed Prompt 10 implementation scope.
