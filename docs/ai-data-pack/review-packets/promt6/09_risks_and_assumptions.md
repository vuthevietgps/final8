# Risks and Assumptions

## Risks

- Broad `GoogleAdsModule` composition can accidentally make mutation services
  reachable from a pre-export orchestrator.
- Existing `google-ads.read` RBAC is too broad for provider-sync execution.
- Provider latency, quota/rate limits, auth failure, API-version changes, and
  per-account permission differences can produce partial coverage.
- Without a lock and idempotency scope, concurrent exports can duplicate
  provider calls and local writes.
- A successful provider response does not prove report-date coverage.
- Local upsert success does not prove all accounts/resources were covered.
- The current sync can leave a durable run in `running` after unexpected
  failures before its final update.
- Current error redaction is useful but cannot make arbitrary provider payloads
  safe to store.
- Legacy plaintext credential/config fallback weakens the encrypted-storage
  invariant.
- Customer IDs are not credentials but can disclose sensitive account topology.
- `AdvertisingCostGoogleSyncService` is read-only at the provider boundary but
  is not side-effect isolated because a helper can queue recalculation.
- `EmergencyActionVerificationService` and account timezone validation perform
  reads but belong to different business workflows and should not be reused.

## Assumptions

- ERP remains the only component allowed to call Google Ads.
- ChatGPT Web only creates `ads_execution_plan.zip`.
- Pre-export adapter behavior is provider read plus approved local cache/audit
  writes, never provider mutation or business-state mutation.
- The existing 60-minute Google Ads source-registry threshold remains a policy
  default, subject to separate approval.
- Final freshness and coverage decisions remain DB-only assessments after sync.
- Official and partial exports are not implemented or authorized in this phase.
- Google Ads credentials continue to use the existing OAuth refresh-token
  mechanism unless a separate authentication review approves another method.
- No service-account implementation exists in the reviewed repository.

## Missing input

- `missing_input_file: backend/src/config/`

