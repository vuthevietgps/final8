# QA Auth Regression Summary

- Timestamp: `2026-04-19 00:09:19 +07`
- Scope: targeted auth hardening rerun, root-cause fix verification, and auth RBAC regression rerun
- Environment:
  - default backend: `http://localhost:3200/api`
  - dedicated IP-restriction backend: `http://localhost:3100/api`
  - MongoDB: `mongodb://127.0.0.1:27017/htxbachgia`
  - Mongo topology: single-node replica set `rs0`
  - shell runner: Windows PowerShell
  - environment override note:
    - local Mongo service for this round listened on `127.0.0.1:27017`
    - `backend/.env` still points to `127.0.0.1:27019`, so this round exported `MONGODB_URI` explicitly

## Final Result

- Final status: `60 PASS / 0 FAIL`
- Suites:
  - `module.auth-hardening.ps1`: `35 PASS / 0 FAIL`
  - `module.auth-rbac.ps1`: `25 PASS / 0 FAIL`

## Execution History

- Initial preflight:
  - `tests/backend/setup/ensure-regression-users.ps1` first failed against `127.0.0.1:27019`
  - status: `BLOCKED_ENV`
  - action: inspected local runtime, confirmed Windows `MongoDB` service was healthy on `127.0.0.1:27017` and already running as replica set `rs0`
  - status after unblock: `BLOCKED_ENV -> FIXED_ENV`
- Manual reproduce before fix:
  - on suite-started `3100` instance, `manager@test.com` with `allowedLoginIps=[]` still received `201`
  - same instance also returned `201` for `x-forwarded-for=203.0.113.10`
  - affected checks:
    - `module.auth-hardening.ps1` step `4.1`
    - `module.auth-hardening.ps1` step `4.4`
- Root cause:
  - `tests/backend/suites/modules/core/module.auth-hardening.ps1` started the dedicated backend with `cmd.exe /c set VAR=value && ...`
  - `cmd.exe` kept a trailing space in `AUTH_ENABLE_IP_RESTRICTION`, so runtime received `true ` and auth service treated IP restriction as disabled
  - suite cleanup only stopped the wrapper PID, not the real node listener PID on `3100`, leaving orphan processes between runs
- Fixes applied:
  - `tests/backend/suites/modules/core/module.auth-hardening.ps1`
    - quote each `cmd set` assignment as `set "NAME=value"` to prevent whitespace/env drift
    - detect and stop the actual `3100` listener PID during cleanup
  - `backend/src/auth/auth.service.ts`
    - trim `AUTH_ENABLE_IP_RESTRICTION` before comparing to `true`
  - `tests/backend/suites/modules/core/module.auth-rbac.ps1`
    - add `AUTH_RBAC_BASE_URL` override so targeted auth regression can run even when local `3000` is occupied by another process
- Final rerun:
  - `module.auth-hardening.ps1`: `FAILED -> FIXED_HARNESS_ENV -> FIXED_CLEANUP -> PASSED`
  - `module.auth-rbac.ps1`: `PASSED`

## Fixes Verified In This Round

- `backend/src/auth/auth.service.ts`
- `tests/backend/suites/modules/core/module.auth-hardening.ps1`
- `tests/backend/suites/modules/core/module.auth-rbac.ps1`

## Logs

- `tests/backend/artifacts/results/module.auth-hardening-rerun-20260419-0011.log`
- `tests/backend/artifacts/results/module.auth-rbac-rerun-20260419-0011.log`
- `tests/backend/artifacts/results/module.auth-hardening-rerun-20260418-2359.log`

## Open Risks

- Canonical full module regression has not been rerun yet after the latest auth harness fixes, so the latest full baseline remains `764 PASS / 0 FAIL` from `2026-04-15 00:34:57 +07`.
- Local workstation config still drifts from `backend/.env` on Mongo port (`27017` live service vs `27019` in file); suites need explicit `MONGODB_URI` override until the environment is standardized.
