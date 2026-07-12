# QA Runtime Manifest Summary

- Executed at: `2026-04-24 20:11:07 +07`
- Scope: close the cross-shell/container external-backend bootstrap gap by introducing a runtime manifest contract that can carry backend base URLs, Mongo target, and runner-visible DB-06 media coupling without guessing remote state

## Environment

- External backend used for this round:
  - backend base URL: `http://localhost:61121/api`
  - backend health: `http://localhost:61121/health`
  - mongo: `mongodb://127.0.0.1:27017/htxbachgia_manifest_contract_20260424195809`
  - backend media root: `tests/backend/artifacts/results/tmp-runtime-contract-media-20260424195809`

## Code Change Verified

- `tests/backend/setup/backend-runtime-manifest.ps1`
  - imports `BACKEND_RUNTIME_MANIFEST`
  - applies manifest values only when explicit shell env is absent
  - resolves `db06MediaDir` for runner-visible DB-06 coupling
- `tests/backend/runners/write-backend-runtime-manifest.ps1`
  - writes the machine-readable external-backend contract used in this round
- `tests/backend/runners/run-backend-module-regression.ps1`
  - consumes the runtime manifest before backend/auth/DB06 resolution
  - reports the manifest path and the fields it applied
- `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1`
  - consumes the runtime manifest before external-backend coupling preflight
  - preserves `BLOCKED` semantics when coupling is still incomplete

## Audit Trail

- Pre-fix direct DB-06 reproduction:
  - command: `module.db-seed-cleanup.ps1`
  - runner shell env: `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, `MONGODB_URI`, `BACKEND_RUNTIME_MANIFEST`
  - result: `BLOCKED`
  - counters: `0 PASS / 0 FAIL / 1 BLOCKED`
  - root symptom: manifest file existed and already contained `db06MediaDir`, but the suite still blocked because the harness did not consume it
  - log: `tests/backend/artifacts/results/module.db-seed-cleanup-runtime-manifest-prefix-20260424.log`
- Post-fix direct DB-06 rerun:
  - command: `module.db-seed-cleanup.ps1`
  - runner shell env: `BACKEND_RUNTIME_MANIFEST` only
  - result: `BLOCKED -> FIXED_HARNESS -> PASSED`
  - counters: `51 PASS / 0 FAIL / 0 BLOCKED`
  - log: `tests/backend/artifacts/results/module.db-seed-cleanup-runtime-manifest-rerun-20260424.log`
- Canonical full regression with complete manifest:
  - command: `run-backend-module-regression.ps1`
  - runner shell env: `BACKEND_RUNTIME_MANIFEST` only
  - manifest: `tests/backend/artifacts/results/runtime-contract-pass-20260424.json`
  - result: `PASSED`
  - counters: `1163 PASS / 0 FAIL / 0 BLOCKED`
  - modules: `25/25`
  - log: `tests/backend/artifacts/results/module-regression-runtime-manifest-rerun-20260424.log`
  - json: `tests/backend/artifacts/results/module-regression-20260424-200127.json`
- Canonical strictness verification with incomplete manifest:
  - command: `run-backend-module-regression.ps1`
  - runner shell env: `BACKEND_RUNTIME_MANIFEST` only
  - manifest: `tests/backend/artifacts/results/runtime-contract-blocked-20260424.json`
  - result: `BLOCKED`
  - counters: `1112 PASS / 0 FAIL / 1 BLOCKED`
  - blocked module: `DB Seed Cleanup`
  - log: `tests/backend/artifacts/results/module-regression-runtime-manifest-blocked-20260424.log`
  - json: `tests/backend/artifacts/results/module-regression-20260424-200646.json`

## Notes

- Manifest writer outputs used in this round:
  - `tests/backend/artifacts/results/runtime-contract-pass-20260424.json`
  - `tests/backend/artifacts/results/runtime-contract-blocked-20260424.json`
- `tests/backend/artifacts/results/module-regression-latest.json` now points to the intentional blocked verification at `2026-04-24 20:06:46 +07`.
- The latest green canonical artifact from this round is preserved separately at `tests/backend/artifacts/results/module-regression-20260424-200127.json`.
- Same-shell `MEDIA_DIR -> DB06_MEDIA_DIR` alias behavior remains intact for the legacy external-backend path; the runtime manifest simply adds a safer cross-shell/container contract.
