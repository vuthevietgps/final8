# Tests And Static Checks

Focused endpoint tests:

```powershell
npm test -- --runInBand export-job-endpoint.controller.spec.ts
```

Result:

- Passed.
- 1 suite passed.
- 32 tests passed.

AI Data Pack suite:

```powershell
npm test -- --runInBand ai-data-pack
```

Result:

- Passed.
- 15 suites passed.
- 136 tests passed.

Backend build:

```powershell
npm run build
```

Result:

- Passed.

Static safety grep:

```powershell
rg -n "download-token|@(Get|Post|Put|Patch|Delete)\([^\n]*download|/download" backend/src/ai-data-pack
```

Result:

- Expected matches only.
- Matches were in `export-job-endpoint.controller.spec.ts` assertions proving no download/download-token route.

Static forbidden surface grep:

```powershell
rg -n "upload_to_openai|import_action|execute_live|dry_run|validateOnly|provider mutation route|artifactBytes|downloadToken|publicUrl|storageLocation|storageKey" backend/src/ai-data-pack/export-jobs backend/src/ai-data-pack/audit backend/src/ai-data-pack/rbac backend/src/ai-data-pack/observability
```

Result:

- Expected matches only.
- Matches were in tests, audit/redactor denylists, and internal artifact/manifest metadata.
- No public endpoint exposure found.

Public endpoint provider dependency grep:

```powershell
rg -n "GoogleAds|ProviderValidation|OpenAI|ActionImport|ExecutionService|mutate|validateOnly" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts
```

Result:

- No matches.
