# Audit And Observability

Render events:

- `artifact_render_requested`
- `artifact_render_started`
- `artifact_render_completed`
- `artifact_render_failed`
- `artifact_render_skipped_not_supported`
- `artifact_generated`

Audit details are bounded to safe metadata:

- actor id
- export mode
- pack type
- format
- redaction profile
- artifact id
- file size
- checksum algorithm

Audit does not include:

- artifact bytes
- raw file contents
- raw storage path/key
- raw provider payload
- credentials
- tokens
- raw PII
- stack trace

Existing download audit/observability from Prompt 24 is preserved.
