# Prompt 12 Result - PR-2.3B-4B RBAC / Artifact / Download Technical Spec

## Result

Status: `completed_rbac_artifact_download_spec_no_code`

Prompt 12 is documentation only. It locks down the RBAC, redaction, artifact manifest, download authorization, expiry, and audit policy before any official/partial export lifecycle or public endpoint implementation.

```text
code_changed=false
docs_changed=true
migration_added=false
endpoint_added=false
role_binding_added=false
artifact_storage_implemented=false
download_implemented=false
official_partial_lifecycle_implemented=false
provider_call=false
provider_mutation=false
provider_validate_only=false
action_import_added=false
approval_workflow_added=false
dry_run_or_live_added=false
openai_upload_added=false
phase_3_started=false
```

## Mandatory Inputs

Reviewed inputs:

- `docs/ai-data-pack/ba-master-director-ai-data-pack-dropship-20260612.md`
- `docs/ai-data-pack/ketquapromt10.md`
- `docs/ai-data-pack/ketquapromt10.json`
- `docs/ai-data-pack/review-packets/promt10/*`
- `docs/ai-data-pack/ketquapromt11.md`
- `docs/ai-data-pack/ketquapromt11.json`
- `docs/ai-data-pack/review-packets/promt11/*`

Optional inputs requested by Prompt 12 were not present:

- `docs/ai-data-pack/chuoi-promt-codex-chatgptweb-ledger*.md`
- `docs/ai-data-pack/lo-trinh-ai-data-pack-roadmap*.md`
- `docs/ai-data-pack/truc-giu-ba-ai-data-pack*.md`

## Permission Matrix

| Permission | Purpose | Allowed actors | Denied actors | Data exposure | Audit requirement |
|---|---|---|---|---|---|
| `ai-data-pack.export.official.create` | Request official export | `director_full`, approved service actor | investor, external consultant, default manager | job metadata, no artifact by itself | `export_requested` |
| `ai-data-pack.export.partial.create` | Request partial export | director, approved manager/reviewer | investor, external consultant | job metadata, warnings | `export_requested` |
| `ai-data-pack.export.cached.create` | Request cached export | director, approved internal users | external anonymous users | cached DB-derived pack | `export_requested` |
| `ai-data-pack.export.status.read` | Read job status | requester, director, approved reviewer | unrelated users | status, sanitized warnings | `sync_detail_viewed` only if sync details included |
| `ai-data-pack.export.artifact.download` | Download generated artifact | requester/director/approved recipient with matching redaction profile | public, expired token, profile mismatch | artifact bytes under redaction policy | `artifact_downloaded` or `download_denied` |
| `ai-data-pack.export.sync-detail.read` | Read source-sync details | director, system operator | manager by default, investor, external consultant | sanitized source status, no raw provider payload | `sync_detail_viewed` |
| `ai-data-pack.export.audit.read` | Read export audit log | director, security/admin operator | manager by default, investor, external consultant | audit metadata, no secrets | `sensitive_section_accessed` |
| `ai-data-pack.section.finance.read` | Read finance sections | director, finance operator | manager/marketer/investor by default | balances, debt, cashflow according to redaction | `sensitive_section_accessed` |
| `ai-data-pack.section.employee-sensitive.read` | Read employee/payroll sections | director, approved HR/finance operator | manager/marketer/investor/external by default | employee activity, payroll integrity | `sensitive_section_accessed` |
| `ai-data-pack.section.supplier-commission.read` | Read supplier/tier2 commission | director, finance operator | manager/marketer/investor/external by default | supplier/tier2 amounts and timing | `sensitive_section_accessed` |
| `ai-data-pack.section.customer-pii.read` | Read customer PII | director or approved customer-support profile | investor/external/marketer by default | phone/email/address/name | `sensitive_section_accessed` |
| `ai-data-pack.section.investor-redacted.read` | Read investor-safe pack | assigned investor/board recipient | users without assigned artifact | aggregate and redacted business metrics | `artifact_downloaded` |

Implementation notes:

- These are proposed permissions only; no role binding is approved by this spec.
- Permission checks must be evaluated with redaction profile and artifact manifest, not only by endpoint route.
- Denials must be fail-closed and audited.
- `google-ads.read` never authorizes source-sync execution or artifact download.

## Role And Redaction Profiles

