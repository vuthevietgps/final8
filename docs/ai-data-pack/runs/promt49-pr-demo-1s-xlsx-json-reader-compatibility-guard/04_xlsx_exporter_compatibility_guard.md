# XLSX Exporter Compatibility Guard

Initial Prompt49 result:

- The first focused Jest run failed.
- Failure reason: `Text length must not exceed 32767 characters`.
- Cause: `16_operation_capacity` nested object was stringified into one XLSX cell.

Minimal compatibility fix:

- `XlsxExporterService.flatten()` now recursively flattens nested objects.
- Arrays remain represented as JSON text according to existing exporter style.
- Array metadata columns are added:
  - `<path>.row_count`
  - `<path>.finding_keys` when array items contain `finding_key`
- Oversized strings are truncated explicitly instead of crashing.

Guard assertion:

- Exports `16_operation_capacity` with nested `section.data.operation_capacity`.
- Reads workbook with `XLSX.read`.
- Reads sheet `16_operation_capacity`.
- Asserts there is one row.
- Asserts literal column `operation_capacity.operational_risk_findings` exists.
- Asserts `operation_capacity.operational_risk_findings.row_count` is at least the five targeted findings.
- Asserts `operation_capacity.operational_risk_findings.finding_keys` contains all five targeted findings.

Result:

- XLSX export no longer crashes.
- Operational risk findings are not silently dropped.
- XLSX readers have stable summary columns for finding presence.
