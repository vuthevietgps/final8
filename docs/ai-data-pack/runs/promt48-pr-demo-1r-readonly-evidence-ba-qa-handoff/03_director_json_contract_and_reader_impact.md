# Director JSON Contract And Reader Impact

Current canonical path:

`sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

Prompt47 section-shape change:

- Before Prompt47, `16_operation_capacity` exposed only operation-capacity rows at `section.data`.
- Since Prompt47, `16_operation_capacity` exposes the full operations payload under `section.data.operation_capacity`.
- Code reference: `backend/src/ai-data-pack/director-data-pack.service.ts:89`.

Current nested shape:

```text
sections["16_operation_capacity"]
  .data
  .operation_capacity
    .operation_capacity
    .operational_risk_findings
    .quality
```

BA/QA reader impact:

- JSON readers must use the canonical nested path for operational risk findings.
- Downstream readers must not assume every Director section `data` value is a flat array.
- XLSX readers may see nested payload fields flattened or stringified by the exporter; this should be tested separately before relying on spreadsheet parsing for these findings.

Recommended compatibility follow-up:

- Add a future XLSX/JSON reader compatibility guard for the nested `16_operation_capacity` shape before broad downstream automation consumes it.
