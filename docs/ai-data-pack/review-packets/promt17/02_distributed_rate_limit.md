# Distributed Rate Limit

Checked existing mechanisms:

- Global `CacheModule` in `backend/src/app.module.ts`.
- Redis-backed CacheManager through `@keyv/redis` when `REDIS_URL` is configured.
- In-memory CacheManager fallback.
- Existing AI Data Pack endpoint limiter from Prompt 16.

No existing safe atomic Redis `INCR` wrapper, platform limiter, or CacheManager atomic increment abstraction was found.

Result:

```text
distributed_rate_limit_checked=true
distributed_rate_limit_changed=false
atomic_limiter_available=false
not_atomic=true
```

The existing limiter remains:

- Shared-cache backed when CacheManager is configured.
- In-memory fallback for tests/dev.
- Configurable through Prompt 16 rate-limit environment keys.

Prompt 17 added endpoint handling for `rate_limited` audit/observability events, but did not change the limiter bucket algorithm.

Residual blocker:

- CacheManager `get`/`set` increments are not atomic under concurrent distributed load.
