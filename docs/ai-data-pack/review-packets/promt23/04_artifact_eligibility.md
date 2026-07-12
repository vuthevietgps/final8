# Artifact Eligibility

Download can be allowed only when:

- Job exists and belongs to actor tenant/scope.
- Actor has download permission.
- Actor owns/is assigned to the job or has explicit director/admin override.
- Job status is `completed` or `completed_with_warnings`.
- Artifact exists and belongs to the job.
- Artifact format is `json` or `xlsx`.
- Artifact profile matches actor redaction and section access profile.
- Artifact is rendered, redacted, not manifest-only, and not raw/internal.
- File exists and checksum/size match manifest.
- Artifact is not expired, revoked, or quarantined.

Current blocker:

```text
official_partial_artifact_rendering=deferred
official_partial_redaction_runtime=manifest_only
official_partial_download_ready=false
```

Blocked cases include non-completed jobs, profile mismatch, tenant mismatch, owner mismatch, unassigned reviewer, investor full file, manager restricted detail, and system worker human download.

