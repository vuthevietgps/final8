# Director Contract

Canonical path:

`sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

Reader impact:

- `section.data.operation_capacity` is now the nested payload root for operation capacity.
- Downstream readers must not assume `section.data` is always a flat array.
- XLSX reader compatibility should be tested in a future phase if needed.
