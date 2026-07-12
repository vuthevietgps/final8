# DB-06 Seed Cleanup Checklist

Manual checklist cho `DB-06` high-volume seed + cleanup safety. Checklist nay khong duoc day vao regression moi lan, nhung moi lan chay phai luu audit trail va ket qua that vao `tests/backend/artifacts/results/`.

## Scope

- Seed nhieu `order`, `other-cost`, `chat-message`, `media`
- Dung cung luc `target namespace` va `protected namespace` trong **cung mot DB isolate**
- Verify:
  - high-volume seed duoc tao that
  - cleanup media that khong xoa nham file con DB record
  - retention chat TTL ton tai va neu quan sat duoc thi aged messages bi xoa that
  - cleanup theo namespace chi xoa `target`, khong quet nham `protected`

## Prerequisites

- Backend build san co trong `backend/dist`
- Mongo isolate rieng cho round test
- `MEDIA_DIR` rieng cho round test, khong dung chung voi thu muc media dang phuc vu local env
- Baseline users da duoc ensure boi `tests/backend/setup/ensure-regression-users.ps1`

## Commands

### 1. Start isolate

Set toi thieu cac env sau truoc khi start backend:

```powershell
$env:PORT='<isolated-port>'
$env:MONGODB_URI='mongodb://127.0.0.1:27017/<isolated-db>'
$env:MEDIA_DIR='<isolated-media-dir>'
node dist/main.js
```

### 2. Seed namespaces

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/<isolated-db>'
$env:DB06_MEDIA_DIR='<isolated-media-dir>'
node backend/scripts/db06-seed-cleanup-helper.js setup <tag>
```

Expected baseline volume:

- target:
  - `240` orders
  - `120` other-costs
  - `160` recent chat messages
  - `24` aged chat messages
  - `18` media docs + files
  - `8` orphan media files
- protected:
  - `36` orders
  - `24` other-costs
  - `48` recent chat messages
  - `6` media docs + files

### 3. Verify seed summary

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/<isolated-db>'
node backend/scripts/db06-seed-cleanup-helper.js summary <tag>
```

Checks:

- counts target/protected khop baseline
- `ttlIndexSeconds = 7776000` tren `chatmessages.createdAt`

### 4. API precheck

Login `director@test.com / 123456`, sau do verify:

- `GET /api/test-order2?q=<DB06 TARGET slug>&limit=200&page=1&sortBy=createdAt&sortOrder=desc`
  - `pagination.total = 240`
  - page 1 tra `200` rows
- `GET /api/media?tag=<db06-target-tag>&page=1&limit=100`
  - `total = 18`

### 5. Media cleanup

```http
POST /api/media/cleanup-orphaned
```

Checks:

- `deletedFiles = 8`
- `summary <tag>` sau cleanup:
  - target orphan files = `0`
  - target/protected media docs va backed files van du

### 6. Chat retention observation

Poll `summary <tag>` toi da `140s`.

Checks:

- neu aged chat messages giam tu `24` ve `0`, danh `PASSED`
- neu TTL index dung nhung aged chat chua bi xoa trong cua so quan sat, danh `BLOCKED_ENV`, khong danh `PASS`

### 7. Namespace cleanup

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/<isolated-db>'
node backend/scripts/db06-seed-cleanup-helper.js teardown-target <tag>
node backend/scripts/db06-seed-cleanup-helper.js summary <tag>
```

Checks:

- target:
  - orders = `0`
  - other-costs = `0`
  - chat messages = `0`
  - conversations = `0`
  - media docs = `0`
  - backed/orphan files = `0`
- protected:
  - orders = `36`
  - other-costs = `24`
  - recent chat messages = `48`
  - conversations > `0`
  - media docs = `6`
  - backed files = `6`

### 8. Final cleanup

```powershell
$env:MONGODB_URI='mongodb://127.0.0.1:27017/<isolated-db>'
node backend/scripts/db06-seed-cleanup-helper.js teardown-all <tag>
```

Checks:

- state file bi xoa
- isolated media dir bi xoa

## Result Rules

- Khong duoc danh `PASS` neu chi verify bang dry-run hoac chi check index ma khong co cleanup/seed that
- Neu chat TTL khong observable trong cua so cho phep, ghi `BLOCKED_ENV`
- Neu target cleanup dong vao protected namespace, ghi `FAILED`
- Moi execution phai co artifact summary `.md` va `.json` rieng, giu day du audit trail `FAILED/BLOCKED -> FIXED -> PASSED` neu co
