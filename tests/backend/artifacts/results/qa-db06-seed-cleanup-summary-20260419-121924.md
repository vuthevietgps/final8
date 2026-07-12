# QA DB-06 Seed Cleanup Summary

- Timestamp: `2026-04-19 12:19:24 +07`
- Scope:
  - `DB-06` high-volume seed and cleanup safety
  - media/chat regression after media-root fix
- Environment:
  - DB-06 isolate backend: `http://localhost:3684/api`
  - DB-06 Mongo: `mongodb://127.0.0.1:27017/htxbachgia_db06_20260419121556`
  - DB-06 media dir: `tests/backend/artifacts/results/tmp-db06-media-20260419121556`
  - media/chat regression isolate backend: `http://localhost:3686/api`
  - media/chat regression Mongo: `mongodb://127.0.0.1:27017/htxbachgia_media_chat_cfg_20260419121806`
  - baseline users: `tests/backend/setup/ensure-regression-users.ps1`
  - shell runner: Windows PowerShell

## Execution Audit Trail

- `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1`
  - `tests/backend/artifacts/results/module.db-seed-cleanup-rerun-20260419-121310.log`
    - status: `FAILED_PRODUCT`
    - result: `48 PASS / 2 FAIL`
    - observations:
      - `POST /api/media/cleanup-orphaned` deleted `15` files instead of the seeded `8`
      - helper summary still saw `target orphan files = 8`, so cleanup was scanning a different media root than the seeded isolate directory
  - `tests/backend/artifacts/results/module.db-seed-cleanup-rerun-20260419-121555.log`
    - status: `FAILED_PRODUCT -> FIXED_PRODUCT -> PASSED`
    - result: `50 PASS / 0 FAIL`
    - verified checkpoints:
      - target/protected seed counts
      - order pagination + media list API checks
      - orphan cleanup deletes exactly target orphan files
      - chat TTL removes aged messages within observation window
      - teardown-target preserves protected namespace
      - teardown-all removes state file and isolated media dir

- `tests/backend/suites/modules/core/module.media-chat-config.ps1`
  - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-121722.log`
    - status: `BLOCKED_ENV`
    - observation: suite defaulted to `http://localhost:3000/api`, login returned `403`
  - `tests/backend/artifacts/results/module.media-chat-config-rerun-20260419-121806.log`
    - status: `BLOCKED_ENV -> FIXED_ENV -> PASSED`
    - result: `33 PASS / 0 FAIL`
    - isolate override used: `BACKEND_BASE_URL=http://localhost:3686/api`

## Bugs And Fixes

- `MEDIA-ENV-DB06-01`
  - reproduce:
    1. Start backend with explicit `MEDIA_DIR` pointing to a path that does not exist yet.
    2. Seed DB-06 target/protected media fixtures into that directory.
    3. Call `POST /api/media/cleanup-orphaned`.
    4. Observe cleanup counts against a different root while seeded orphan files remain untouched.
  - root cause:
    - `backend/src/media/media.service.ts` only honored `MEDIA_DIR` if the directory already existed at bootstrap. Otherwise it fell back to another existing media root.
  - fix:
    - `backend/src/media/media.service.ts`
    - explicit `MEDIA_DIR` is now resolved and created eagerly before fallback candidates are considered
  - ripple assessed:
    - media cleanup
    - media import/upload destination
    - media master-sync / serve path alignment in isolated envs

- Harness hardening applied in the same round:
  - `backend/scripts/db06-seed-cleanup-helper.js`
    - seeded chat messages now include unique `platformMessageId`
    - setup now rolls back partial inserts/files on failure
    - media dir is resolved absolutely
    - helper refuses implicit Mongo fallback
  - `tests/backend/suites/modules/extended/module.db-seed-cleanup.ps1`
    - new active DB-06 suite added for repeatable execution and audit trace

## Docs Updated

- `tests/backend/docs/backend-test-plan.md`
- `tests/backend/docs/backend-test-scenario-matrix.md`
- `tests/backend/docs/backend-test-suite-backlog.md`
- `tests/backend/suites/suite-index.md`
- `tests/backend/README.md`

## Remaining Risks

- Open gap group after this round: `LOAD-*`
- `module.media-chat-config.ps1` still requires explicit `BACKEND_BASE_URL` when `localhost:3000` is occupied; runs without the override must be marked `BLOCKED_ENV`
