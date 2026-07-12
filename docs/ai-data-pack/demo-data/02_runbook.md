# Demo Seed Runbook

All commands below must be run from `backend/`.

## Dry Run

```powershell
$env:NODE_ENV='test'
$env:ALLOW_DEMO_SEED='1'
npm run seed:ai-data-pack:director:demo -- --dry-run --profile small
```

Dry-run generates and prints only sanitized counts/collection summaries. It does not require `MONGODB_URI` and does not write to MongoDB.

## Apply To A Dev/Test Database

```powershell
$env:NODE_ENV='test'
$env:ALLOW_DEMO_SEED='1'
$env:MONGODB_URI='mongodb://127.0.0.1:27017/your-dev-db'
npm run seed:ai-data-pack:director:demo -- --apply --profile medium
```

Apply behavior:

1. Builds the large-profile deterministic reset allowlist.
2. Deletes only those demo `_id`s from the mapped collections.
3. Inserts the selected profile.

This makes apply idempotent for the demo id space.

## Reset Demo Records

```powershell
$env:NODE_ENV='test'
$env:ALLOW_DEMO_SEED='1'
$env:MONGODB_URI='mongodb://127.0.0.1:27017/your-dev-db'
npm run seed:ai-data-pack:director:demo -- --reset-demo
```

Reset behavior:

- Deletes only deterministic demo `_id` allowlists.
- Does not call `dropDatabase`, collection `drop`, or broad `deleteMany({})`.
- Does not delete non-demo production-like records.

## Guard Failure Examples

These should fail:

```powershell
$env:NODE_ENV='production'
$env:ALLOW_DEMO_SEED='1'
npm run seed:ai-data-pack:director:demo -- --dry-run --profile small
```

```powershell
$env:NODE_ENV='test'
Remove-Item Env:\ALLOW_DEMO_SEED -ErrorAction SilentlyContinue
npm run seed:ai-data-pack:director:demo -- --dry-run --profile small
```

## Verification Commands

```powershell
npm test -- --runTestsByPath src/ai-data-pack/demo-seed/director-demo-seed.spec.ts --runInBand
npm run build
rg -n "fetch\\(|axios|node-fetch|OpenAI|ActionImport|ExecutionService|ProviderValidationService|GoogleAds.*Mutat|upload_to_openai|import_action|execute_live" .\backend\src\ai-data-pack\demo-seed
rg -n "deleteMany\\(\\{\\}\\)|dropDatabase|\\.drop\\(" .\backend\src\ai-data-pack\demo-seed
```
