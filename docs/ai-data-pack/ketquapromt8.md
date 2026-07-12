# Prompt 8 Result - PR-2.3B-3B-H1 Google Ads Read-only Transport, Lock, Audit Hardening

## Result

Status: `completed_hardening_with_transport_integration_blocked`

Prompt 8 implemented production Mongo lock and audit infrastructure, bound the existing DB-only assessment gate, added a runtime-enforcing Google Ads searchStream transport wrapper, and added write-target instrumentation. The legacy `GoogleAdsReadonlySyncService` was not changed or connected to the wrapper because it is outside the authorized source scope and owns its Axios transport internally.

To prevent a bypass, the isolated adapter module no longer binds the legacy sync service. Its raw sync port binds `GoogleAdsReadonlyBlockedSyncPortService`, which fails closed until a separately approved refactor routes the real sync through the enforced wrapper.

```text
code_changed=true
provider_calls=false
real_sync=false
provider_mutation=false
provider_validate_only=false
public_endpoint=false
official_or_partial_export=false
exportjob_integration=false
blocked_by_scope=false
distributed_lock_runtime=implemented_mongo
transport_allowlist_enforcement=runtime_wrapper
blocked_by_transport_integration=true
adapter_audit_persistence=implemented
assessment_port_binding=bound
local_write_allowlist_enforcement=instrumented
local_write_allowlist_limitation_documented=true
permission_binding=broad_role_not_bound
ready_for_exportjob_integration=false
```

## Reused Modules

- Existing DB-only `SourceRegistryService`, `DbWatermarkService`, `CoverageGateService`, and `FreshnessGateService`.
- Existing `ApiTokenModule` for internal-only credential retrieval by the transport wrapper.
- Existing Prompt 7 adapter scope, permission, error, timeout/retry, and allowlist contracts.
- Existing `AdAccount` model for fail-closed approved customer/login-customer scope.

No broad `GoogleAdsModule`, action, validation, execution, evaluation, auto-control, budget-apply, or business-control service is reachable.

All mandatory Prompt 8 input files and Prompt 5-7 review packet directories were present.

## Mongo Distributed Lock

`MongoSourceSyncLockService` persists locks in `ai_data_pack_source_sync_locks`.

- Atomic `findOneAndUpdate` acquisition.
- Unique `lockKey` index prevents duplicate active lock upserts.
- Active duplicates are denied.
- Expired/released locks can be taken over through the atomic query policy.
- Owner plus owner-token release only.
- `expiresAt` TTL index performs eventual cleanup.
- Correctness uses the explicit `expiresAt` query, not assumptions about immediate TTL deletion.

## Runtime Transport Wrapper

`GoogleAdsReadonlyTransportService` enforces:

```text
origin=https://googleads.googleapis.com
method=POST
path=/v*/customers/{allowlistedCustomerId}/googleAds:searchStream
query_source=adapter-owned static templates
request_timeout=30 seconds maximum
absolute_deadline=AbortController enforced
mutation_allowed=false
validate_only_allowed=false
```

Caller-supplied URL, origin, path, method, headers, credentials, query/GAQL, mutation, operations, and validateOnly fields are rejected before HTTP or credential loading.

The wrapper is runtime-capable and tested with a mocked HTTP client. It is intentionally not connected to the legacy sync service. Therefore `blocked_by_transport_integration=true`. Separate socket-connect timeout enforcement is also not claimed; Axios request timeout and absolute deadline are enforced.

## Audit Persistence

`SourceSyncAuditService` writes immutable bounded records to `ai_data_pack_source_sync_audits`, including:

- export job, correlation, source, policy, and scope identifiers;
- sanitized customer IDs and date range;
- lock key, owner, and acquisition outcome;
- attempts and retry classifications;
- provider/mutation flags and terminal status;
- per-account status and pre/post assessment references;
- bounded sanitized errors and timestamps;
- fixed false action/import/dry-run/live invariants.

Raw headers, bodies, provider responses, stacks, tokens, credentials, and unapproved customer topology are not persisted.

## Assessment Binding

The adapter module binds `GOOGLE_ADS_READONLY_ASSESSMENT_PORT` to existing `FreshnessGateService` with its DB-only registry, watermark, and coverage dependencies. `assessLocalFreshness` and `assessCoverage` delegate through that port and never call a provider.

## Local Write Instrumentation

The sync port instrumentation declares and validates only approved Google cache targets. The adapter rejects missing or forbidden telemetry and records only the audit target on failure.

This is instrumentation, not complete persistence interception. The legacy sync service does not expose actual write telemetry and is disconnected from the adapter module, so no unsafe provider/local-write path is currently reachable. Complete interception remains a separate hardening requirement.

## Verification

Run from `backend`:

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm test -- --runInBand google-ads-readonly` | PASS - 8 suites, 38 tests |
| `npm test -- --runInBand source-sync` | PASS - 1 suite, 5 tests |
| `npm test -- --runInBand source-registry` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand export-job` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand ai-data-pack` | PASS - 12 suites, 80 tests |
| `npx prettier --check "src/ai-data-pack/provider-adapters/**/*.ts" "src/ai-data-pack/source-sync/**/*.ts" "src/ai-data-pack/source-registry/**/*.ts"` | PASS |

## Remaining Risks

- The legacy sync service has not been refactored through the runtime transport wrapper.
- Complete actual-write interception is unavailable until the legacy sync service exposes a narrow persistence/telemetry port.
- Separate socket-connect timeout is not enforceable through the current Axios wrapper; request timeout and absolute deadline are enforced.
- Mongo lock and audit schemas are code-first; operational index creation must remain enabled/managed in deployed environments.
- Permission constants remain unbound to broad roles.

## Next Recommendation

Do not start `PR-2.3B-3C` ExportJob integration. The next separately approved phase must remain hardening:

```text
PR-2.3B-3B-H2 - Legacy Google Ads read-only sync transport refactor and actual-write interception
```

It must route all legacy searchStream calls through the enforced wrapper, remove the fail-closed blocker only after tests prove the route, and expose enforceable actual-write telemetry/interception. Do not create Prompt 9 automatically.

## Engineering References

- MongoDB single-document atomicity: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
- MongoDB TTL indexes: https://www.mongodb.com/docs/manual/core/index-ttl/
- Mongoose atomic `findOneAndUpdate`: https://mongoosejs.com/docs/tutorials/findoneandupdate.html
- Axios instances and timeout configuration: https://axios-http.com/docs/instance
- Google Ads Search and SearchStream: https://developers.google.com/google-ads/api/rest/common/search
