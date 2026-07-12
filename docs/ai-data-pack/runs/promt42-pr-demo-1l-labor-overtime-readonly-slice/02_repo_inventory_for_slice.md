# Repo Inventory For Slice

Inspected labor cost and timesheet-like modules:

- `backend/src/labor-cost1/schemas/labor-cost1.schema.ts`
  - Class: `LaborCost1`
  - Fields used: `userId`, `date`, `startTime`, `endTime`, `workHours`, `sessionCount`, `hourlyRate`, `cost`, `notes`, `paymentStatus`, timestamps.
  - Gap: no canonical `overtimeHours` field; Prompt42 derives a candidate from daily `workHours`.
- `backend/src/labor-cost1/labor-cost1.service.ts`
  - Functions found: `create`, `findAll`, `update`, `remove`, `generateFromSessionLogs`, `markPaid`, `getSummaryCards`.
  - Mutation-capable functions were inspected only; Prompt42 does not call them.
- `backend/src/session-log/session-log.schema.ts`
  - Class: `SessionLog`
  - Fields found: `userId`, `loginAt`, `logoutAt`, user display fields, login IP.
  - LaborCost1 can be generated from session logs, but Prompt42 reads `laborcost1` only.

Inspected labor statement/payroll modules:

- `backend/src/labor-cost1/schemas/labor-statement.schema.ts`
  - Class: `LaborStatement`
  - Fields used: `employeeId`, `periodFrom`, `periodTo`, `status`, `periodCost`, `totalWorkHours`, `sessionCount`, `closingBalance`, `dueDate`, `notes`, timestamps.
- `backend/src/labor-cost1/labor-statement.service.ts`
  - Functions found: `createStatement`, `updateKpi`, `confirmStatement`, `addPayment`, `closeStatement`, `reopenStatement`, `deleteStatement`, `listStatements`, `getStatement`, `getTotalUnpaidLabor`, `getSummaryByEmployee`, `getCashflowSummary`.
  - Prompt42 does not call mutation-capable payroll or payment methods.

Inspected overtime threshold source:

- `backend/src/salary-config/schemas/salary-config.schema.ts`
  - Class: `SalaryConfig`
  - Fields found: `hourlyRate`, `payrollCycle`, `paymentDays`, attendance/KPI/punctuality rules.
  - Gap: no canonical overtime threshold field was found.

Inspected revenue/workload and operation status sources:

- `backend/src/test-order2/schemas/test-order2.schema.ts`
  - Class: `TestOrder2`
  - Fields used: `orderDate`, `quantity`, `depositAmount`, `codAmount`, `manualPayment`, `productionStatus`, `orderStatus`, `isActive`.
- `backend/src/test-order2/services/order-calculation.service.ts`
  - Existing calculation code reads `laborcost1` for daily labor cost allocation to orders.
- `backend/src/production-status/schemas/production-status.schema.ts`
  - Production status metadata exists but has no SLA/deadline policy fields.
- `backend/src/delivery-status/schemas/delivery-status.schema.ts`
  - Delivery status has operational flags, but no labor SLA or staff capacity mapping for this finding.

Inspected staff/team fields:

- `backend/src/user/user.schema.ts`
  - Class: `User`
  - Fields used: `_id`, `fullName`, `role`, `managerId`, `isActive`.
  - Gap: no canonical team capacity table was found.

Inspected Director JSON / AI Data Pack surface:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
  - Director section `16_operation_capacity` receives `operations.operation_capacity`.
- `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`
  - `DIRECTOR_XLSX_SHEETS` includes `16_operation_capacity`.
- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
  - Existing operational risk evidence pattern reused.
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`
  - Existing focused service tests extended.

Demo seed fixture inspected by search:

- `backend/src/ai-data-pack/demo-seed/director-demo-seed.fixtures.ts`
  - Existing demo labels include `labor_overtime_high_without_matching_revenue_growth`.
  - Prompt42 did not add fake evidence or seed-only data.

