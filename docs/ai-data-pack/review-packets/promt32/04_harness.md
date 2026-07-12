# Harness

Prompt 32 used the safe local demo DB:

`mongodb://127.0.0.1:27018/aidp_demo_20260614`

Harness sequence:

1. Seed dry-run small.
2. Seed apply medium.
3. Seed apply medium again for idempotency.
4. Director `partial_export` with `sync_if_stale` and `director_redacted`.
5. Artifact download.
6. JSON parse.
7. Expected finding check.

The smoke export used compiled `backend/dist` with a minimal Nest application context because the source `ts-node` full module path still has known Mongoose schema metadata limitations for union fields.

