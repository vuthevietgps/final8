# Tests And Static Checks

## Tests And Build

| Command | Status | Result |
|---|---|---|
| `npm test -- --runTestsByPath src/ai-data-pack/demo-seed/director-demo-seed.spec.ts --runInBand` | `passed` | `5 tests passed` |
| `npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand` | `passed` | `19 tests passed` |
| `npm run build` | `passed` | `Nest backend build completed` |

Export job tests were not required because Prompt 32 did not change export job source files.

## Static Safety Checks

The broad Prompt 32 static check returned existing matches in read-only provider adapter/test guard strings and explicit false capability fields:

```powershell
rg -n "fetch\(|axios|node-fetch|OpenAI|ActionImport|ExecutionService|ProviderValidationService|GoogleAds.*Mutat|upload_to_openai|import_action|execute_live" backend/src/ai-data-pack
```

These were reviewed as existing matches, not Prompt 32 additions.

Changed-file/runtime checks were clean:

| Check | Status |
|---|---|
| Prompt 32 diff contains no OpenAI/action/provider mutation/live execution patterns | `passed` |
| Changed runtime files contain no OpenAI/action/provider mutation/live execution patterns | `passed` |
| Demo seed contains no `deleteMany({})`, `dropDatabase`, or `.drop(` pattern | `passed` |
| Export endpoint files contain no `download-token` or `downloadToken` pattern | `passed` |

## Guardrail Result

Prompt 32 added no OpenAI upload, no action import, no approval workflow, no dry-run/live provider execution, no provider mutation, no provider validateOnly, no new provider adapter, and no Phase 3 work.

