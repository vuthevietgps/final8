# Director Section Inventory

Director sheet list source:

`backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`

Relevant section:

`16_operation_capacity`

Prompt47 required path:

`sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

Current assembly:

- `DirectorDataPackService.build()` calls the operations dependency.
- Section `16_operation_capacity` now stores `{ operation_capacity: operations }`.
- The full operations payload includes:
  - `operation_capacity`
  - `operational_risk_findings`
  - `quality`

Resulting section path:

- `sections["16_operation_capacity"]`
- `.data`
- `.operation_capacity`
- `.operational_risk_findings`

The guard asserts all five hardened finding keys at this nested path, not only in a local query result variable.
