# Prompt 6 Summary

Phase: `PR-2.3B-3A - Google Ads Read-only Adapter Technical Spec / Security Review`

Status: completed as documentation only.

## Conclusion

A later Google Ads read-only adapter PR is technically feasible, but the current
services must not be wired directly into pre-export orchestration without new
isolation and guards.

The only recommended provider-sync implementation boundary is a new narrow,
internal adapter around `GoogleAdsReadonlySyncService.sync()`. The adapter must:

- expose only Google Ads `googleAds:searchStream`;
- import no action-plan, operation-builder, provider-validation, execution,
  emergency-action, evaluation, or post-execution service;
- use a dedicated internal sync permission, not broad `google-ads.read`;
- fail closed on customer/account scope;
- enforce timeout, retry, rate-limit, distributed lock, and idempotency policy;
- write only the approved local Google Ads cache collections and sync-run audit;
- re-run the existing DB-only freshness and coverage gate after sync; and
- preserve `canImportActionFile=false`, `canDryRun=false`, and
  `canExecuteLive=false`.

No source code, endpoint, migration, provider call, real sync, mutation, official
export, partial export, or live execution was added.

## Main blockers before a code PR

- `GoogleAdsModule` currently exports read, validation, and live execution
  services together.
- `POST /google-ads/sync/readonly` inherits `google-ads.read`; Manager currently
  has that permission.
- The read-only sync has no request/overall timeout, retry/backoff, rate-limit
  behavior, distributed lock, export-job link, or maximum date-range policy.
- The sync-run schema cannot record export-job linkage, lock/idempotency scope,
  per-account outcome, retry, timeout, or policy version.
- The current no-mutation test checks a query string only; it does not prove an
  exact outbound endpoint/method allowlist.
- Legacy plaintext token/config fallbacks remain in `ApiTokenService`.

## Missing input

`missing_input_file: backend/src/config/`

All specifically requested Prompt 2-5 reports, the BA master document, and the
Prompt 4-5 review packets were present.

