# Static Safety Checks

Passed:

```powershell
rg -n "OpenAIConfigService|ActionImportService|ActionImportController|ExecutionService|ProviderValidationService|GoogleAds[A-Za-z0-9_]*Mutation|GoogleAds[A-Za-z0-9_]*Mutate|GoogleAds[A-Za-z0-9_]*Service" backend/src/ai-data-pack/export-jobs/export-job.service.ts backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts
```

Result:

```text
static forbidden dependency check ok
```

Passed:

```powershell
rg -n "download-token|downloadToken" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts
```

Result:

```text
static tokenized download check ok
```

Passed:

```powershell
rg -n "artifacts/:artifactId/download|@Post\([^)]*download|download-token" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts
```

Result:

```text
direct route present; no POST download or download-token route
```

Passed:

```powershell
rg -n "setHeader\([^\r\n]*(storage|public|token|debug|provider|credential)" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts
```

Result:

```text
static response header exposure check ok
```

Expected matches only:

```powershell
rg -n "providerMutation|validateOnly|dryRun|liveExecution|openaiUpload|actionImport" backend/src/ai-data-pack/export-jobs/export-job.service.ts backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts
```

Result:

```text
matches are forbidden input denylists or false flags only
```
