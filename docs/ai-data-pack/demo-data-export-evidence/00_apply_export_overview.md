# Prompt 30 Apply And Export Overview

Phase: `PR-DEMO-1B - Apply Demo Seed and Export Director Data Pack Evidence, Dev/Test Only`.

Status: `blocked_missing_safe_throwaway_mongodb_uri`.

Prompt 30 did not apply the demo seed, did not reset demo data, did not run Director export, and did not download a JSON artifact because no safe throwaway `MONGODB_URI` was present in the execution environment.

## Safety Decision

Environment check:

```json
{
  "MONGODB_URI_exists": false,
  "MONGODB_URI_db_name": "",
  "contains_unsafe_keyword": false
}
```

Prompt 30 requires:

- `NODE_ENV !== production`
- `ALLOW_DEMO_SEED=1`
- `MONGODB_URI` exists
- `MONGODB_URI` points to a disposable/dev/test DB
- URI must not contain `prod`, `production`, `live`, or `main` unless explicitly proven safe

Because `MONGODB_URI` does not exist, apply/reset/export/download were intentionally skipped.

## What Was Executed

Safe local checks only:

- Seed dry-run, profile `small`
- Demo seed unit test
- Backend build
- Static safety greps

## What Was Not Executed

- `--apply --profile medium`
- Second apply idempotency run
- `--reset-demo`
- Director AI Data Pack export from applied demo records
- JSON artifact download
- Expected AI finding check against an exported JSON artifact

No evidence was faked.
