# 09 Rate Limit And Abuse Controls

Required controls:

- per actor create rate limit
- per mode create rate limit
- per job status polling limit
- sync summary read limit
- idempotency replay limit
- large date range rejection
- pack size limits
- format limits
- concurrent official export limit
- concurrent source-sync limit reuse
- repeated denial throttling

Initial policy direction:

- `official_export` should have the strictest create quota.
- `partial_export` can be less strict but still bounded.
- `cached_export` must not become a cheap unbounded renderer.
- Status polling is low-cost but must be capped per actor/job.
- Sync summary is privileged and must be tightly capped.
- Repeated invalid or denied requests must be audited and throttled.
