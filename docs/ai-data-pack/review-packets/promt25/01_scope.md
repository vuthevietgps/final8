# Scope

In scope:

- Render downloadable redacted JSON artifacts for official/partial jobs.
- Persist explicit artifact type/readiness metadata.
- Update manifest readiness after successful file write/checksum.
- Preserve Prompt 24 direct authenticated download endpoint.
- Add artifact-level download readiness gates.
- Add render audit events.
- Add focused tests and static checks.

Out of scope:

- XLSX rendering for official/partial.
- OpenAI upload.
- Action import.
- Approval workflow.
- Dry-run/live execution.
- Provider mutation.
- Provider validateOnly.
- New provider adapter.
- Tokenized download.
- Public/signed storage URL.
- Phase 3.

Missing optional inputs are recorded in `ketquapromt25.json`; none blocked this implementation.
