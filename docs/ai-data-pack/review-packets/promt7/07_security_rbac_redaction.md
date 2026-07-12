# Security, RBAC, and Redaction

## RBAC

Proposed internal permissions:

```text
ai-data-pack.source-sync.google-ads.readonly.execute
ai-data-pack.export.sync-detail.read
```

They are not bound to Director, Manager, or other roles. `permission_key_proposed_not_bound=true`.

## Transport

The adapter transport contract permits only:

```text
origin=https://googleads.googleapis.com
method=POST
path=/v*/customers/{allowlistedCustomerId}/googleAds:searchStream
query source=adapter-owned static templates
mutation_allowed=false
validate_only_allowed=false
```

## Error Handling

Errors use a bounded category set and sanitized messages. Raw provider responses, headers, request bodies, stack traces, tokens, credentials, and out-of-scope customer topology are not returned.

Lock, scope, assessment, and sync failures are sanitized at the adapter boundary.

