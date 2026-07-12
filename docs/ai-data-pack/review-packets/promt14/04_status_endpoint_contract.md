# 04 Status Endpoint Contract

Future endpoint:

```text
GET /ai-data-pack/exports/:jobId/status
```

Required permission:

```text
ai-data-pack.export.status.read
```

Allowed response fields:

- `jobId`
- `exportMode`
- `syncPolicy`
- `status`
- `createdAt`
- `updatedAt`
- `completedAt`
- `redactionProfile`
- `packTypes`
- `formats`
- `sourceImpactSummary`
- `decisionGateSummary`
- `warnings`
- `blockingReasons`
- `artifactManifestSummary`
- `allowedNextActions`
- `omittedSections`
- `responseRedaction`

Forbidden response fields:

- full storage key
- download token
- raw provider response
- raw sync errors
- credentials
- tokens
- stack trace
- raw PII
- full finance, supplier, employee, payroll, or customer sections

Allowed next actions:

- `view_status`
- `request_new_export`
- `request_partial_if_blocked`

Forbidden next actions:

- `download`
- `upload_to_openai`
- `import_action`
- `dry_run`
- `execute_live`
