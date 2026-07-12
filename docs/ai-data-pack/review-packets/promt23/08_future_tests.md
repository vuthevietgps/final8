# Future Tests

Future implementation must test:

- Authorized director download succeeds for allowed artifact.
- Manager cannot download official/full director artifact.
- Investor can only download assigned redacted artifact if explicitly allowed.
- External consultant only assigned redacted artifact.
- Reviewer partial only assigned partial artifact.
- Unassigned reviewer denied/no leak.
- System worker denied human download.
- Job not completed returns not ready.
- `artifact_rendering=deferred` returns not ready.
- Manifest-only artifact is not streamed.
- Redaction profile mismatch denied.
- Tenant/job owner mismatch no leak.
- Forbidden params rejected.
- No storage path, public URL, signed URL, provider payload, tokens, stack trace, or PII in response.
- Filename sanitized.
- Checksum/content length match manifest.
- Audit events emitted.
- Rate limits enforced.
- Token expiry/replay/revocation if tokenized.
- No OpenAI upload.
- No action import.
- No dry-run/live.
- No provider mutation.
- No provider validateOnly.

