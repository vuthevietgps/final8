# Audit Logging And Security Events

Required events:

```text
export_requested
pre_assessment_started
source_sync_started
source_sync_completed
post_assessment_completed
export_blocked
export_downgraded
artifact_generated
download_token_created
artifact_downloaded
download_denied
sync_detail_viewed
sensitive_section_accessed
rbac_denied
artifact_expired
artifact_deleted
```

Every event must include:

- actor
- target
- `exportJobId`
- `artifactId` if applicable
- `sourceKey` if applicable
- permission checked
- redaction profile
- timestamp
- sanitized metadata
- no raw secrets

Audit logs must not contain raw provider payloads, OAuth tokens, refresh tokens, raw stack traces, or raw PII beyond the audited authorization scope.
