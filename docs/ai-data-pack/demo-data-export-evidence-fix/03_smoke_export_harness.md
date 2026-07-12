# Smoke Export Harness

This document records the repeatable dev/test smoke flow used for Prompt 32.

## Safety Target

Only the local Docker demo MongoDB database was used:

`mongodb://127.0.0.1:27018/aidp_demo_20260614`

Do not point this flow at any production/server database. Keep `NODE_ENV=test` and `ALLOW_DEMO_SEED=1` for demo seed operations.

## Repeatable Steps

1. Run seed dry-run on the small profile.

```powershell
$env:NODE_ENV='test'
$env:ALLOW_DEMO_SEED='1'
npm run seed:ai-data-pack:director:demo -- --dry-run --profile small
```

2. Apply the medium demo seed to the local Docker demo DB.

```powershell
$env:NODE_ENV='test'
$env:ALLOW_DEMO_SEED='1'
$env:MONGODB_URI='mongodb://127.0.0.1:27018/aidp_demo_20260614'
npm run seed:ai-data-pack:director:demo -- --apply --profile medium
```

3. Run the same medium apply command a second time to verify idempotent reset/reinsert behavior.

4. Execute a Director `partial_export` with:

- `sync_policy=sync_if_stale`
- `redaction_profile=director_redacted`
- no provider sync
- no live execution

5. Download the Director JSON artifact through the export endpoint service.

6. Parse the downloaded JSON.

7. Check all expected demo finding labels are present.

## Known Harness Limitation

The Prompt 32 smoke export still used the compiled backend output under `backend/dist` with a minimal Nest application context. This is the same limitation observed in prior work: the source `ts-node` path still has Mongoose schema metadata issues for union fields in the full module load.

The compiled smoke harness is dev/test only. It does not call OpenAI, does not import actions, does not execute provider validation, and does not mutate Google Ads.

