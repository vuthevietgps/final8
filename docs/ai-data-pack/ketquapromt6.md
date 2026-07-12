# Ket qua Prompt 6 - PR-2.3B-3A Google Ads Read-only Adapter Spec

## 1. Result

Prompt 6 is complete as a no-code technical specification and security review.

- Source code changed: no.
- Provider/API calls: no.
- Real sync: no.
- Provider mutation or validate-only: no.
- Endpoint, migration, official/partial export, action, dry-run, or live
  execution added: no.

Conclusion: a later Google Ads read-only adapter PR is feasible, but the current
read-only service must not be wired directly into pre-export orchestration
without isolation, RBAC, scope, lock, timeout/retry, rate-limit, audit, and
transport/local-write allowlist controls.

## 2. Safe candidate

The only recommended provider-sync boundary is:

```text
backend/src/google-ads/google-ads-readonly-sync.service.ts
GoogleAdsReadonlySyncService.sync()
```

Current behavior:

- Calls only Google Ads `googleAds:searchStream`.
- Reads customer, campaign, campaign budget, ad group, keyword, responsive
  search ad, and daily metrics.
- Writes local Google Ads cache collections and `google_ads_sync_runs`.
- Records status, dates, customer IDs, counts, and sanitized errors.
- Has tests for query fields and rejecting a query containing `mutate`.

This is only a conditional safe candidate. A future adapter must wrap it through
a new narrow internal module and must not expose the broad `GoogleAdsModule` or
controller/action/execution dependency graph.

## 3. Do-not-call paths

Pre-export sync must never call or inject:

- `GoogleAdsOperationBuilderService`;
- `GoogleAdsProviderValidationService`, including `validateOnly=true`;
- `GoogleAdsExecutionService`;
- action-plan import, approval, or execution-policy services;
- `GoogleAdsPostExecutionService`;
- `GoogleAdsEvaluationService`;
- `AdGroupAutoControlService`;
- advertising optimization budget/status apply services; or
- emergency-action workflows.

`AdvertisingCostGoogleSyncService`, `EmergencyActionVerificationService`, and
`AdAccountTimezoneCheckService` perform provider reads but are not safe
pre-export adapter candidates because they are coupled to other business
workflows, have weaker isolation/audit, or can cause additional local behavior.

## 4. Required adapter controls

The future adapter must:

1. Allow only `POST https://googleads.googleapis.com/.../googleAds:searchStream`.
2. Own static GAQL templates; caller-supplied URLs, methods, and GAQL are
   forbidden.
3. Fail closed on malformed, inactive, unknown, unapproved, or mismatched
   customer/login-customer scope.
4. Use a dedicated internal permission such as
   `ai-data-pack.source-sync.google-ads.readonly.execute`, not
   `google-ads.read`.
5. Keep credentials internal and return only bounded sanitized typed errors.
6. Enforce connection/request/overall deadlines, bounded transient retries with
   jitter, and rate-limit-aware concurrency.
7. Acquire a distributed lock keyed by source, customer scope, and date range.
8. Link a durable idempotent sync run to the export job.
9. Write only approved Google Ads local cache collections and sync-run audit.
10. Re-run the existing DB-only freshness and coverage gate after sync.
11. Keep `canImportActionFile=false`, `canDryRun=false`, and
    `canExecuteLive=false`.

The current query-string `mutate` rejection is useful defense-in-depth but is
not sufficient proof. The primary controls must be endpoint/method allowlisting
and a dependency graph that cannot reach mutation-capable services.

## 5. Credentials and RBAC

Google Ads runtime credentials come from environment variables or encrypted
`ApiToken` records. Database Google settings use AES-256-GCM through
`tokenEnc`/`providerConfigEnc`, and production requires `API_TOKEN_SECRET`.
OAuth refresh-token exchange is implemented. No service-account implementation
was found.

Risks:

- `ApiToken` still permits plaintext `token` and `notes`.
- `ApiTokenService` retains plaintext fallback reads for legacy records.
- Non-production crypto has a default `DEV_TOKEN_SECRET`.
- Error redaction is pattern/key based and cannot make arbitrary provider
  payloads safe.
- Current `POST /google-ads/sync/readonly` inherits `google-ads.read`, which
  Director and Manager have.
- Current sync-run detail exposes customer IDs and errors under broad read
  permission.

The future adapter PR should not add a public endpoint and should not introduce
service-account authentication without a separate review.

## 6. ExportJob and source-registry integration

Future flow, not implemented:

```text
create official/partial export job
-> DB-only source registry/freshness/coverage assessment
-> if policy allows and google_ads is stale/missing coverage
-> acquire lock
-> call narrow read-only adapter
-> write approved local cache/sync run only
-> re-run DB-only freshness/coverage
-> decide eligibility and decision gates
-> snapshot/export
```

Cached ExportJob behavior remains unchanged:

```text
cached_export=true
sync_policy=export_cached
provider_sync_attempted=false
freshness_gate_evaluated=false
```

Cached export must never invoke the adapter. A fresh local timestamp with zero
report-date Google Ads rows does not permit a strong ads-scale decision.

## 7. Main blockers before code

- Broad `GoogleAdsModule` exports read and mutation/execution capabilities
  together.
- No dedicated sync permission.
- No fail-closed customer/login-customer allowlist at the sync boundary.
- No request/overall timeout, retry/backoff, rate-limit handling, or concurrency
  limit.
- No distributed lock or provider-sync idempotency.
- No maximum range/order policy.
- Sync runs lack export-job linkage, scope hash, lock/retry/timeout details, and
  per-account durable status.
- Unexpected failures can leave sync runs in `running`.
- Existing tests do not prove exact outbound endpoint/method or local-write
  allowlists.

## 8. Missing input

```text
missing_input_file: backend/src/config/
```

The project index named in `AGENTS.md` as `docs/ai-ads-v2/00-index.md` was not
present. The available `docs/ai-ads-v2/00_README_INDEX.md` was read instead.

## 9. Review packet

- `review-packets/promt6/00_summary.md`
- `review-packets/promt6/01_scope.md`
- `review-packets/promt6/02_google_ads_inventory.md`
- `review-packets/promt6/03_readonly_candidate_matrix.md`
- `review-packets/promt6/04_mutation_risk_map.md`
- `review-packets/promt6/05_credential_rbac_security_review.md`
- `review-packets/promt6/06_adapter_contract_spec.md`
- `review-packets/promt6/07_exportjob_source_registry_integration.md`
- `review-packets/promt6/08_test_plan.md`
- `review-packets/promt6/09_risks_and_assumptions.md`
- `review-packets/promt6/10_next_recommendation.md`

## 10. Recommendation

Stop after `PR-2.3B-3A`.

Only after separate review and authorization, the next code phase may be:

```text
PR-2.3B-3B - Google Ads Read-only Adapter isolation and guards
```

That code phase must still exclude official/partial export orchestration, public
endpoints, action import, provider validate-only, approval, dry-run, live
execution, OpenAI/upload work, and Phase 3 unless separately approved.

Do not create Prompt 7 automatically.

