# Future PR-2.3B-3B Test Plan

No adapter tests were added or run in Prompt 6 because this phase is
documentation only.

## Unit tests

1. Adapter exposes `sourceKey=google_ads`, `mode=read_only`, and no action or
   execution methods.
2. Transport rejects every origin/path/method except allowlisted
   `POST .../googleAds:searchStream`.
3. Static GAQL templates cannot contain mutation operations and callers cannot
   supply GAQL.
4. Credentials are loaded internally and never appear in input/output/errors.
5. Invalid, unknown, inactive, or unapproved customer/login-customer scope
   fails before credential load/provider call.
6. Date ordering, maximum range, and report-date defaults are enforced.
7. Local write spy proves only approved cache/sync-run collections are written.
8. No delete operation is issued.
9. Timeout and total deadline produce typed, sanitized terminal failures.
10. Retries occur only for allowed transient failures, use bounded attempts,
    and honor rate-limit delay.
11. Authentication, invalid query, policy, and scope errors are not retried.
12. Per-account/step failures produce `partial`; zero useful success produces
    `failed`.
13. Every started run reaches a terminal status.
14. Error serialization redacts secrets, headers, raw provider payloads, and
    stack traces.

## Lock and idempotency tests

1. Equivalent concurrent syncs acquire one lock and make one provider call.
2. Different approved customer/date scopes use different locks.
3. Lock expiry/renewal and owner-only release work.
4. A compatible fresh successful run is reused for `sync_if_stale`.
5. Sync run is linked to the export job and scope hash.

## Integration tests

1. Stale Google Ads triggers the adapter only when future job policy allows.
2. Fresh and covered Google Ads skips the adapter.
3. Cached export never resolves or calls the adapter.
4. Provider failure becomes a partial/stale warning and is followed by DB-only
   reassessment.
5. Fresh timestamp plus zero report-date rows keeps ads-scale gate false.
6. Successful sync followed by covered DB state can enable only the appropriate
   data decision gate.
7. `canImportActionFile`, `canDryRun`, and `canExecuteLive` remain false.
8. Existing GET exports remain side-effect-free.
9. No operation builder, provider validation, action plan, execution,
   evaluation, post-execution, emergency-action, or auto-control service is in
   the adapter dependency graph.
10. RBAC denies broad `google-ads.read` users from triggering internal provider
    sync and restricts sync-detail data.

## Static/source guards

- Fail if adapter/module source contains `:mutate`, operation builder, action
  plan, validate-only service, execution service, or emergency action imports.
- Fail if the adapter can access a generic provider URL/method.
- Fail if local write target is outside the approved allowlist.
- Preserve existing tests proving cached export has no provider sync and
  current GET behavior remains unchanged.

## Verification commands for the future code PR

The future PR must run its focused adapter/unit/integration suites, existing
Google Ads safety suites, existing source-registry and ExportJob suites, and a
backend build. It must also run a source guard that proves no mutation-capable
dependency is reachable from the adapter module.

