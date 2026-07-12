# Artifact Eligibility Gates

Allowed only when all gates pass:

- Job exists.
- Job status is `completed` or `completed_with_warnings`.
- Artifact exists in the job artifact list.
- Artifact belongs to the job.
- Artifact format is `json` or `xlsx`.
- Artifact is not official/partial `artifactRendering=deferred`.
- Artifact is not official/partial `redactionRuntime=manifest_only`.
- Actor has required base, mode, and profile permissions.
- Actor owns/is assigned to the job or has director override.
- Redaction profile and section access profile are compatible.
- File is resolved safely under the configured artifact root.
- File exists and is a file.
- File size equals artifact metadata.
- SHA-256 checksum equals artifact metadata.

Blocked with safe `409`:

- Job is not completed.
- Manifest-only artifact.
- Official/partial deferred artifact.
- Official/partial manifest-only runtime.
- File missing/unavailable.
- File size mismatch.
- Checksum mismatch.

No artifact rendering was implemented.
