# Code Changes Or Blocker

Status: implemented_section_guard

Blocker: none.

Changed files:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Code changes:

- `DirectorDataPackService` now places the full operations payload under section `16_operation_capacity` as `{ operation_capacity: operations }`.
- The hardened operational risk spec now:
  - extends the banned-key set with Prompt47 exact keys
  - builds a Director data pack from the fake operations result
  - asserts `sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`
  - asserts no targeted finding is missing at the section path
  - asserts duplicate targeted rows have distinct affected entity identity

Business logic changed: false.

Operational risk query changed: false.

Database access: none.

Provider/action/export/download code changed: false.
