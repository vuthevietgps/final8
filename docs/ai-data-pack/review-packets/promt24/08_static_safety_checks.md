# Static Safety Checks

Passed:

```powershell
$matches = rg -n "download-token|downloadToken|OpenAIConfigService|ActionImport|ExecutionService|ProviderValidationService|GoogleAds.*Mutat|upload_to_openai|import_action|execute_live" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts; if ($LASTEXITCODE -eq 0) { $matches; exit 1 } elseif ($LASTEXITCODE -eq 1) { "static forbidden integration check ok" } else { exit $LASTEXITCODE }
```

Passed:

```powershell
$route = rg -n "artifacts/:artifactId/download|@Post\([^)]*download|download-token" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts; $route; if ($route -match "@Post|download-token") { exit 1 } if ($route -notmatch "artifacts/:artifactId/download") { exit 1 } "static direct route check ok"
```

Passed:

```powershell
$matches = rg -n "setHeader\([^\r\n]*(storage|public|token|debug|provider|credential)" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts; if ($LASTEXITCODE -eq 0) { $matches; exit 1 } elseif ($LASTEXITCODE -eq 1) { "static response header exposure check ok" } else { exit $LASTEXITCODE }
```

Static result:

```text
No tokenized route.
No forbidden OpenAI/action/live/provider integration.
Direct download route exists.
No unsafe storage/public/token/debug/provider/credential response headers.
```
