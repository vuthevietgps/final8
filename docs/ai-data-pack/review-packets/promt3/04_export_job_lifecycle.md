# Export Job Lifecycle

## Modes

`official_export`

- Strict critical-source gate.
- Default `sync_required`, `allow_partial_export=false`.
- Only allowlisted read-only adapters may run.
- Unresolved critical failure blocks the job.

`partial_export`

- Default `sync_if_stale`, `allow_partial_export=true`.
- Exports with explicit warnings, blocking reasons and lowered decision gates.

`cached_export`

- `export_cached`; never syncs.
- Technical/test use.
- Requires `cached_export=true`.

Existing GET endpoints remain side-effect-free and never sync.

## State Machine

```text
pending
  -> checking_freshness
  -> syncing (only when policy and adapter allow)
  -> checking_freshness
  -> snapshotting
  -> exporting
  -> completed | completed_with_warnings

Any stage may end in blocked or failed.
```

## Idempotency and Locks

- Prevent concurrent active official jobs for normalized `report_date + sorted pack_types + requested_by`.
- Idempotency key also includes formats, export mode, sync policy and policy version.
- Source-level distributed lock for provider sync; Google Ads scope includes customer IDs and date range.
- Fresh and covered sources return `skipped_fresh_enough`.
- Initial proposal: 120-second provider timeout and one transient retry.
- No retry for unsupported/not-configured/auth-policy/mutation-guard failures.
- Snapshot records start/end watermarks and immutable artifact checksums.

## Failure Behavior

- Critical unresolved failure: `blocked`.
- Optional failure allowed by policy: `completed_with_warnings`.
- Unexpected export/render/storage failure: `failed`.
- All errors returned to users must be sanitized.