| Profile | Export modes | Create export | Status | Download | Sync detail | PII | Redaction level |
|---|---|---|---|---|---|---|---|
| `director_full` | official, partial, cached | yes | yes | yes | yes | allowed if purpose-bound | `show_full` |
| `director_redacted` | official, partial, cached | yes | yes | yes | yes, sanitized | no raw PII by default | `mask_sensitive` |
| `manager_marketer` | partial, cached | partial/cached only if granted | own/assigned | redacted only | no by default | no | `business_redacted` |
| `finance_operator` | partial, cached, assigned official support | limited | assigned | finance-scoped artifacts | sanitized | no customer PII by default | `finance_scoped` |
| `reviewer_partial` | partial | yes if granted | assigned | redacted only | no | no | `review_redacted` |
| `investor_redacted` | assigned redacted artifacts only | no | assigned summary only | investor-redacted only | no | no | `investor_redacted` |
| `external_consultant_redacted` | assigned redacted artifacts only | no | assigned summary only | external-redacted only | no | no | `external_redacted` |
| `system_internal_worker` | internal job execution only | service-triggered only | no human status by default | no automatic download | write sanitized audit only | no | `system_no_download` |

Hard rules:

- Investor must not receive full Director Pack by default.
- Manager/Marketer must not see finance, supplier, employee, payroll, or customer PII by default.
- External consultant receives redacted packs only.
- System internal worker may run a job but must not download artifacts unless a separate audited service policy exists.

## Section-level RBAC

| Section | Sensitivity | Default visibility | Redaction rule | Download | ChatGPT Web interpretation |
|---|---|---|---|---|---|
| `executive_summary` | business_sensitive | director, manager redacted, investor redacted | remove sensitive detail by profile | yes, profile-bound | summarize only within visible data |
| `ads_performance` | business_sensitive | director, manager | mask provider account IDs for non-director | yes | ads conclusions only if gates pass |
| `marketing_costs` | financial_sensitive | director, finance, manager aggregate | aggregate for manager/investor | yes | do not infer cash safety |
| `sales_funnel` | business_sensitive | director, manager | mask customer identifiers | yes | funnel claims depend on CRM freshness |
| `orders` | business_sensitive | director, manager aggregate | hide customer PII, bucket order values for investor | yes | distinguish realized/estimated |
| `payments` | financial_sensitive | director, finance | aggregate or hide for others | director/finance only | no cash conclusion if hidden |
| `finance_cash` | financial_sensitive | director, finance | aggregate/bucket outside director | restricted | budget gates only if visible and fresh |
| `loans_debt` | financial_sensitive | director, finance | aggregate/bucket outside director | restricted | debt-safety claims require permission |
| `supplier_settlement` | supplier_sensitive | director, finance | mask supplier names/IDs for non-authorized | restricted | supplier allocation cautious if redacted |
| `supplier_commission` | supplier_sensitive | director, finance | aggregate or hide | restricted | no strong supplier cash claim when hidden |
| `tier2_agent_commission` | supplier_sensitive | director, finance | aggregate or hide | restricted | no tier2 obligation claim when hidden |
| `customer_pii` | pii_sensitive | director or approved support only | mask/hash for others | restricted | ChatGPT must know PII omitted |
| `employee_activity` | employee_sensitive | director/approved HR only | aggregate or hide | restricted | no employee ranking if hidden |
| `payroll_integrity` | employee_sensitive | director/finance/approved HR only | aggregate or hide | restricted | no payroll conclusion if hidden |
| `decision_history` | audit_sensitive | director, reviewer redacted | hide actor details for non-director | yes redacted | learning claims require visible history |
| `data_quality` | business_sensitive | all assigned profiles | no raw secrets/errors | yes | must be read before analysis |
| `mapping_report` | business_sensitive | director, manager, reviewer | mask IDs for external/investor | yes | mapping weakness locks decisions |
| `operations_sla` | business_sensitive | director, manager aggregate | aggregate employee/customer detail | yes | capacity conclusions only if fresh |
| `artifact_manifest` | audit_sensitive | artifact recipient redacted, director full | no storage secret or internal path leak | yes | identify missing sections and checksums |
| `sync_detail` | audit_sensitive | director/operator only | sanitized categories only | no broad download | provider success not freshness |
| `audit_log` | audit_sensitive | director/security operator | no secrets, no raw provider payload | restricted | security history, not business metric |

## Public/Internal Surface Contract

Future surfaces are specifications only:

| Surface | Purpose | Permission | Input fields | Forbidden input | Output | Audit |
|---|---|---|---|---|---|---|
| internal service method | start prepared export job | service identity + specific create permission | mode, reportDate, packTypes, formats, redactionProfile, requester | raw token, raw provider query, mutation/action payload | job ID, status | `export_requested` |
| future admin/director create endpoint | request official/partial/cached export | create permission by mode | mode, reportDate, packTypes, formats, redactionProfile, idempotencyKey | provider credentials, provider query, action plan, dry-run/live flags | job summary | `export_requested` |
| future status endpoint | read status | `ai-data-pack.export.status.read` | jobId | artifact path, token override | status, sanitized warnings, allowed actions | `sync_detail_viewed` if details included |
| future download endpoint | download artifact | `ai-data-pack.export.artifact.download` + matching profile | artifactId or token | raw storage path, redaction override | file stream or denied | `artifact_downloaded` / `download_denied` |
| future sync-detail endpoint | inspect sync details | `ai-data-pack.export.sync-detail.read` | jobId, sourceKey | raw provider response, raw token | sanitized source/audit summary | `sync_detail_viewed` |
| future audit endpoint | inspect audit events | `ai-data-pack.export.audit.read` | jobId/artifactId/time range | secrets, raw payload filters | sanitized audit records | `sensitive_section_accessed` |

