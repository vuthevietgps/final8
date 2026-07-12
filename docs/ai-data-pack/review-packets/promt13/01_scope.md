# 01 Scope

Changed code stayed inside the allowed Prompt 13 areas:

- `backend/src/ai-data-pack/export-jobs/`
- `backend/src/ai-data-pack/rbac/`
- `backend/src/ai-data-pack/redaction/`
- `backend/src/ai-data-pack/ai-data-pack.module.ts`

No controller route was added or changed.

Reused modules:

- `AiDataPackExportJobService`
- `ExportJobArtifactService`
- `JsonExporterService`
- `DataPackMetadataService`
- `SourceSyncOrchestratorService.prepareSourcesForExportJob()`

Out of scope and not implemented:

- public endpoints
- download endpoints or tokens
- OpenAI upload
- action import
- approval workflow
- dry-run/live execution
- provider mutation
- Performance Max, Shopping, Display, YouTube
- delete campaign/ad group actions
