# 03 RBAC Profile Guard

Added internal guard service:

```text
ExportRbacPolicyService
```

The guard checks explicit permissions and requested redaction profile. It does not bind broad Director/Manager roles.

Create permissions:

- `ai-data-pack.export.official.create`
- `ai-data-pack.export.partial.create`

Profile permissions:

- `ai-data-pack.profile.director-full`
- `ai-data-pack.profile.director-redacted`
- `ai-data-pack.profile.manager-marketer`
- `ai-data-pack.profile.finance-operator`
- `ai-data-pack.profile.reviewer-partial`
- `ai-data-pack.profile.investor-redacted`
- `ai-data-pack.profile.external-consultant-redacted`
- `ai-data-pack.profile.system-internal-worker`

Fail-closed behavior:

- Missing permission or profile -> `blocked`
- Audit event -> `rbac_denied`
- No source sync
- No artifact

System internal worker cannot download artifacts.
