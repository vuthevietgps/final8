# RBAC And Redaction

Required future permissions:

```text
ai-data-pack.export.artifact.download
ai-data-pack.export.artifact.download.cached
ai-data-pack.export.artifact.download.official
ai-data-pack.export.artifact.download.partial
ai-data-pack.export.artifact.download-token.create
ai-data-pack.export.artifact.download.audit.read
```

Existing broad permission `ai-data-pack.export.download` must not be treated as sufficient for public download without an explicit future migration/mapping.

Redaction boundary:

- Download serves only pre-rendered, pre-redacted artifacts.
- Client parameters cannot override role, section, redaction, raw data, PII, secrets, or format beyond the manifest artifact.
- Checksum must match the downloadable redacted artifact, not raw/internal content.
- Manifest must distinguish raw/internal artifacts from downloadable redacted artifacts.

Default profile posture:

- Director/admin: allowed only for matching policy-bound artifact.
- Manager: assigned marketer-scoped only.
- Investor: assigned redacted summary only.
- External consultant: assigned redacted only.
- Reviewer partial: assigned partial only.
- System internal worker: denied human download.

