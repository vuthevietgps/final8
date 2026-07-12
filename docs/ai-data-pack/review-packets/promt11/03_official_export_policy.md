# Official Export Policy

Purpose:

- Produce an official Director-approved Data Pack.
- Support strong conclusions only where source freshness, coverage, mapping, and RBAC pass.

Required behavior:

1. Create export job with `exportMode=official_export`.
2. Use `syncPolicy=sync_required`.
3. Run DB-only pre-assessment.
4. For stale/missing critical sources with an approved adapter, invoke only the internal source-sync policy.
5. Run DB-only post-assessment.
6. Snapshot only after post-assessment passes or an explicit Director/BA exemption is recorded.
7. Export artifacts with manifest, checksums, source impact, warnings, and decision gates.

Block conditions:

- Required critical source remains stale, missing, unsupported, not configured, or lacks coverage.
- Adapter unavailable/fails for a required sync source.
- RBAC does not allow requested section profile.
- Artifact cannot be generated with required manifest/checksums.

Downgrade:

- Official may become partial only under explicit `allowDowngradeToPartial=true` policy and audit trail.
- Downgrade must preserve all warnings and locked gates.
