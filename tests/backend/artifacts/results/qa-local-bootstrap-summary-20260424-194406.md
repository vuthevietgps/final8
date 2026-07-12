# QA Local Bootstrap Summary

- Executed at: `2026-04-24 19:44:06 +07`
- Scope: close the default local QA entrypoint so `test-all-modules.ps1` can bootstrap its own backend and still preserve the canonical `25/25` module gate without lowering `PASS` / `BLOCKED` semantics

## Environment

- Shared-DB override verification:
  - backend base URL: `http://localhost:60384/api`
  - backend health: `http://localhost:60384/health`
  - mongo: `mongodb://127.0.0.1:27017/htxbachgia`
  - media root: `tests/backend/artifacts/results/tmp-local-module-regression-media-20260424193150`
- Clean-shell verification:
  - backend base URL: `http://localhost:60707/api`
  - backend health: `http://localhost:60707/health`
  - mongo: `mongodb://127.0.0.1:27017/htxbachgia_module_regression_local_20260424193802`
  - media root: `tests/backend/artifacts/results/tmp-local-module-regression-media-20260424193802`

## Code Change Verified

- `tests/backend/runners/run-backend-module-regression-local.ps1`
  - builds backend with `npm.cmd run build`
  - starts a dedicated local backend on a free port when `BACKEND_BASE_URL` is not already provided
  - injects temporary `BACKEND_BASE_URL`, `BACKEND_HEALTH_URL`, auth base URLs, `MONGODB_URI`, and `MEDIA_DIR` only for the canonical run
  - clears `DB06_MEDIA_DIR` so canonical local alias logic is still exercised
  - restores the previous shell environment after completion
- `test-all-modules.ps1`
  - now delegates to the local bootstrap runner instead of calling the canonical runner directly

## Audit Trail

- Bootstrap smoke before reruns:
  - status: `FAILED_HARNESS -> FIXED_HARNESS`
  - issue: wrapper build step resolved `npm` incorrectly and surfaced `Unknown command: "pm"`
  - fix: changed wrapper build invocation to `npm.cmd run build`
- Shared-DB local bootstrap verification:
  - command: `powershell -ExecutionPolicy Bypass -File .\test-all-modules.ps1`
  - runner shell prep: cleared `BACKEND_*`, `MEDIA_DIR`, `DB06_MEDIA_DIR`; exported `MONGODB_URI=mongodb://127.0.0.1:27017/htxbachgia`
  - result: `PASSED`
  - counters: `1163 PASS / 0 FAIL / 0 BLOCKED`
  - modules: `25/25`
  - log: `tests/backend/artifacts/results/test-all-modules-local-bootstrap-20260424.log`
  - json: `tests/backend/artifacts/results/module-regression-20260424-193239.json`
- Clean-shell local bootstrap verification:
  - command: `powershell -ExecutionPolicy Bypass -File .\test-all-modules.ps1`
  - runner shell prep: cleared `BACKEND_*`, `MEDIA_DIR`, `DB06_MEDIA_DIR`, and `MONGODB_URI`
  - result: `PASSED`
  - counters: `1163 PASS / 0 FAIL / 0 BLOCKED`
  - modules: `25/25`
  - log: `tests/backend/artifacts/results/test-all-modules-local-bootstrap-default-env-20260424.log`
  - json: `tests/backend/artifacts/results/module-regression-20260424-193845.json`

## Notes

- `tests/backend/artifacts/results/module-regression-latest.json` now points to the clean-shell local bootstrap pass at `2026-04-24 19:38:45 +07`.
- Canonical external-backend `BLOCKED` semantics from the `2026-04-24 19:19:52 +07` runner-bootstrap round remain unchanged under this wrapper.
- `backend/.env` still points at `127.0.0.1:27019`; the wrapper avoids that drift only for the default local entrypoint.
