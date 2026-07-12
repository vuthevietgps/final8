# RBAC And Redaction

Endpoint RBAC is implemented in:

```text
backend/src/ai-data-pack/rbac/export-endpoint-policy.service.ts
```

Fail-closed cases:

- missing endpoint permission
- missing profile permission
- redaction profile mismatch
- artifact/job profile mismatch
- job owner mismatch
- unassigned reviewer
- investor full-pack request
- system worker public read/create
- sync summary default-denied profile

Response redaction is implemented in:

```text
backend/src/ai-data-pack/export-jobs/export-job-response-redactor.service.ts
```

Every public response includes:

- `responseRedaction.isRedacted`
- `responseRedaction.redactionProfile`
- `responseRedaction.omittedSections`
- `responseRedaction.reason`
- `responseRedaction.manifestOnly`

Forbidden response values are stripped:

- storage keys and locations
- download tokens
- artifact bytes
- public URLs
- raw provider requests/responses
- raw provider queries
- credentials and tokens
- stack traces
- row-level data
