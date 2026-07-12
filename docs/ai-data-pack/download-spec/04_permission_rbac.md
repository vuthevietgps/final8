# Permission And RBAC Contract

Download RBAC must fail closed.

## Required Future Permissions

Prompt 23 requires these permission names for the future implementation:

```text
ai-data-pack.export.artifact.download
ai-data-pack.export.artifact.download.cached
ai-data-pack.export.artifact.download.official
ai-data-pack.export.artifact.download.partial
ai-data-pack.export.artifact.download-token.create
ai-data-pack.export.artifact.download.audit.read
```

The current code has a broad internal constant:

```text
ai-data-pack.export.download
```

That constant must not be treated as sufficient for the future public download endpoint unless a later implementation phase explicitly migrates or maps it to the new granular permissions.

## Profile Rules

| Profile/role | Download posture |
|---|---|
| `director_full` / admin-equivalent | May download allowed artifacts for the bound redaction/section profile. Still no raw secrets, raw provider payload, or storage key. |
| `director_redacted` | May download only redacted artifacts matching profile. |
| `manager_marketer` | May download only assigned marketer-scoped cached/partial artifacts. No full finance, supplier, employee, payroll, customer PII, or director full file. |
| `finance_operator` | May download assigned finance-scoped redacted artifacts only if separately granted. No marketing raw sync or customer PII by default. |
| `investor_redacted` | May download redacted summary artifacts only when explicitly assigned and permissioned. No full director pack. |
| `external_consultant_redacted` | May download redacted assigned artifacts only. No finance detail, PII, sync detail, audit detail, or full director pack. |
| `reviewer_partial` | May download assigned partial artifacts only. |
| `unassigned_reviewer` | Denied with no job/artifact leak. |
| `system_internal_worker` | No human download surface by default. |

## Ownership And Assignment

Authorization must check more than role:

- Permission name.
- Redaction profile permission.
- Section access profile compatibility.
- Tenant/scope ownership.
- Job ownership or approved assignment.
- Artifact ownership by job.
- Pack type and format compatibility.
- Export mode permission.

Director/admin override must be explicit and audited. Manager/investor/consultant access must be assignment-bound.

## Denial Shape

- Missing permission or profile mismatch: generic `403`.
- Tenant/job owner mismatch where existence must not leak: generic `404` style.
- System worker human download: generic `403`.
- Unassigned reviewer: generic `404` style when job existence should be hidden.

Internal audit may store sanitized reason categories, but user responses must not reveal sensitive business detail.

