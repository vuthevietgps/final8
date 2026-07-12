# QA Runner Bootstrap Summary

- Executed at: `2026-04-24 19:19:52 +07`
- Scope: canonical backend module runner bootstrap/env closure for DB-06 media-root coupling and lane-level `BLOCKED` propagation
- Environment:
  - external backend: `http://localhost:3884/api`
  - health: `http://localhost:3884/health`
  - mongo: `mongodb://127.0.0.1:27017/htxbachgia_runner_bootstrap_20260424_190832`
  - backend media root: `tests/backend/artifacts/results/tmp-runner-bootstrap-media-20260424-190832`
  - suite shell intentionally omitted `DB06_MEDIA_DIR` in every probe

## Code Change Verified

- `tests/backend/runners/run-backend-module-regression.ps1`
  - aliases `MEDIA_DIR -> DB06_MEDIA_DIR` for the local same-shell external-backend flow
  - parses structured `BLOCKED` summaries with `FAIL` higher priority than `BLOCKED`
  - writes per-module and total `Blocked` counts into canonical JSON artifacts

## Executions

- Direct suite audit:
  - command: `module.db-seed-cleanup.ps1`
  - result: `BLOCKED`
  - counters: `0 PASS / 0 FAIL / 1 BLOCKED`
  - purpose: confirm direct DB-06 still fail-fast blocks without explicit `DB06_MEDIA_DIR`
  - log: `tests/backend/artifacts/results/module.db-seed-cleanup-blocked-20260424-runner-bootstrap.log`

- Canonical green verification:
  - command: `run-backend-module-regression.ps1`
  - runner shell env: `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `MONGODB_URI`, `MEDIA_DIR`; `DB06_MEDIA_DIR` omitted
  - result: `PASSED`
  - counters: `1163 PASS / 0 FAIL / 0 BLOCKED`
  - modules: `25/25`
  - log: `tests/backend/artifacts/results/module-regression-rerun-20260424-runner-bootstrap.log`
  - json: `tests/backend/artifacts/results/module-regression-20260424-190919.json`

- Canonical blocked verification:
  - command: `run-backend-module-regression.ps1`
  - runner shell env: `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `MONGODB_URI`; both `MEDIA_DIR` and `DB06_MEDIA_DIR` removed
  - result: `BLOCKED`
  - counters: `1112 PASS / 0 FAIL / 1 BLOCKED`
  - blocked module: `DB Seed Cleanup`
  - purpose: verify canonical lane now preserves `BLOCKED` instead of coercing the env signal into `FAIL`
  - log: `tests/backend/artifacts/results/module-regression-blocked-20260424-runner-bootstrap.log`
  - json: `tests/backend/artifacts/results/module-regression-20260424-191547.json`

## Notes

- Historical same-day audit remains:
  - `tests/backend/artifacts/results/module-regression-rerun-20260424-objectid-20260424-1840.log`
  - status: `FAILED_ENV`, `1160 PASS / 2 FAIL`
- `tests/backend/artifacts/results/module-regression-latest.json` now points to the latest actual canonical run, which is the intentional `BLOCKED` verification at `2026-04-24 19:15:47 +07`.
- The latest green canonical artifact from this round is kept separately at `tests/backend/artifacts/results/module-regression-20260424-190919.json`.
