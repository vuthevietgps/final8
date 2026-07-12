# No False Zero And Decision Gates

The result separates these states instead of collapsing them into zero data:

- `no_records_for_report_date`
- `not_synced`
- `not_configured`
- `unsupported`
- `stale`
- `fresh_covered`

Decision gates use `FreshnessGateService` post-assessment output. For ads scaling, the gate remains true only when:

- `google_ads` is fresh and covered.
- `advertising_costs` is fresh and covered.
- `product_mapping` is fresh and covered.

Live/action gates remain false regardless of freshness:

- `canImportActionFile=false`
- `canDryRun=false`
- `canExecuteLive=false`
