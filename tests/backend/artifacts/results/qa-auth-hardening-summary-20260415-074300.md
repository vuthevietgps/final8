# QA Auth Hardening Summary

- Timestamp: `2026-04-15 07:43:00 +07`
- Scope: targeted activation round for auth hardening and immediate auth ripple checks
- Environment:
  - default backend: `http://localhost:3000/api`
  - dedicated IP-restriction backend: `http://localhost:3100/api`
  - isolated DB: `mongodb://127.0.0.1:27017/htxbachgia_authhardening`
  - shell runner: Windows PowerShell

## Final Result

- Final status: `68 PASS / 0 FAIL`
- Suites:
  - `module.auth-hardening.ps1`: `35 PASS / 0 FAIL`
  - `module.auth-rbac.ps1`: `25 PASS / 0 FAIL`
  - `module.customer.ps1`: `8 PASS / 0 FAIL`

## Execution History

- `module.auth-hardening.ps1`
  - first run: `FAILED`
  - root cause: suite harness parsed login JSON incorrectly because Windows PowerShell does not support `ConvertFrom-Json -Depth`
  - action: fixed JSON parsing compatibility in `tests/backend/suites/modules/core/module.auth-hardening.ps1`
  - second run: `FAILED`
  - root cause: dedicated `3100` QA instance was not started with effective `AUTH_ENABLE_IP_RESTRICTION=true`
  - action: restarted dedicated instance with explicit startup script and env trace
  - final run: `FAILED -> FIXED_HARNESS -> FIXED_ENV -> PASSED`
- `module.auth-rbac.ps1`
  - rerun after auth changes: `PASSED`
- `module.customer.ps1`
  - representative protected-module ripple rerun: `PASSED`

## Fixes Verified In This Round

- `backend/src/user/user.schema.ts`
  - added `tokenVersion` to support JWT revocation
- `backend/src/auth/auth.service.ts`
  - include `tokenVersion` in JWT payload
  - initialize `tokenVersion` on register
  - increment `tokenVersion` on logout to revoke older tokens
- `backend/src/auth/strategies/jwt.strategy.ts`
  - reject tokens whose payload version no longer matches the current user record
- `tests/backend/setup/ensure-regression-users.js`
  - seed deterministic `tokenVersion: 0`
- `tests/backend/suites/modules/core/module.auth-hardening.ps1`
  - added auth hardening coverage
  - fixed Windows PowerShell JSON parse compatibility
- `tests/backend/suites/modules/core/module.auth-rbac.ps1`
  - changed logout assertion to require old token rejection after logout

## Logs

- `tests/backend/artifacts/results/module.auth-hardening-20260415-073533.log`
- `tests/backend/artifacts/results/module.auth-hardening-rerun-20260415-073721.log`
- `tests/backend/artifacts/results/module.auth-hardening-rerun2-20260415-073908.log`
- `tests/backend/artifacts/results/module.auth-hardening-rerun3-20260415-074155.log`
- `tests/backend/artifacts/results/module.auth-rbac-rerun-20260415-074216.log`
- `tests/backend/artifacts/results/module.customer-rerun-20260415-074238.log`
- `tests/backend/artifacts/results/tmp-auth-hardening-app-3100.out.log`
- `tests/backend/artifacts/results/tmp-auth-hardening-app-3100.err.log`

## Open Risks

- The canonical full module regression has not been rerun yet after adding `module.auth-hardening.ps1` to the active runner, so the latest full baseline remains the prior `764 PASS / 0 FAIL` snapshot on the 18-module catalog.
- IP-restriction coverage depends on a dedicated backend instance started with `AUTH_ENABLE_IP_RESTRICTION=true`.
- `purchase` / `inventory` remain `blocked_runtime` until they are wired into `AppModule`.
