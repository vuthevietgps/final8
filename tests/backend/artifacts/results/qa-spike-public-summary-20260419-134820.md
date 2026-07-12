# QA Summary - LOAD-02 Spike/Public Closure

- Summary generated: `2026-04-19 13:48:20 +07`
- Scope: `LOAD-02` burst/spike load on `webhook/messenger`, `advertising-cost-public`, `order-update/preview`, `test-order2`; related public/chat regressions

## Executions

- `perf.spike-public.k6.js`
  - `tmp-spike-public-backend-3696-20260419-133036.err.log`: `FAILED_HARNESS/BLOCKED_ENV`
    - isolate runner collided on port `3696`; webhook verify preflight hit a non-QA service
  - `perf.spike-public-summary-20260419-133229.json`: `FAILED_PRODUCT`
    - HTTP checks were green but backend stderr recorded repeated `E11000 duplicate key` on `chatmessages` unique index `sourcePlatform_1_fanpageId_1_platformEventKey_1`
  - `perf.spike-public-summary-20260419-134125.json`: `FAILED_HARNESS`
    - rerun injected `BACKEND_BASE_URL` with `/api`, causing `/api/api/...` probes
  - `perf.spike-public-summary-20260419-134309.json`: `FAILED_HARNESS/BLOCKED_ENV -> FAILED_PRODUCT -> FAILED_HARNESS -> FIXED_PRODUCT -> PASSED`
    - isolate backend: `http://localhost:3810`
    - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_spike_public_20260419134309`
    - result: `2432` requests, `2429` iterations, `0.00% http_req_failed`, global `p95=36.31ms`, `p99=83.37ms`
    - endpoint p95:
      - `webhook_ack=15.08ms`
      - `advertising_cost_public=30.49ms`
      - `order_update_preview=45.28ms`
      - `test_order2_list=47.71ms`
- `e2e.public-contracts-resilience.ps1`
  - `e2e.public-contracts-resilience-rerun-20260419-134548.log`: `PASSED`, `61 PASS / 0 FAIL`
- `module.media-chat-config.ps1`
  - `module.media-chat-config-rerun-20260419-134657.log`: `PASSED`, `33 PASS / 0 FAIL`

## Bugs

- `CHAT-WEBHOOK-LOAD02-01`
  - Symptom: `webhook/messenger` ACKed `200`, but background processing failed under spike with `E11000 duplicate key` on `chatmessages.platformEventKey=null`
  - Root cause: idempotent upsert payload still carried nullable platform keys, while the legacy sparse unique index still indexed `null`
  - Fix:
    - [chat-message.service.ts](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/backend/src/chat-message/chat-message.service.ts)
    - [chat-message.schema.ts](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/backend/src/chat-message/schemas/chat-message.schema.ts)
  - Product status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`

## Files Updated This Round

- [chat-message.service.ts](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/backend/src/chat-message/chat-message.service.ts)
- [chat-message.schema.ts](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/backend/src/chat-message/schemas/chat-message.schema.ts)
- [perf.spike-public.k6.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/perf.spike-public.k6.js)
- [create-order-update-preview-fixture.js](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/perf/create-order-update-preview-fixture.js)
- [backend-test-plan.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-plan.md)
- [backend-test-scenario-matrix.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-scenario-matrix.md)
- [backend-test-suite-backlog.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/docs/backend-test-suite-backlog.md)
- [suite-index.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/suites/suite-index.md)
- [README.md](/C:/Users/PC/Documents/code/htxbachgia.shop/final8-version16/tests/backend/README.md)

## Open Risks

- `LOAD-03` to `LOAD-06` remain open.
- `module.media-chat-config.ps1` still verifies `media/import-by-url` only at contract-response level; the latest isolated rerun hit outbound `ECONNRESET` to `https://via.placeholder.com/150`, so deterministic positive-path media import still needs a local fixture harness.
- This round did not rerun the full canonical module regression; only directly related public/chat regressions were rerun.

## Next Step

- Activate `LOAD-03` with a write-contention harness around payment batch, owner withdrawal, return resolve, and other-cost confirm, while keeping the same isolate-env discipline as `LOAD-02`.
