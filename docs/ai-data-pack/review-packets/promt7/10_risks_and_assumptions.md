# Risks and Assumptions

## Risks and Limitations

- Distributed lock runtime is only an interface and is intentionally unbound.
- DB-only assessment/source-registry port is optional and unbound.
- Transport allowlist is a boundary contract/test, not an interceptor around the existing sync service's Axios calls.
- Connection and request timeouts cannot yet be pushed into the existing sync transport.
- Existing sync service converts many provider step failures into result errors, limiting outer retry enforcement.
- Local-write allowlist does not intercept every existing sync-service persistence operation.
- Existing sync-run schema lacks export-job link, scope hash, lock outcome, attempts, and post-sync assessment references.
- Active local Google account status is used as approval; no separate durable customer-scope approval registry exists.

## Assumptions

- ERP remains the only system permitted to call Google Ads.
- Future real sync will bind a production distributed lock, not an in-memory lock.
- Final freshness and coverage decisions remain DB-only after any future sync.
- Schema/migration and role binding require separate review.

