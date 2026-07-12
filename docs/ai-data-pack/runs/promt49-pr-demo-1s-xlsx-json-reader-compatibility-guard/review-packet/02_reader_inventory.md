# Reader Inventory

Inspected:

- Director section contract.
- Director data-pack service.
- JSON exporter.
- XLSX exporter.
- ai-data-pack controller/export paths.
- Existing ai-data-pack tests.

Key finding:

- XLSX exporter needed compatibility hardening because nested object stringification could exceed Excel cell text limits.
