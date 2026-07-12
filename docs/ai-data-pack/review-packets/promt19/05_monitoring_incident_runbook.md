# Monitoring And Incident Runbook

Main document:

- `docs/ai-data-pack/rollout/public-create-status-monitoring-incident-runbook.md`

Signals covered:

- Create requested/accepted/denied.
- Status/detail/sync-summary read and denied.
- `rate_limited`.
- `redaction_profile_applied`.
- `idempotent_request_reused`.
- `invalid_request_rejected`.
- Denial by reason category.
- Audit persistence failures.
- Unexpected 5xx.
- Unexpected forbidden-field appearance.

Incidents covered:

- Rate-limit spike.
- Repeated denied access.
- Audit persistence failure.
- Redaction regression suspicion.
- Unexpected provider dependency.
- Job existence leak suspicion.
- Storage/artifact field exposure suspicion.

Each incident includes:

- Symptoms.
- Immediate containment.
- What to check.
- Rollback/disable path.
- Evidence to preserve.
- Follow-up owner.

Reference alignment:

- OWASP Logging Cheat Sheet.
- NIST SP 800-61 Rev. 3.
