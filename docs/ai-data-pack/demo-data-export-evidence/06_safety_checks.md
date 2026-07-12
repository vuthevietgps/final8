# Safety Checks

Prompt 30 safety posture:

- No production DB target was used.
- No MongoDB apply/reset was executed.
- No broad delete/drop was executed.
- No external API was called.
- No Google/Facebook/TikTok provider API was called.
- No OpenAI/ChatGPT API was called.
- No OpenAI upload was added.
- No action import was added.
- No approval workflow was added.
- No dry-run/live ads execution was added.
- No provider mutation or provider `validateOnly` was added.
- No new provider adapter was added.
- Phase 3 was not started.

## Tests And Static Checks Run

Passed:

```powershell
$env:NODE_ENV='test'; $env:ALLOW_DEMO_SEED='1'; npm run seed:ai-data-pack:director:demo -- --dry-run --profile small
npm test -- --runTestsByPath src/ai-data-pack/demo-seed/director-demo-seed.spec.ts --runInBand
npm run build
```

Static checks:

```powershell
rg -n "fetch\(|axios|node-fetch|OpenAI|ActionImport|ExecutionService|ProviderValidationService|GoogleAds.*Mutat|upload_to_openai|import_action|execute_live" backend/src/ai-data-pack/demo-seed
```

Result: no matches.

```powershell
rg -n "deleteMany\(\{\}\)|dropDatabase|\.drop\(" backend/src/ai-data-pack/demo-seed
```

Result: no matches.

```powershell
rg -n "download-token|downloadToken" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts
```

Result: no matches.

Guard/write points observed in seed CLI:

- `NODE_ENV` guard present.
- `ALLOW_DEMO_SEED` guard present.
- `MONGODB_URI` required for apply/reset.
- `insertMany` exists only in apply path.
- `deleteMany` exists only with deterministic `_id` allowlist reset path.
