# Prompt 7 Result - PR-2.3B-3B Google Ads Read-only Adapter Isolation and Guards

## Result

Status: `completed_with_hardening_required`

Prompt 7 added an isolated internal Google Ads read-only adapter boundary and guard tests. It did not add an official or partial export, public endpoint, real provider sync, provider mutation, action workflow, dry-run, live execution, OpenAI integration, or Phase 3 work.

The adapter is not wired into `AiDataPackModule`, a controller, or the ExportJob lifecycle. No provider API call occurred during implementation verification.

```text
code_changed=true
provider_calls=false
real_sync=false
provider_mutation=false
public_endpoint=false
official_or_partial_export=false
action_import_dry_run_live_openai=false
forbidden_service_imports=false
blocked_by_dependency_boundary=false
distributed_lock_runtime=interface_only
permission_key_proposed_not_bound=true
ready_for_integration=false
```

## Reused Modules

- `GoogleAdsReadonlySyncService.sync()` through a narrow internal sync port only.
- `ApiTokenModule`, required internally by the existing read-only sync service.
- Existing `AdAccount` and Google Ads cache/sync-run Mongoose schemas, registered directly without importing broad `GoogleAdsModule`.
- Existing source assessment types for the optional DB-only assessment port.

## Implementation

- Added generic provider read-only adapter and injection-token contracts.
- Added `GoogleAdsReadonlyAdapterModule`, exporting only `AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER`.
- Added fail-closed input, permission, date, customer, login-customer, and deadline validation.
- Added exact searchStream-only transport allowlist contract with adapter-owned query templates and mutation/validateOnly disabled.
- Added local-write allowlist and source guards excluding action, approval, execution, evaluation, business-control, and delete paths.
- Added bounded sanitized error categories and redaction.
- Added retry/deadline and distributed-lock contracts.
- Kept `canImportActionFile=false`, `canDryRun=false`, `canExecuteLive=false`, and `mutationAttempted=false` in all adapter results.

## Safe Dependency Boundary

`blocked_by_dependency_boundary=false`.

The adapter does not import `GoogleAdsModule`. It directly registers only the models required by `GoogleAdsReadonlySyncService`, binds that service behind `GOOGLE_ADS_READONLY_SYNC_PORT`, and exports only the narrow adapter token. Source guards prove that forbidden mutation/execution services are absent and that the adapter is not integrated into cached ExportJob or a public controller.

## Policy Summary

| Control | Value |
|---|---|
| Connection timeout contract | 5 seconds |
| Request timeout contract | 30 seconds |
| Total deadline | 180 seconds |
| Retries after first attempt | 2 |
| Maximum date range | 31 days |
| Maximum concurrent customers contract | 2 |
| Lock TTL | 210 seconds |
| Lock key | `google_ads:{scopeHash}:{dateFrom}:{dateTo}` |
| Lock owner | `exportJobId:{random owner token}` |
| Distributed lock runtime | `interface_only` |

Retry classification permits transient network failures, HTTP 429, and eligible 5xx only. Auth, permission, policy, scope, invalid query, unsupported version, and local validation failures are non-retryable.

## RBAC

The adapter requires the proposed narrow internal permission:

```text
ai-data-pack.source-sync.google-ads.readonly.execute
```

The proposed detail-read permission is:

```text
ai-data-pack.export.sync-detail.read
```

Neither permission is bound to Director, Manager, or any broad role. `google-ads.read` alone is insufficient.

## Verification

Run from `backend`:

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm test -- --runInBand google-ads-readonly` | PASS - 5 suites, 30 tests |
| `npm test -- --runInBand source-registry` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand export-job` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand ai-data-pack` | PASS - 8 suites, 67 tests |
| `npx prettier --check "src/ai-data-pack/provider-adapters/**/*.ts"` | PASS |

## Remaining Risks and Limitations

- The distributed lock is an interface only and intentionally fails closed when unbound.
- The DB-only assessment/source-registry port is optional and unbound.
- The transport allowlist is a contract/guard at the adapter boundary; it is not yet an interceptor around the existing sync service's internal Axios transport.
- Connection/request timeout values are policy contracts but cannot directly configure the existing sync service transport in this scoped PR.
- Retry wraps sync-port failures, but the existing sync service converts many provider step failures into `partial` or `failed` results, limiting provider-level retry enforcement.
- The local-write allowlist is declared and guarded, but does not yet intercept each write performed inside the existing sync service.
- Existing sync-run schema does not persist all future export-job, scope-hash, lock, attempt, or post-assessment audit fields. No migration or schema change was authorized.

## Next Recommendation

Do not start ExportJob integration yet. The next separately reviewed phase should be:

```text
PR-2.3B-3B-H1 - Google Ads read-only transport, lock, and audit hardening
```

It must provide a real distributed lock, enforceable transport timeouts/allowlists, write-target enforcement, source-assessment binding, and required audit persistence before `PR-2.3B-3C` integration is considered.
