# Scope

## Included

- ExportJob cached-only types, Mongoose schema and internal service.
- Lifecycle `pending -> exporting -> completed | failed`.
- Existing read-only builder/exporter reuse.
- Minimal cached metadata.
- Active-job idempotency with `reuse_existing`.
- Immutable local artifact/checksum lifecycle.
- Sanitized error audit.
- Focused tests and reports.

## Excluded

- Source registry and DB-only freshness/coverage gate.
- Stale/fresh threshold logic.
- Official/partial export.
- Provider adapter/API call.
- Public endpoint, full RBAC and download.
- Action import, generic dry-run and live execution.
- Provider/sheet/payment/settlement/recalculation/auto-control mutation.
- OpenAI/upload work, new BA domains and Phase 3.

`blocked_by_scope=false`. No excluded implementation was required.

The BA addendum was reviewed from the supplied Downloads path because the repo copy was absent.
