# Security Negative Tests

Automated negative coverage:

| Boundary | Evidence | Result |
|---|---|---|
| Manager official download denied | `denies manager official artifact download even when the job is owned` | passed |
| System internal worker denied | `denies system_internal_worker profile for artifact download` | passed |
| Unassigned reviewer no-leak denial | `denies unassigned_reviewer profile for artifact download` | passed |
| Manifest-only/deferred artifact blocked | `returns 409 for official manifest-only deferred artifacts` | passed |
| Checksum mismatch blocked | `returns 409 when artifact checksum metadata does not match storage` | passed |
| Forbidden query inputs rejected early | `rejects forbidden download query fields before reading the artifact` | passed |
| Investor status-only | `keeps investor role status-only across public export endpoints` | passed |
| No sensitive response fields | `does not expose tokens, artifact bytes, public URLs, or storage paths in create/status/detail` | passed |
| No download token route | `defines only the direct artifact download route and leaves legacy GET exports unchanged` | passed |
| No forbidden dependencies | `does not import provider mutation, validateOnly, OpenAI upload, or action import dependencies` | passed |

Security conclusion:

- Prompt 26 does not add new product code.
- Prompt 24/25 endpoint and rendering gates remain the security boundary.
- Manual ChatGPT Web use is a human handoff only.
- No ERP route imports or executes ChatGPT Web output.

