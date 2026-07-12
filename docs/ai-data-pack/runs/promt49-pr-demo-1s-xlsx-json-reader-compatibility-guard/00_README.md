# Prompt49 - PR-DEMO-1S XLSX/JSON Reader Compatibility Guard

Status: implemented_reader_compatibility_guard

Prompt49 proves and hardens compatibility for the nested Director operation-capacity section shape:

`sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

Why code changed:

- The new XLSX guard exposed a real compatibility failure: the old XLSX exporter stringified the entire nested `operation_capacity` object into one cell and crashed on Excel's 32,767-character text limit.
- The exporter was minimally hardened to recursively flatten nested objects, keep array JSON in explicit nested columns, add array `row_count`, add `finding_keys` for arrays containing `finding_key`, and explicitly truncate oversized cells with a visible suffix instead of crashing.

Guard result:

- JSON path remains readable.
- XLSX export for `16_operation_capacity` no longer crashes.
- XLSX output retains `operation_capacity.operational_risk_findings`, row count, and all five finding keys.
- Prompt45, Prompt46, and Prompt47 guards remain active.

Verification:

- `cd backend; npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand` passed, 38/38.
- `cd backend; npm run build` passed.
- Required static scans were run and classified.

Safety:

- No production DB or server MongoDB.
- No provider/API execution.
- No Action Draft Schema, action import, approval, dry-run/live, export/download endpoint expansion, migration, or business mutation.
