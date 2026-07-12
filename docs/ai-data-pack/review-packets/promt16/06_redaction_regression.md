# Redaction Regression

The regression coverage verifies public endpoint responses remain metadata-only and do not expose artifact retrieval or execution surfaces.

Checked success response surfaces:

- Create response.
- Status response.
- Detail response.
- Sync summary response.

Forbidden fields guarded by tests and static checks include:

- `artifactBytes`
- `downloadToken`
- `publicUrl`
- `storageLocation`
- `storageKey`
- action import fields
- OpenAI upload fields
- dry-run/live execution fields
- provider mutation fields
- `validateOnly` public route behavior

The endpoint audit sanitizer was tightened so forbidden detail keys are omitted from persistent endpoint audit details.

Result:

- Public endpoint output remains redacted and does not provide a path to retrieve, import, upload, validate, mutate, dry-run, or execute artifacts.
