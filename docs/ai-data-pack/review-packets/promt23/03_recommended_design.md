# Recommended Design

Default:

```text
Option A first: authenticated direct download/proxy.
Option B later only if real browser/storage constraints require tokenized download.
```

Rationale:

- Reuses the current guarded public endpoint pattern.
- Keeps authorization at request time.
- Keeps audit, rate-limit, and no-leak denial simpler.
- Avoids token replay/revocation surface in the first implementation.

Future implementation should extend existing module boundaries:

- `ExportJobEndpointController`
- `ExportJobEndpointService`
- `ExportEndpointPolicyService`
- `ExportEndpointAuditService`
- `ExportEndpointRateLimitService`
- `ExportJobArtifactService`
- `AiDataPackExportJobService`

No implementation was added in Prompt 23.

