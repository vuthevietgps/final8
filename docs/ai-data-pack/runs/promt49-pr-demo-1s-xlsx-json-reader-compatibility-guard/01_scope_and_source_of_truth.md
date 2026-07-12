# Scope And Source Of Truth

Phase: PR-DEMO-1S

Target:

`xlsx_json_reader_compatibility_guard`

Immediate source of truth:

- Prompt48 BA/QA handoff packet:
  `docs/ai-data-pack/runs/promt48-pr-demo-1r-readonly-evidence-ba-qa-handoff/`
- Prompt47 Director section guard:
  `docs/ai-data-pack/runs/promt47-pr-demo-1q-director-operational-risk-section-regression/`
- Prompt46 schema/data-quality guard:
  `docs/ai-data-pack/runs/promt46-pr-demo-1p-operational-risk-evidence-schema-regression/`
- Prompt45 no-action/no-provider/no-mutation guard:
  `docs/ai-data-pack/runs/promt45-pr-demo-1o-readonly-action-payload-regression/`

Code inspected:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
- `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`
- `backend/src/ai-data-pack/export/xlsx-exporter.service.ts`
- `backend/src/ai-data-pack/export/json-exporter.service.ts`
- `backend/src/ai-data-pack/ai-data-pack.controller.ts`
- `backend/src/ai-data-pack/export-jobs/*`

Search inventory terms used:

- `DIRECTOR_XLSX_SHEETS`
- `16_operation_capacity`
- `operation_capacity`
- `operational_risk_findings`
- `xlsx`
- `worksheet`
- `sheet`
- `json`
- `flatten`
- `section.data`

Scope honored:

- Focused reader/exporter compatibility only.
- No operational risk business finding logic changed.
- No DB access.
- No provider/action/execution phase opened.