Security denial behavior:

- Return generic denial reason to caller.
- Record exact permission/profile mismatch in audit metadata.
- Never include secrets, provider raw payload, storage absolute path, or stack trace.

## Artifact Manifest And Storage Policy

Manifest fields:

```text
artifactId
exportJobId
exportMode
syncPolicy
policyVersion
redactionProfile
sectionAccessProfile
packTypes
formats
rowCounts
sourceFreshnessMetadata
sourceCoverageMetadata
decisionGates
warnings
blockingReasons
containsPii
containsFinancialSensitive
containsEmployeeSensitive
containsSupplierSensitive
dataContentChecksum
runtimeExportChecksum
artifactChecksum
createdAt
expiresAt
retentionUntil
storageLocation
downloadPolicy
```

Rules:

- `storageLocation` must be an internal storage key, not a public URL.
- Manifest must not contain raw secrets, raw provider payloads, OAuth tokens, refresh tokens, stack traces, or raw PII unless protected by section manifest and permission.
- Checksums must distinguish stable data content from runtime export metadata and artifact bytes.

## Download Authorization And Expiry

Policy:

- Download token is short-lived; recommended expiry is 15 minutes.
- Default token mode is one-time use.
- Multi-use tokens require explicit internal policy, max use count, and audit reason.
- Authorization requires requester match or delegated permission, artifact permission, redaction profile match, non-expired artifact, and non-revoked token.
- Every success and failure is audited.

Forbidden:

- Public unauthenticated links.
- Permanent links.
- Download without audit.
- Download that ignores redaction profile.
- Download by system worker without explicit service audit policy.

## Audit Events

Required events:

```text
export_requested
pre_assessment_started
source_sync_started
source_sync_completed
post_assessment_completed
export_blocked
export_downgraded
artifact_generated
download_token_created
artifact_downloaded
download_denied
sync_detail_viewed
sensitive_section_accessed
rbac_denied
artifact_expired
artifact_deleted
```

Every event must include:

- actor
- target
- `exportJobId`
- `artifactId` if applicable
- `sourceKey` if applicable
- permission checked
- redaction profile
- timestamp
- sanitized metadata
- no raw secrets

## Sensitive Data Redaction Policy

| Data class | Default rule | Allowed transforms |
|---|---|---|
| finance balances | restricted to director/finance | show_full, aggregate, bucket, hide |
| loan/debt detail | restricted to director/finance | show_full, aggregate, bucket, hide |
| supplier commission | restricted to director/finance | show_full, aggregate, mask supplier, hide |
| tier2 agent commission | restricted to director/finance | show_full, aggregate, hash agent, hide |
| customer phone/email/address | restricted support/director only | mask, hash, hide |
| employee attendance/activity/payroll | restricted director/HR/finance | aggregate, bucket, hide |
| raw sync errors | never raw in artifacts | sanitized category, hide |
| provider account IDs | director/operator only | mask, hash, hide |
| campaign/ad IDs | visible for marketing if needed | show_full, mask, hash |
| personal names | purpose-bound | show_full, mask, hash, hide |

## ChatGPT Web Safety

Data Pack must tell ChatGPT Web:

- export mode.
- redaction profile.
- missing sections due to RBAC.
- locked decision gates.
- source status.
- warnings and blocking reasons.
- what not to conclude.
- action output is draft only.

Redacted artifacts must explicitly say they are redacted. ChatGPT Web must not interpret omitted sections as zero values or complete data.

## Future Test Plan

Implementation phase tests must cover:

- unauthorized user cannot create official export.
- manager cannot download full director artifact.
- investor receives redacted artifact only.
- finance section hidden without permission.
- employee/payroll hidden without permission.
- supplier commission hidden without permission.
- customer PII masked without permission.
- download token expires after policy window.
- one-time token cannot be reused.
- download event audited.
- download denial audited.
- sync detail sanitized.
- artifact manifest contains checksums and sensitivity flags.
- cached export still never syncs.
- official/partial export respects section-level RBAC.
- no action/import/dry-run/live gate opened.

## Next Recommendation

Stop after Prompt 12.

If the spec is accepted:

```text
PR-2.3B-4C - Official/Partial Export Lifecycle Implementation, internal only
```

If risks remain:

```text
PR-2.3B-4B-H1 - RBAC/Artifact Spec Fix
```

Do not jump to OpenAI/upload, action import, approval workflow, dry-run/live execution, or Phase 3.
