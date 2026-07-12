# Artifact Retention Download Policy

Snapshot point:

- After post-assessment.
- Before JSON/XLSX rendering.

Required metadata:

- `snapshot_id`
- `export_job_id`
- `export_mode`
- `sync_policy`
- `policy_version`
- `data_content_checksum`
- `runtime_export_checksum`
- `artifact_checksum`
- manifest with files, row counts, source freshness metadata, warnings, blocking reasons
- `contains_pii`
- `redaction_level`
- retention class
- download expiry

Recommended retention defaults:

| Mode | Retention |
|---|---|
| `official_export` | 90 days |
| `partial_export` | 30 days |
| `cached_export` | 7 days unless existing cached policy says otherwise |

Download policy:

- Requires `ai-data-pack.export.artifact.download`.
- Must enforce section redaction profile.
- Short-lived link, recommended 15 minutes.
- Download event must be audited.
