# Google Ads Read-only Adapter Contract Spec

This is a future contract only. It is not implemented in Prompt 6.

```ts
interface AiDataPackProviderReadOnlyAdapter {
  readonly sourceKey: "google_ads";
  readonly mode: "read_only";
  readonly supportsSourceRegistry: true;

  assessLocalFreshness(
    input: ProviderReadOnlyAssessmentInput,
  ): Promise<SourceFreshnessAssessment>;

  syncReadOnly(
    input: GoogleAdsReadOnlySyncInput,
  ): Promise<ProviderReadOnlySyncResult>;

  assessCoverage(
    input: ProviderReadOnlyAssessmentInput,
  ): Promise<SourceCoverageAssessment>;
}
```

## Input contract

`GoogleAdsReadOnlySyncInput` must contain:

- `exportJobId` and `correlationId`;
- `sourceKey="google_ads"`;
- `reportDate`, `dateFrom`, and `dateTo`;
- normalized, non-empty, policy-approved `customerIds`;
- `syncPolicy="sync_required"|"sync_if_stale"`;
- `policyVersion`;
- internal requester/worker audit identity without credentials; and
- an absolute deadline.

It must not contain client secret, refresh token, developer token, access token,
generic URL, generic HTTP method, GAQL supplied by the caller, action plan, or
mutation operation.

Validation must enforce an approved date range, `dateFrom <= dateTo`, and a
small configured maximum lookback/range. The default adapter request should
target the report date only.

## Output contract

`ProviderReadOnlySyncResult` must include:

- `sourceKey`, `mode`, `exportJobId`, `syncRunId`, `policyVersion`;
- `status=success|partial|failed|skipped_fresh_enough|skipped_locked|not_configured`;
- `providerSyncAttempted`, `mutationAttempted=false`;
- requested/selected/rejected customer IDs in sanitized form;
- per-account and per-step status;
- date range, start/completion time, duration, attempt count;
- record counts by approved entity/metric;
- exact local collections written;
- lock/idempotency outcome;
- bounded sanitized typed warnings/errors;
- post-sync freshness and coverage assessment references; and
- `canImportActionFile=false`, `canDryRun=false`, `canExecuteLive=false`.

## Provider transport invariant

- Exact origin: `https://googleads.googleapis.com`.
- Exact path family:
  `/v*/customers/{allowlistedCustomerId}/googleAds:searchStream`.
- Exact method: `POST`.
- Adapter-owned static GAQL templates only.
- No caller-supplied URL/path/method/query.
- No mutation, create, update, delete, status change, action, validation, or
  execution dependency.

Prefer a dedicated read-only transport abstraction over direct generic Axios
access in the adapter.

## Local write allowlist

The adapter may update only:

- approved sync metadata fields on `adaccounts`;
- `google_ads_campaigns`;
- `google_ads_campaign_budgets`;
- `google_ads_ad_groups`;
- `google_ads_keywords`;
- `google_ads_ads`;
- `google_ads_daily_metrics`; and
- `google_ads_sync_runs`.

It must never write action plans, approvals, operation payloads, execution logs,
change logs, evaluations, advertising-cost recalculation queues, exports, or
business-control state. Local writes must be upsert/idempotent and must not
delete provider or ERP records.

## Locking and idempotency

- Distributed lock key:
  `google_ads:{customerScopeHash}:{dateFrom}:{dateTo}`.
- Lock owner includes export-job ID and a random ownership token.
- Lock TTL must exceed the total deadline and be renewable.
- Release only by the owner token.
- A compatible successful run may be reused for `sync_if_stale`.
- Persist an idempotency/scope hash and link the run to the export job.
- Concurrent equivalent syncs must not issue duplicate provider calls.

The future sync-run audit needs export-job linkage, policy version, scope hash,
lock outcome, attempts, per-account status, timeout/rate-limit classification,
and post-sync assessment references.

## Timeout, retry, and rate-limit policy

Proposed bounded defaults for review:

- connection timeout: 5 seconds;
- per-provider-request timeout: 30 seconds;
- total sync deadline: 180 seconds for a report-date request;
- maximum retries: 2 after the first attempt;
- exponential backoff with jitter; and
- honor provider retry guidance such as `Retry-After` when present.

Retry only transient network errors, HTTP 429, and eligible 5xx responses.
Never retry malformed scope, policy denial, invalid GAQL, authentication/
authorization errors, unsupported API version, or local validation errors.
Stop before the absolute deadline and return a sanitized typed error.

Rate limiting must be bounded per worker and per customer/login-customer scope.
Do not fan out all accounts and all resource queries without a configured
concurrency limit.

## Partial failure

- Isolate failure by customer and step.
- Preserve successful local upserts.
- Mark the durable run `partial` when any approved step succeeds and another
  fails.
- Mark `failed` when no useful approved step succeeds.
- Ensure every started run reaches a terminal status, including timeout and
  unexpected exceptions.
- Re-run the existing DB-only freshness/coverage assessment after any terminal
  result; do not infer freshness from provider call success alone.

## Error contract

Allowed categories:

`policy_denied`, `invalid_scope`, `not_configured`, `auth_failed`,
`permission_denied`, `rate_limited`, `provider_timeout`, `provider_transient`,
`provider_query_invalid`, `provider_version_unsupported`,
`local_persistence_failed`, `lock_unavailable`, and `unexpected`.

Each error must expose only category, retryable flag, sanitized message,
customer/step context when authorized, attempt number, and optional safe
provider request ID. Never persist or return credentials, headers, raw request
bodies, raw provider responses, or stack traces.

## Official provider references

- Reporting/search:
  https://developers.google.com/google-ads/api/docs/reporting/overview
- Call structure:
  https://developers.google.com/google-ads/api/docs/concepts/call-structure
- Quotas and retry behavior:
  https://developers.google.com/google-ads/api/docs/best-practices/quotas
- OAuth:
  https://developers.google.com/google-ads/api/docs/oauth/overview

