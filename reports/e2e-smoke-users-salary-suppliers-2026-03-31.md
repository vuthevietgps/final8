# E2E Smoke Report

Date: 2026-03-31

Scope:
- `/users`
- `/costs/salary`
- `/suppliers`

Execution notes:
- Used local account `vutheviet@gmail.com` / `123456`
- Verified route availability through `http://localhost:4200`
- Verified backend API behavior through `http://localhost:3000/api`
- No production code was modified

Result:
- `Users`: pass
- `Salary config`: pass
- `Suppliers`: pass

What was exercised:
- Login
- Users page route load
- Create, list, update, and delete a temporary user
- Create, list, update, and delete a temporary salary config
- Suppliers page route load
- Create, list, and delete a temporary supplier user

Temporary files:
- `tmp/e2e/smoke-users-salary-suppliers.ps1`
- `tmp/e2e/smoke-users-salary-suppliers.result.json`

Assessment:
- No blocking failures found in the requested areas.
- The tested flows are functional against the local MongoDB-backed dev environment.
