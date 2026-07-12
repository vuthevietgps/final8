# Future Implementation Tests

Prompt 23 does not add tests. These are future implementation requirements.

## Authorization Tests

- Authorized director download succeeds for allowed rendered artifact.
- Director redacted profile receives only matching redacted artifact.
- Manager cannot download official/full director artifact.
- Manager cannot download finance, employee, supplier, or customer detail outside profile.
- Investor can only download assigned redacted summary artifact if explicitly allowed.
- External consultant can only download assigned redacted artifact.
- Reviewer partial can only download assigned partial artifact.
- Unassigned reviewer is denied with no job/artifact leak.
- System worker is denied human download.
- Tenant/job owner mismatch returns no-leak denial.

## Readiness Tests

- Job not completed returns not ready.
- `artifact_rendering=deferred` returns not ready.
- `redaction_runtime=manifest_only` returns not ready when no rendered redacted file exists.
- Manifest-only artifact is not streamed.
- Expired artifact returns gone.
- Revoked artifact returns gone.
- Quarantined artifact returns denied/unavailable.

## Data Boundary Tests

- Redaction profile mismatch denied.
- Section access profile mismatch denied.
- Forbidden params rejected.
- No storage path, storage key, public URL, signed URL, token, provider payload, stack trace, raw PII, or debug metadata in response.
- Filename sanitized.
- Content-Type correct for JSON/XLSX.
- Content-Disposition uses sanitized attachment filename.
- Checksum and content length match manifest.
- Checksum mismatch blocks streaming and audits failure.

## Audit And Rate-Limit Tests

- `artifact_download_requested` emitted.
- Denial emits `artifact_download_denied`.
- Successful stream emits started and completed.
- Failed stream emits failed without raw storage path.
- Rate limits enforced per actor, actor/job, artifact, denial, and large-file/concurrent buckets.
- Sanitized request metadata is persisted without raw IP/user-agent/header/body.

## Token Tests If Option B Is Implemented

- Token creation requires `ai-data-pack.export.artifact.download-token.create`.
- Token is stored hashed, not plaintext.
- Token is bound to actor/job/artifact/redaction profile/section profile/checksum.
- Expired token denied.
- Replayed token denied and audited.
- Revoked token denied.
- Token URL is not a public storage URL.

## Forbidden Scope Regression Tests

- No OpenAI upload.
- No action import.
- No approval workflow.
- No dry-run/live execution.
- No provider mutation.
- No provider validateOnly.
- No new provider adapter.
- No Performance Max, Shopping, Display, YouTube, or delete campaign/ad group action.

