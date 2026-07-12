# Tests And Static Checks

## Commands Run

```powershell
$env:NODE_ENV='test'; $env:ALLOW_DEMO_SEED='1'; npm run seed:ai-data-pack:director:demo -- --dry-run --profile small
npm test -- --runTestsByPath src/ai-data-pack/demo-seed/director-demo-seed.spec.ts --runInBand
npm run build
rg -n "fetch\(|axios|node-fetch|OpenAI|ActionImport|ExecutionService|ProviderValidationService|GoogleAds.*Mutat|upload_to_openai|import_action|execute_live" backend/src/ai-data-pack/demo-seed
rg -n "deleteMany\(\{\}\)|dropDatabase|\.drop\(" backend/src/ai-data-pack/demo-seed
rg -n "download-token|downloadToken" backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts
rg -n "MONGODB_URI|NODE_ENV|ALLOW_DEMO_SEED|deleteMany|insertMany" backend/src/ai-data-pack/demo-seed/director-demo-seed.ts
```

## Results

- Dry-run: passed.
- Unit test: passed, 5 tests.
- Build: passed.
- External/OpenAI/action/provider grep: no matches.
- Broad delete/drop grep: no matches.
- Download-token grep: no matches.
- Guard/write-point grep: confirms `NODE_ENV`, `ALLOW_DEMO_SEED`, `MONGODB_URI`, `insertMany`, and `deleteMany` are in the seed CLI.
