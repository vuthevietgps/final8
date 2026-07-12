# Security Negative Tests

Verified by endpoint tests:

- Manager official artifact download is denied.
- System internal worker human artifact download is denied.
- Unassigned reviewer receives no-leak denial.
- Investor remains status-only by default.
- Official manifest-only/deferred artifact returns `409`.
- Checksum mismatch returns `409`.
- Forbidden download query fields are rejected before job lookup.
- Create/status/detail responses do not expose token, artifact bytes, public URL, or storage path.
- Only the direct authenticated download route exists.
- Provider mutation, provider validation, OpenAI upload, action import, and execution dependencies are absent from endpoint sources.

