# Rate Limit Hardening

The implementation hardened `backend/src/ai-data-pack/export-jobs/export-endpoint-rate-limit.service.ts`.

Covered limits:

- Create per actor.
- Create per mode.
- Official create per actor.
- Status polling per actor/job.
- Sync summary per actor/job.
- Idempotency replay per actor/key.
- Denial attempts per actor.
- Maximum date range days.
- Maximum pack type count.
- Maximum format count.
- Maximum concurrent official exports per actor.

Config keys:

- `AI_DATA_PACK_EXPORT_CREATE_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_CREATE_PER_MODE`
- `AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_STATUS_POLL_PER_ACTOR_JOB`
- `AI_DATA_PACK_EXPORT_SYNC_SUMMARY_PER_ACTOR_JOB`
- `AI_DATA_PACK_EXPORT_IDEMPOTENCY_REPLAY_PER_ACTOR_KEY`
- `AI_DATA_PACK_EXPORT_DENIAL_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_MAX_DATE_RANGE_DAYS`
- `AI_DATA_PACK_EXPORT_MAX_PACK_TYPES`
- `AI_DATA_PACK_EXPORT_MAX_FORMATS`
- `AI_DATA_PACK_EXPORT_MAX_CONCURRENT_OFFICIAL_PER_ACTOR`

Storage behavior:

- Uses Nest CacheManager buckets when configured.
- Falls back to the previous in-memory bucket behavior for tests/local setups.
- Bucket keys are scoped under `ai-data-pack:export-rate-limit:*`.

Acceptance tests cover:

- Official export stricter threshold.
- Status and sync-summary throttling.
- Denial throttling.
- Large date range, pack type count, and format count rejection.
- CacheManager-backed bucket behavior.

Residual risk:

- CacheManager `get`/`set` increments are not an atomic Redis `INCR`. This is acceptable for Prompt 16 hardening but should be upgraded if strict distributed throttling is required.
