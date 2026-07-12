# Lock Runtime

`distributed_lock_runtime=implemented_mongo`

Collection: `ai_data_pack_source_sync_locks`

The implementation uses atomic single-document `findOneAndUpdate` with:

- unique `lockKey`;
- active-lock duplicate denial;
- expired/released takeover policy;
- owner and random owner-token release guard;
- source, scope, export-job, and date-range fields;
- `expiresAt` TTL cleanup.

TTL cleanup is eventual. Correctness does not depend on immediate deletion because acquisition explicitly checks `expiresAt`.

Tests cover create/acquire, duplicate denial, expired takeover filter, owner-only release, wrong-owner denial, scoped key, unique index, and TTL index. No in-memory lock is represented as production-safe.

