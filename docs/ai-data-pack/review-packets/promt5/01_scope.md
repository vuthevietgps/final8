# Scope

## Included

- Internal source registry.
- DB-only watermark/freshness assessment.
- DB-only report-date/date-range coverage assessment.
- Internal conservative decision gates.
- Focused tests and Prompt 5 reports.
- Internal DI wiring only.

## Excluded

- Provider calls, sync orchestration or adapters.
- Official/partial export.
- Automatic cached ExportJob freshness evaluation.
- Public endpoint, RBAC, polling or download.
- Action import, generic dry-run or live execution.
- Provider/sheet/payment/settlement/recalculation/auto-control mutation.
- OpenAI/upload work and Phase 3.

`blocked_by_scope=false`.

The PR-2.3B-1 BA addendum was reviewed from Downloads. No separate ChatGPT Web Prompt 4 approval artifact was found; Prompt 5 supplied explicit authorization.
