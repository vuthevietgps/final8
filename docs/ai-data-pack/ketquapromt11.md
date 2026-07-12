# Prompt 11 Result - PR-2.3B-4A Official/Partial Export Policy Spec

## Result

Status: `completed_policy_spec_no_code`

Prompt 11 is documentation only. It defines the policy contract for `official_export`, `partial_export`, and `cached_export` before any public lifecycle or endpoint implementation.

```text
code_changed=false
docs_changed=true
provider_calls=false
provider_mutation=false
provider_validate_only=false
public_endpoint_added=false
official_or_partial_export_code_added=false
action_import_added=false
dry_run_or_live_added=false
openai_upload_added=false
phase_3_started=false
```

## Mandatory Inputs

Reviewed inputs:

- `docs/ai-data-pack/ba-master-director-ai-data-pack-dropship-20260612.md`
- `docs/ai-data-pack/ketquapromt5.json`
- `docs/ai-data-pack/review-packets/promt5/*`
- `docs/ai-data-pack/ketquapromt6.md`
- `docs/ai-data-pack/ketquapromt6.json`
- `docs/ai-data-pack/review-packets/promt6/*`
- `docs/ai-data-pack/ketquapromt7.md`
- `docs/ai-data-pack/ketquapromt7.json`
- `docs/ai-data-pack/review-packets/promt7/*`
- `docs/ai-data-pack/ketquapromt8.md`
- `docs/ai-data-pack/ketquapromt8.json`
- `docs/ai-data-pack/review-packets/promt8/*`
- `docs/ai-data-pack/ketquapromt9.md`
- `docs/ai-data-pack/ketquapromt9.json`
- `docs/ai-data-pack/review-packets/promt9/*`
- `docs/ai-data-pack/ketquapromt10.md`
- `docs/ai-data-pack/ketquapromt10.json`
- `docs/ai-data-pack/review-packets/promt10/*`

Missing mandatory input files: none.

## Export Mode Policy

| Mode | Sync policy | Intended use | Provider call | Completion rule | Strong decision claims |
|---|---|---|---|---|---|
| `cached_export` | `export_cached` | Existing cached/read-only DB export and fixtures | Never | Export current DB data with cached metadata | Only if embedded metadata independently proves freshness; otherwise cautious |
| `official_export` | `sync_required` | Director-approved official data pack | Only through internal source-sync policy and only for approved adapters | Complete only when required critical sources pass post-sync DB assessment or an explicit Director/BA exemption exists | Allowed only for gates whose sources pass |
| `partial_export` | `sync_if_stale` | Review pack when some sources are stale, missing, unsupported, or not configured | Optional through internal source-sync policy | Complete with warnings and affected gates locked | Not allowed for affected domains |

Provider success is not enough. The post-sync DB-only assessment controls final export eligibility and decision gates.

## Source Criticality Summary

| Source | Director Pack | Marketer Pack | Freshness | Coverage | Sync method | Main blocked gates when weak |
|---|---|---|---|---|---|---|
| `google_ads` | critical | critical | <= 60 min | report date | Google Ads read-only adapter only | ads scale, campaign conclusion, marketing ROI |
| `advertising_costs` | critical | critical | <= 360 min | report date | DB-only | ads scale, profit conclusion |
| `crm_leads` | critical | critical | <= 120 min | report date | DB-only | sales today, funnel/script conclusion |
| `orders` | critical | critical | <= 60 min | report date | DB-only | profit, conversion, operations |
| `payments_or_order_payments` | critical | important | <= 120 min | report date | DB-only | cash-adjusted profit, supplier/tier2 payment conclusion |
| `finance` | critical | optional | <= 60 min | report date | DB-only | budget increase, cash safety |
| `loans_debt` | critical | optional | <= 1440 min | date range | DB-only | cash for ads, debt safety |
| `product_mapping` | critical | critical | <= 1440 min | not applicable | DB-only | ads scale, LTV, product ranking |
| `operations` | important | optional | <= 120 min | report date | DB-only | capacity/SLA conclusions |
| `decision_history` | important | optional | <= 1440 min | report date | DB-only | learning/rollback conclusions |
| `supplier_settlement` | important | optional | <= 1440 min | date range | DB-only | supplier allocation, cash-adjusted profit; exact criticality is policy-pending |
| `customer_referral` | optional | important | not supported yet | unsupported | none | LTV/referral-adjusted ads |
| `external_market` | optional | optional | not supported yet | unsupported | none | market/opportunity confidence |
| `employee_activity_payroll` | unsupported | unsupported | not supported yet | unsupported | none | employee ranking/payroll integrity; sensitive if later supported |

`payments/order_payment_evidence` in business docs maps to current source key `payments_or_order_payments`.

## Status Policy

Statuses must not be collapsed:

- `zero_value`: verified numeric zero from a covered source.
- `no_records_for_report_date`: source is fresh enough but report-date coverage found no records; not a verified business zero.
- `missing`: no usable data exists.
- `not_synced`: sync evidence is absent or no source run exists.
- `not_configured`: source/config is absent by design.
- `unsupported`: no supported local source exists.
- `stale`: source exists but exceeds freshness threshold.
- `fresh_covered`: source is fresh and coverage is covered or not applicable.
- `partial`: usable but incomplete data.
- `weak_mapping`: mapping/completeness below decision threshold.
- `estimated`: derived/forecast value.
- `realized`: observed/settled value.

