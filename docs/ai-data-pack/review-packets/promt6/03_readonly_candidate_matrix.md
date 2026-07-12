# Read-only Candidate Matrix

| Classification | File / class or function | Provider read | Provider write | Local write | Recommendation |
|---|---|---:|---:|---:|---|
| `safe_read_only_candidate` after guards | `google-ads-readonly-sync.service.ts` / `GoogleAdsReadonlySyncService.sync` | Yes, `searchStream` | No | Yes, Google cache + sync run | Wrap only this method in a new isolated internal adapter; do not expose the class/module broadly |
| `read_only_but_needs_guard` | `advertising-cost.google-sync.service.ts` / `AdvertisingCostGoogleSyncService` | Yes, `searchStream` | No | Yes, `advertisingcosts`; cron helper can queue recalculation | Do not reuse for Google Ads source adapter; separately extract/audit only if advertising-cost provider sync is later approved |
| `read_only_but_needs_guard` | `emergency-action-verification.service.ts` / Google verification methods | Yes, `searchStream` | No | Reads local task/account context | Do not use; emergency-action coupling and weaker isolation/redaction |
| `unclear_needs_manual_review` | `ad-account.timezone-check.service.ts` / `validateGoogle` | Yes, customer read | No | None in method | Keep in account-management workflow; not a data-pack adapter |
| `read_only_but_needs_guard` | `google-ads-export.service.ts` / `GoogleAdsExportService` | No | No | ZIP file + export audit | Local export only; never treat as provider freshness sync |
| `execution_path_do_not_call` | `google-ads-evaluation.service.ts` | Indirectly | No | Evaluation state | Never inject into pre-export |
| `execution_path_do_not_call` | `google-ads-post-execution.service.ts` | Indirectly | No | Change logs and evaluation jobs | Never inject into pre-export |
| `unsafe_mutation_capable` | `google-ads-operation-builder.service.ts` | No | Prepares mutations | No | Never import/inject into adapter module |
| `execution_path_do_not_call` | `google-ads-provider-validation.service.ts` | No | Yes, `mutate validateOnly=true` | Action-plan validation state | Forbidden even though provider does not apply the mutation |
| `execution_path_do_not_call` | `google-ads-execution.service.ts` | No | Yes, live mutate | Execution/action logs | Forbidden |
| `execution_path_do_not_call` | Action-plan import/approval/policy services | Local only | Indirect pipeline capability | Action plan state | Forbidden |
| `unsafe_mutation_capable` | `ad-group.auto-control.service.ts` / `pauseGoogleAdGroup` | No | Yes, `adGroups:mutate` | Ad-group control state | Forbidden |
| `unsafe_mutation_capable` | `advertising-optimization/ai-optimization/budget-apply.service.ts` | No | Yes, Google mutation endpoints | Optimization state | Forbidden |

## Required future module boundary

Create a dedicated internal Google Ads read-only adapter module that exports only
the adapter token/interface. It may depend on credential access, an allowlisted
read-only transport, the approved cache repositories, sync-run audit, lock
service, and existing source-registry/freshness services.

It must not import or inject `GoogleAdsModule` as a broad capability container.
It must not import operation building, action plans, validation, approval,
execution, emergency action, evaluation, or post-execution services.

