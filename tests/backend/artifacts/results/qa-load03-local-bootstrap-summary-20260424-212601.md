# QA LOAD-03 Local Bootstrap Summary

- Executed at: `2026-04-24 21:26:01 +07`
- Scope: close the stale-localhost / wrong-backend collision class in `LOAD-03` and verify the canonical write-contention harness on a dedicated local bootstrap backend

## Environment

- Stale-backend audit target:
  - backend base URL: `http://localhost:62922/api`
  - runtime manifest/state claimed Mongo: `mongodb://127.0.0.1:27017/htxbachgia_load03_fix3_20260424210944`
  - contradictory evidence: fixture order `69eb79b73303fa63856acae5` existed in `htxbachgia_load03_fix_step_20260424210049`, not in the claimed `fix3` DB
- Clean local bootstrap pass:
  - backend base URL: `http://localhost:64646/api`
  - health: `http://localhost:64646/health`
  - Docker k6 target root: `http://host.docker.internal:64646`
  - Mongo: `mongodb://127.0.0.1:27017/htxbachgia_load03_local_20260424212450`
  - media root: `tests/backend/artifacts/results/tmp-load03-local-media-20260424212450`
  - runtime manifest: `tests/backend/artifacts/results/runtime-contract-load03-local-20260424-212450.json`

## Code Change Verified

- `tests/backend/runners/run-backend-perf-write-contention.ps1`
  - default path now builds backend, starts a dedicated local backend on a free port, isolates Mongo/media state, and writes a runtime manifest before delegating to the canonical `LOAD-03` runner
  - no longer forwards null `FixturePath` or `SummaryPath` into the canonical runner

## Audit Trail

- Stale-backend manifest run:
  - command: `tests/backend/runners/run-load03-write-contention.ps1`
  - result: `FAILED_HARNESS`
  - evidence:
    - `tests/backend/artifacts/results/run-load03-write-contention-fix3-20260424-210944.log`
    - `tests/backend/artifacts/results/perf.write-contention-summary-runtime-manifest-20260424-210953.json`
  - root symptom: port `62922` served a stale backend tied to `htxbachgia_load03_fix_step_20260424210049` while the runtime manifest/state claimed `htxbachgia_load03_fix3_20260424210944`, so the supplier/agent batch `500`s were not trustworthy product evidence
- First local bootstrap invocation:
  - command: `tests/backend/runners/run-backend-perf-write-contention.ps1`
  - result: `FAILED_HARNESS`
  - root symptom: wrapper passed null `FixturePath` and `SummaryPath` into the canonical runner, and PowerShell aborted before k6 started
  - note: no standalone raw log was persisted for this pre-k6 failure; it is preserved in this summary to keep the audit trail intact
- Clean local bootstrap rerun:
  - command: `tests/backend/runners/run-backend-perf-write-contention.ps1`
  - result: `FAILED_HARNESS -> FIXED_HARNESS -> PASSED`
  - evidence:
    - `tests/backend/artifacts/results/tmp-load03-local-backend-20260424-212450.json`
    - `tests/backend/artifacts/results/tmp-load03-local-backend-20260424-212450.out.log`
    - `tests/backend/artifacts/results/tmp-load03-local-backend-20260424-212450.err.log`
    - `tests/backend/artifacts/results/perf.write-contention-fixture-20260424-212539.json`
    - `tests/backend/artifacts/results/perf.write-contention-summary-20260424-212539.json`
  - result detail: `120` iterations, `293` HTTP requests, `0.00% http_req_failed`, checks rate `1`, global `http_req_duration p95=1391.47ms`, `supplier_payment_batch p95=594.22ms`, `agent_payment_batch p95=688.23ms`, `owner_withdrawal_approve_commit_duration p95=1387.93ms`, `return_resolve_commit_duration p95=2209.59ms`, `other_cost_confirm p95=795.19ms`

## Notes

- No backend product bug was reproduced in the clean isolated rerun.
- No related product regression rerun was required in this round because the fix was harness-only.
- Repro backend `62924` created during investigation was shut down after validation; stale backend `62922` was left untouched because ownership outside this round was not proven.
