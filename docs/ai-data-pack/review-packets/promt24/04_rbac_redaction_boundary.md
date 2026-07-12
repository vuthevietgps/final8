# RBAC And Redaction Boundary

Granular permissions added:

- `ai-data-pack.export.artifact.download`
- `ai-data-pack.export.artifact.download.cached`
- `ai-data-pack.export.artifact.download.official`
- `ai-data-pack.export.artifact.download.partial`
- `ai-data-pack.export.artifact.download.audit.read`

The legacy broad permission `ai-data-pack.export.download` is not sufficient for the new endpoint.

Role mapping exception:

- Director receives base, cached, official, partial, and artifact-download audit permissions.
- Manager receives base, cached, and partial download permissions only.
- Investor and internal agents receive no download permission by default.

Fail-closed rules:

- System internal worker is denied human download.
- Unassigned reviewer receives no-leak denial.
- Manager marketer is limited to assigned cached/partial marketer artifacts.
- Investor is denied director/full artifact download.
- Non-director actors must own/be assigned to the job.
- Non-director actors must match redaction profile and section access profile.

Forbidden query inputs are rejected before job lookup, including raw/internal/override/token/public URL/provider/action/live execution fields.
