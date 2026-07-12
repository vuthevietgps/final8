# Internal Source-sync Policy

`SourceSyncPolicyService` centralizes local policy decisions:

- Fresh and covered means `freshnessStatus=fresh` and `coverageStatus=covered|not_applicable`.
- `export_cached` never calls an adapter.
- Unsupported or not-configured sources do not call an adapter.
- Only `google_ads` can be considered for adapter execution.
- Source impact preserves no-false-zero states:
  - `fresh_covered`
  - `no_records_for_report_date`
  - `not_synced`
  - `not_configured`
  - `unsupported`
  - `stale`
  - `sync_failed`

The service also shapes decision gates so action import, dry-run, and live execution stay false.
