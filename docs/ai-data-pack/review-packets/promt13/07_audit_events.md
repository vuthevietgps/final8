# 07 Audit Events

Internal audit events implemented in export job metadata:

- `export_requested`
- `pre_assessment_started`
- `source_sync_started`
- `source_sync_completed`
- `post_assessment_completed`
- `export_blocked`
- `export_downgraded`
- `artifact_generated`
- `rbac_denied`

No download audit events were added because download/token endpoints are not implemented in this phase.

Audit metadata is sanitized and does not include provider secrets, raw provider payloads, or stack traces.
