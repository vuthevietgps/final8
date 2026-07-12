# Timeout, Retry, and Lock Policy

## Policy Values

| Control | Value |
|---|---|
| Connection timeout contract | 5,000 ms |
| Request timeout contract | 30,000 ms |
| Total deadline | 180,000 ms |
| Retries after first attempt | 2 |
| Maximum date range | 31 days |
| Maximum concurrent customers contract | 2 |
| Retry base delay | 250 ms exponential |
| Lock TTL | 210,000 ms |

Retry is allowed only for transient network errors, HTTP 429, and eligible 5xx. Auth, permission, policy, scope, invalid query, unsupported version, and local validation failures are not retried.

The lock descriptor uses:

```text
key=google_ads:{scopeHash}:{dateFrom}:{dateTo}
owner={exportJobId}:{random owner token}
TTL > total deadline
owner-only release
```

`distributed_lock_runtime=interface_only`. The adapter fails closed with `lock_unavailable` when no lock port is configured. No in-memory lock is represented as production-safe.

