# Data Quality And Freshness Gates

Definitions:

- `freshnessStatus`: source recency, one of `fresh`, `stale`, `missing`, `not_configured`, `unsupported`, `unknown`.
- `coverageStatus`: report-date or date-range evidence, one of `covered`, `no_records_for_report_date`, `missing`, `not_applicable`, `unsupported`, `unknown`.
- `sourceImpactStatus`: decision impact preserving why a source cannot be trusted.
- `dataQualityStatus`: section quality, such as `ok`, `partial`, `weak`, `missing`, `stale`, `estimated`, `realized`.
- `decisionGateImpact`: gates locked or allowed by source status.

Do not merge:

- `zero_value`
- `no_records_for_report_date`
- `missing`
- `not_synced`
- `not_configured`
- `unsupported`
- `stale`
- `fresh_covered`
- `partial`
- `weak_mapping`
- `estimated`
- `realized`

Hard rules:

- Provider success does not equal fresh/covered.
- Post-sync DB-only assessment is final.
- Fresh timestamp plus `no_records_for_report_date` is not verified zero.
- Strong gates require both freshness and coverage where coverage applies.
