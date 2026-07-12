# Artifact Eligibility

Download may be allowed only when every condition is true.

## Required Conditions

- Job exists.
- Job belongs to the actor tenant/scope.
- Actor has read/download permission.
- Actor is the job owner, assigned reviewer/consultant, or a policy-approved director/admin.
- Job status is `completed` or `completed_with_warnings`.
- Artifact exists in the job manifest or artifact list.
- Artifact belongs to the requested job.
- Artifact `packType` is allowed for the actor profile.
- Artifact `format` is `json` or `xlsx`.
- Artifact redaction profile matches the actor-requested/actor-bound profile.
- Artifact section access profile matches the actor-bound section access profile.
- Artifact is a rendered downloadable redacted artifact, not a raw/internal artifact.
- File exists in the server-controlled artifact store.
- File size matches manifest/artifact metadata.
- Checksum matches the redacted downloadable artifact checksum.
- Artifact is not expired, revoked, quarantined, or superseded by policy.
- Artifact is not marked `manifest_only`.

## Current Official/Partial Readiness

Official and partial lifecycle currently records:

```text
redaction_runtime=manifest_only
artifact_rendering=deferred
download_ready=false
```

Therefore:

- Official/partial artifacts are not downloadable yet.
- A future implementation must return a safe not-ready response until actual rendered/redacted files exist.
- The endpoint must not synthesize artifact bytes from manifest metadata.
- The endpoint must not stream raw/internal placeholder files.

## Cached Artifact Note

The current cached export path has artifact records with file name, storage key, checksum, and size. Cached download still must be permission-gated with `ai-data-pack.export.artifact.download.cached`, profile-bound, audited, and clearly labeled as cached/not official for decision quality.

## Blocked Conditions

Download is denied or not ready when:

- Job status is `pending`, `requested`, `pre_assessing`, `syncing_sources`, `post_assessing`, `snapshotting`, `exporting`, `blocked`, `failed`, or `expired`.
- `artifact_rendering=deferred`.
- `redaction_runtime=manifest_only` and no actual redacted file exists.
- Artifact is manifest-only.
- Actor profile mismatches artifact profile.
- Section access profile mismatches artifact profile.
- Tenant/scope mismatches.
- Job owner/assignment mismatches.
- Reviewer is unassigned.
- Investor asks for full director artifact.
- Manager asks for finance, employee, supplier, customer, or full director detail outside profile.
- External consultant asks for unassigned or non-redacted data.
- `system_internal_worker` asks for human download.
- Checksum, size, or file existence validation fails.

## Future Implementation Requirement

A later implementation must add an explicit eligibility decision object before streaming begins. It should be testable without reading or streaming bytes.