## Decision Gates

Current PR-2.3B safety gates remain:

```text
canImportActionFile=false
canDryRun=false
canExecuteLive=false
```

Domain gates:

- `canGenerateActionDraft`: true only for safe draft/recommendation output; false if required metadata, warnings, or redaction rules are missing.
- `canRecommendAdsScale`: requires `google_ads`, `advertising_costs`, and `product_mapping` to be fresh/covered; budget increase also requires finance gates.
- `canConcludeProfitStrongly`: requires `orders`, `payments_or_order_payments`, `advertising_costs`, and required mapping to pass; dropship cash-adjusted profit also requires supplier settlement policy.
- `canUseLtvStrongly`: requires `customer_referral` and `product_mapping` support plus adequate order/customer mapping.
- `canRankEmployeesStrongly`: false until employee activity/payroll is supported, fresh, covered, and RBAC-approved.
- `canUseCashForBudgetIncrease`: requires `finance`, `loans_debt`, and payment evidence to pass.

## RBAC And Public Surface Policy

Proposed permission keys only; no role binding in this phase:

- `ai-data-pack.export.official.create`
- `ai-data-pack.export.partial.create`
- `ai-data-pack.export.cached.create`
- `ai-data-pack.export.status.read`
- `ai-data-pack.export.artifact.download`
- `ai-data-pack.export.sync-detail.read`
- `ai-data-pack.section.finance.read`
- `ai-data-pack.section.employee-sensitive.read`
- `ai-data-pack.section.supplier-commission.read`

Policy answers:

- Official export creator: Director or explicitly delegated internal service with `ai-data-pack.export.official.create`.
- Partial export creator: Director, or a reviewer/manager only with explicit `ai-data-pack.export.partial.create` and section redaction.
- Sync detail reader: Director or internal operator with `ai-data-pack.export.sync-detail.read`; sanitized only.
- Artifact downloader: requester, Director, or user with `ai-data-pack.export.artifact.download`, subject to section-level redaction.
- Sensitive finance/supplier/employee/payroll fields: section permissions required.
- Section-level RBAC: required.
- Investor: must not receive full Director Pack by default; use a redacted investor profile.

## Lifecycle Policy

Allowed statuses:

```text
requested
pre_assessing
syncing_sources
post_assessing
snapshotting
exporting
completed
completed_with_warnings
blocked
failed
expired
```

Cached lifecycle:

```text
requested -> snapshotting -> exporting -> completed
requested -> failed
requested -> expired
```

Official lifecycle:

```text
requested -> pre_assessing -> syncing_sources -> post_assessing -> snapshotting -> exporting -> completed
requested -> pre_assessing -> post_assessing -> snapshotting -> exporting -> completed
requested/pre_assessing/syncing_sources/post_assessing -> blocked
any non-terminal -> failed
requested -> expired
```

Partial lifecycle:

```text
requested -> pre_assessing -> syncing_sources -> post_assessing -> snapshotting -> exporting -> completed_with_warnings
requested -> pre_assessing -> post_assessing -> snapshotting -> exporting -> completed_with_warnings
requested/pre_assessing/syncing_sources/post_assessing -> blocked only for security, RBAC, or artifact safety failures
any non-terminal -> failed
requested -> expired
```

## Snapshot And Artifact Policy

Snapshot point:

- After post-assessment and before export rendering.
- The snapshot must include source assessments, decision gates, policy version, redaction profile, row counts, and manifest.

Required artifact metadata:

- `data_content_checksum`
- `runtime_export_checksum`
- `artifact_checksum`
- manifest with files, pack types, format, row counts, source metadata, warnings, blocking reasons
- `contains_pii`
- `redaction_level`
- retention class
- download expiry

Recommended retention defaults:

- Official exports: 90 days.
- Partial exports: 30 days.
- Cached exports: 7 days unless already covered by existing cached artifact policy.
- Download links: short lived, recommended 15 minutes.

## ChatGPT Web Behavior

Data Pack metadata must make ChatGPT Web aware of:

- export mode: official, partial, or cached.
- stale/missing/not configured/unsupported sources.
- affected decision gates.
- warnings and blocking reasons.
- no false zero rules.
- estimated versus realized values.
- expected/confirmed/received cash separation.
- action output is draft only.

ChatGPT Web must not create executable actions, provider mutations, dry-run requests, payroll changes, supplier penalties, or live ads changes.

## Future Implementation Requirements

No code was written in Prompt 11. Future implementation must add tests for:

- official export blocks when a critical source is stale and sync fails.
- partial export completes with warnings and locked gates.
- cached export never syncs.
- Google Ads sync uses only the internal adapter policy.
- post-sync DB-only assessment controls gates.
- public endpoint RBAC denies unauthorized users.
- artifact download requires permission.
- section-level redaction works.
- no action/import/dry-run/live gate opens.
- no provider mutation or validateOnly is reachable.
- no false zero.

## Next Recommendation

Stop after Prompt 11.

Possible next phase, only after review:

```text
PR-2.3B-4B - Official/Partial Export Lifecycle Implementation, internal only
```

If RBAC or public artifact policy is still disputed, use this instead:

```text
PR-2.3B-4B - RBAC/Artifact/Download Technical Spec, no code
```

Do not jump to OpenAI/upload/action import/dry-run/live execution or Phase 3.
