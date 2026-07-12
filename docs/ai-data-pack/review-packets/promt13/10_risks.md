# 10 Risks

Remaining risks:

- Row-level redaction is not implemented.
- Official/partial artifact rendering is deferred.
- Full artifact bytes are not generated for official/partial exports.
- Public create/status endpoint is not ready.
- Download endpoint and token policy are not ready.
- OpenAI upload is not ready.
- Endpoint authorization and response redaction still need their own phase.

Mitigations in this phase:

- Manifest-only output.
- Internal storage key only.
- No public endpoint.
- No download path.
- No source sync for cached export.
- RBAC denied jobs block before source sync and artifact generation.
