# Static Safety Checks

Passed:

```powershell
rg -n "OpenAIConfigService|ActionImportService|ActionImportController|ExecutionService|ProviderValidationService|GoogleAds[A-Za-z0-9_]*Mutation|GoogleAds[A-Za-z0-9_]*Mutate|GoogleAds[A-Za-z0-9_]*Service" src/ai-data-pack/export-jobs/export-job.service.ts src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts src/ai-data-pack/export-jobs/export-job-endpoint.service.ts
```

Result:

```text
static forbidden dependency check ok
```

Passed:

```powershell
rg -n "download-token|downloadToken" src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts src/ai-data-pack/export-jobs/export-job-endpoint.service.ts
```

Result:

```text
static tokenized download check ok
```

Passed:

```powershell
rg -n "setHeader\([^\r\n]*(storage|public|token|debug|provider|credential)" src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts
```

Result:

```text
static response header exposure check ok
```

Passed:

```powershell
node -e "JSON.parse(require('fs').readFileSync('../docs/ai-data-pack/ketquapromt26.json','utf8')); console.log('ketquapromt26.json ok')"
```

