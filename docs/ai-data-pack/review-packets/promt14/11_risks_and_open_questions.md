# 11 Risks And Open Questions

Risks:

- Endpoint implementation still needs route-level auth integration.
- Row-level redaction is still not implemented.
- Official/partial rendering remains manifest-only.
- Download endpoint and token policy remain separate future work.
- Status/job-detail responses can leak too much if profile redaction is incomplete.
- Sync summary can leak provider/account topology if not carefully sanitized.

Open questions:

- Exact per-actor and per-mode rate limit values.
- Exact 404-vs-403 job existence policy.
- Whether cached create should be exposed publicly/admin or remain internal.
- Whether `GET /exports/:jobId` should include audit summaries in the first implementation.
- Which profiles can read job details for delegated exports.
