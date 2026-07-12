# Backend QA Summary - Public Contracts & Resilience Activation - 2026-04-19 03:25:52 +07

## Scope

- Activate `tests/backend/suites/e2e-flows/e2e.public-contracts-resilience.ps1`
- Reproduce and fix the chat image-send 24h policy bypass and the `/api/media/serve/...` public alias contract gap
- Rerun related media/chat regression and then close the canonical `22`-module regression

## Environment

- Manual reproduce backend: `http://localhost:3630/api`
- Isolated suite backends: `http://localhost:3640/api`, `http://localhost:3641/api`
- Canonical regression backend: `http://localhost:3650/api`
- Mongo runtime for all reruns in this round: explicit `MONGODB_URI` on `127.0.0.1:27017`
- Runtime note:
  - `PLAN_TYPE=enterprise`
  - `FB_SENDING_ENABLED=0` for the 24h chat checks
  - `backend/.env` still points to `127.0.0.1:27019`, so this round exported `MONGODB_URI` explicitly

## Progression History

- `manual-public-contracts-chat24h-repro-20260419-030040.log`
  - status: `FAILED`
  - reproduce: text send outside 24h returned `400`, but image send by URL returned `201`
- `e2e.public-contracts-resilience-run-20260419-031649.log`
  - status: `FAILED_HARNESS`
  - root issue: suite repo-root resolved to `tests/tests/...`, so the isolated backend never became healthy
- `e2e.public-contracts-resilience-run-20260419-031803.log`
  - status: `FAILED_HARNESS_ENV`
  - root issues:
    - explicit `FB_VERIFY_TOKEN` lost to existing `.env` `MESSENGER_VERIFY_TOKEN`
    - `ensure-regression-users` inherited `.env` Mongo drift and failed against `127.0.0.1:27019`
- `e2e.public-contracts-resilience-run-20260419-031926.log`
  - status: `FAILED_HARNESS`
  - root issue: binary media assertions called `.Trim()` on `byte[]`
- `e2e.public-contracts-resilience-run-20260419-032022.log`
  - status: `FAILED`
  - result: `55 PASS / 4 FAIL`
  - failures:
    - `/api/media/serve/...` returned `404`
    - encoded traversal returned `404` instead of `403`
    - DB fallback through `/api/media/serve/...` returned `404`
    - inbound chat replay assertion used an unstable response path
- `e2e.public-contracts-resilience-run-20260419-032231.log`
  - status: `FAILED_HARNESS`
  - result: `60 PASS / 1 FAIL`
  - root issue: outbound chat persistence assertion should have used isolated DB truth instead of response-shape drift
- `e2e.public-contracts-resilience-run-20260419-032414.log`
  - status: `FAILED -> FIXED_HARNESS -> FIXED_PRODUCT -> PASSED`
  - result: `61 PASS / 0 FAIL`
- `manual-public-contracts-chat24h-rerun-20260419-030313.log`
  - status: `FAILED -> FIXED_PRODUCT -> PASSED`
  - result: text send outside 24h `400`, image send by URL outside 24h `400`

## Failed -> Fixed -> Passed

### Chat image send outside the 24h window

- Reproduce before fix:
  - `POST /api/chat-messages/send` outside 24h returned `400`
  - `POST /api/chat-messages/send/image/url` outside 24h returned `201`
- Root cause:
  - `backend/src/chat-message/chat-message.controller.ts`
  - image-send URL and multipart routes skipped the 24h gate when `FB_SENDING_ENABLED=0`
- Fix:
  - both image-send routes now reuse the same 24h policy check before persisting outbound messages
- Rerun status:
  - `FAILED -> FIXED_PRODUCT -> PASSED`
  - manual rerun closed the direct reproduce
  - `e2e.public-contracts-resilience.ps1` closed at `61 PASS / 0 FAIL`

### `/api/media/serve/...` public alias contract

- Reproduce before fix:
  - `/api/media/serve/:year/:month/:filename` returned `404`
  - encoded traversal through that alias returned `404` instead of `403`
  - DB fallback through that alias returned `404`
- Root cause:
  - `backend/src/media/media.controller.ts`
  - runtime routing did not preserve the explicit `/api/media/serve/:year/:month/:filename` contract in this environment
- Fix:
  - added explicit `@Get('serve/:year/:month/:filename')` and delegated to the existing `serveFile(...)` path
- Rerun status:
  - `FAILED -> FIXED_PRODUCT -> PASSED`
  - alias parity, traversal rejection, and DB fallback all closed in the final suite rerun

### Harness closures during suite activation

- `tests/backend/suites/e2e-flows/e2e.public-contracts-resilience.ps1`
  - fixed repo-root resolution so helper paths no longer land under `tests/tests/...`
  - exported explicit `MONGODB_URI` when calling `ensure-regression-users`
  - switched webhook precedence checks to explicit `MESSENGER_VERIFY_TOKEN`
  - added binary-body comparison for media responses
  - switched final chat replay assertions to isolated DB truth instead of unstable response shapes
- Rerun status:
  - `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`

## Related Regression

- `module.media-chat-config.ps1`
  - log: `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-032541.log`
  - result: `33 PASS / 0 FAIL`
- Canonical full module regression:
  - `22 / 22` modules passed
  - `935 PASS / 0 FAIL`
  - artifacts:
    - `tests/backend/artifacts/results/full-module-regression-rerun-20260419-032541.log`
    - `tests/backend/artifacts/results/module-regression-20260419-032552.json`
    - `tests/backend/artifacts/results/module-regression-latest.json`

## Files Changed In This Round

- `backend/src/chat-message/chat-message.controller.ts`
- `backend/src/media/media.controller.ts`
- `tests/backend/suites/e2e-flows/e2e.public-contracts-resilience.ps1`

## Logs And Artifacts

- `tests/backend/artifacts/results/manual-public-contracts-chat24h-repro-20260419-030040.log`
- `tests/backend/artifacts/results/manual-public-contracts-chat24h-rerun-20260419-030313.log`
- `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-031649.log`
- `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-031803.log`
- `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-031926.log`
- `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-032022.log`
- `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-032231.log`
- `tests/backend/artifacts/results/e2e.public-contracts-resilience-run-20260419-032414.log`
- `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-032541.log`
- `tests/backend/artifacts/results/full-module-regression-rerun-20260419-032541.log`
- `tests/backend/artifacts/results/module-regression-20260419-032552.json`
- `tests/backend/artifacts/results/module-regression-latest.json`

## Files Updated For Traceability

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Open Risks

- `backend/.env` still drifts from the live QA Mongo port (`27019` in file vs `27017` live), so `BLOCKED_ENV` remains possible without explicit `MONGODB_URI`.
- This round proved blocked multipart image sends do not persist outbound chat messages, but it did not promote media-storage cleanup semantics into a dedicated suite yet.

## Next Test Step

1. Standardize local QA Mongo configuration so isolated suites stop depending on `MONGODB_URI` overrides.
2. Continue with the next planned P1/P0 gaps: `e2e.concurrent-finance-ripple.ps1`, `module.db-consistency.ps1`, and load/perf harness preparation.
