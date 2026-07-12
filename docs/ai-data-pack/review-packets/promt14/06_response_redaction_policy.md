# 06 Response Redaction Policy

Every response must include:

- `responseRedaction.isRedacted`
- `responseRedaction.redactionProfile`
- `responseRedaction.omittedSections`
- `responseRedaction.reason`
- `responseRedaction.manifestOnly`

Profile policy:

| Profile | Status response | Sync summary | Notes |
|---|---|---|---|
| `director_full` | Full job status and manifest summary. | Allowed if permission granted. | Still no raw tokens or provider payload. |
| `director_redacted` | Workflow status with sensitive fields redacted. | Sanitized if granted. | Must label redacted. |
| `manager_marketer` | Assigned partial/cached jobs only. | Denied by default. | No finance, employee, supplier commission, or PII. |
| `finance_operator` | Assigned finance-scoped jobs. | Sanitized if granted. | No customer PII by default. |
| `reviewer_partial` | Assigned partial jobs only. | Denied by default. | Redacted business status only. |
| `investor_redacted` | Assigned redacted summary only. | Denied. | No full Director Pack. |
| `external_consultant_redacted` | Assigned redacted summary only. | Denied. | No finance detail, PII, audit, or sync detail. |
| `system_internal_worker` | No human read surface by default. | No human read surface. | Cannot use human download/read surfaces. |

Rules:

- Omitted sections must be listed.
- Redacted response must explicitly say it is redacted.
- Warnings and blocking reasons must be sanitized.
- ChatGPT Web must know if response is partial, redacted, or manifest-only.
- Redacted response must not look like a complete dataset.
