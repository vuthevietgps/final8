# Reader Exporter Inventory

Director section contract:

- `DIRECTOR_XLSX_SHEETS` contains `16_operation_capacity`.
- `DirectorDataPackService` assembles the section under:
  `sections["16_operation_capacity"].data.operation_capacity`

JSON path:

- `JsonExporterService` stable-stringifies the full pack after redaction and checksum attachment.
- Existing Prompt47 guard reads:
  `sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

XLSX path:

- `XlsxExporterService.export()` writes a workbook from section objects.
- Before Prompt49, `XlsxExporterService.flatten()` stringified nested objects into a single cell.
- This failed for nested `16_operation_capacity` because the full operations payload exceeded the XLSX cell text limit.

Prompt49 exporter behavior:

- Objects are recursively flattened into dotted column names.
- Arrays are represented as JSON text columns.
- Arrays also get `<path>.row_count`.
- Arrays with `finding_key` get `<path>.finding_keys`.
- Oversized string cells are explicitly truncated with:
  `[truncated_for_xlsx_cell_limit original_length=...]`

Compatibility conclusion:

- JSON readers can use the nested path.
- XLSX readers can use:
  - `operation_capacity.operational_risk_findings`
  - `operation_capacity.operational_risk_findings.row_count`
  - `operation_capacity.operational_risk_findings.finding_keys`
