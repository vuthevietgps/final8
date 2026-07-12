# Environment And Config Checklist

Main document:

- `docs/ai-data-pack/rollout/public-create-status-env-config-checklist.md`

Checklist covers:

- Auth role-permission mapping.
- JWT/current-user role resolution.
- Mongoose connection.
- `ai_data_pack_endpoint_audits` collection availability.
- CacheManager and `REDIS_URL` decision.
- In-memory limiter accepted only for single-process/internal use.
- Rate-limit environment keys.
- Structured logs and log retention.
- Forbidden no-download/no-action/no-live/no-provider-mutation surfaces.

Rate-limit keys documented:

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
