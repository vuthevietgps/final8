# Mutation Risk Map

Every path below is forbidden from pre-export sync, including provider
`validateOnly` paths.

| Forbidden capability | Existing path | Current guard | Additional adapter guard required |
|---|---|---|---|
| Create Search campaign and budget | `GoogleAdsOperationBuilderService.createSearchCampaign` -> provider validation/execution | New campaign is forced `PAUSED`; validation/approval/execution guards exist | Adapter module must not import builder or action pipeline |
| Create ad group | `GoogleAdsOperationBuilderService.createAdGroup` | New group forced `PAUSED` | Same hard dependency exclusion |
| Create keyword | `GoogleAdsOperationBuilderService.createKeyword` | Keyword created `PAUSED` | Same hard dependency exclusion |
| Create RSA | `GoogleAdsOperationBuilderService.createResponsiveSearchAd` | RSA created `PAUSED` | Same hard dependency exclusion |
| Update campaign budget | `GoogleAdsOperationBuilderService.updateCampaignBudget` | Requires budget ID/resource name | Same hard dependency exclusion; never infer budget ID from campaign/ad-group ID |
| Pause/resume campaign or ad group | `GoogleAdsOperationBuilderService`; `AdGroupAutoControlService.pauseGoogleAdGroup` | Action execution guards exist; auto-control currently disabled until approval integration | Adapter transport must reject every non-`searchStream` Google Ads URL |
| Validate mutation | `GoogleAdsProviderValidationService.validatePlan/validateAction` -> `googleAds:mutate`, `validateOnly=true` | Plan state and permission `google-ads.plan` | Still forbidden: it constructs mutation operations and belongs to execution preparation |
| Execute action plan | `GoogleAdsExecutionService.execute/callProvider` -> `googleAds:mutate`, `validateOnly=false` | Approval, provider validation, idempotency, production/provider/dry-run flags, `google-ads.execute` | Never import/inject/call from adapter |
| Emergency/automatic pause | `AdGroupAutoControlService.pauseGoogleAdGroup`; emergency-action workflows | Auto-control cron currently returns early because approval policy is not integrated | Never import/inject/call from adapter |
| Optimization budget/status apply | `BudgetApplyService` Google methods | Existing optimization/safety checks vary | Never import/inject/call from adapter |
| Future keyword/ad status or delete operations | No approved pre-export path | Not applicable | Adapter contract must deny all mutate/delete/create/update/status operations by invariant |

## No-mutation invariant

The future adapter must prove all of the following:

1. The only allowed provider origin is `https://googleads.googleapis.com`.
2. The only allowed provider path suffix is
   `/customers/{allowlistedCustomerId}/googleAds:searchStream`.
3. The only allowed HTTP method is `POST` with a GAQL query body.
4. No generic provider client, mutate method, operation builder, action service,
   or execution service is reachable from the adapter dependency graph.
5. Provider `validateOnly` is not considered read-only adapter behavior.
6. Local writes are limited to the approved cache and sync-run collections.
7. `canImportActionFile`, `canDryRun`, and `canExecuteLive` remain false.

The current query-string `mutate` regex is defense-in-depth only. The endpoint
allowlist and dependency-graph tests are the primary controls.

