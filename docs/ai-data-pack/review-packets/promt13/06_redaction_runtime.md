# 06 Redaction Runtime

Added internal profile resolver:

```text
ExportRedactionProfileService
```

Supported profiles:

- `director_full`
- `director_redacted`
- `manager_marketer`
- `finance_operator`
- `reviewer_partial`
- `investor_redacted`
- `external_consultant_redacted`
- `system_internal_worker`

Runtime:

```text
redaction_runtime=manifest_only
artifact_rendering=deferred
```

Reason:

Row-level redaction is not implemented in this phase, so official/partial lifecycle does not render full data artifacts for redacted profiles.
