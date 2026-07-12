# QA Unit Test Summary

- Executed at: `2026-04-26 15:38-15:39 +07`
- Constraint honored:
  - Backend Jest was run with the repository's default scripts, without `--passWithNoTests`.
  - Frontend Karma was run across the configured spec set; `watch=false` only makes the run non-interactive.
- Results:
  - `backend npm test`: `FAILED_TEST_CONFIG`
    - Log: `tests/backend/artifacts/results/backend-jest-test-20260426-153853.log`
    - Details: Jest checked `397` files under `backend/src`; `testRegex: .*\.spec\.ts$` matched `0` files, so Jest exited with code `1`.
  - `backend npm run test:e2e`: `FAILED_TEST_CONFIG`
    - Log: `tests/backend/artifacts/results/backend-jest-e2e-test-20260426-153908.log`
    - Details: Jest could not resolve configured path `./test/jest-e2e.json` from `backend`.
  - `frontend npm test -- --watch=false --browsers=ChromeHeadless`: `PASSED`
    - Log: `tests/backend/artifacts/results/frontend-karma-test-20260426-153919.log`
    - Details: Chrome Headless `147.0.0.0`, `3 SUCCESS / 0 FAIL`.
- Interpretation:
  - Frontend unit test gate is green for the current small spec set.
  - Backend Jest unit/e2e gates are not valid green gates yet because the configured test assets are absent.
  - Backend API/module regression remains the authoritative backend automated gate for this workspace snapshot.
