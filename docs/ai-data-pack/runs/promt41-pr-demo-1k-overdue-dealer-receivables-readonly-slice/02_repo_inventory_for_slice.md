# Repo Inventory For Slice

Inspected agent/dealer statement and receivable/payable modules:

- `backend/src/agent-receivable/schemas/agent-statement.schema.ts`
  - Classes: `AgentStatement`, `AgentStatementPayment`
  - Fields used: `agentId`, `periodFrom`, `periodTo`, `status`, `periodCollected`, `statementPaymentTotal`, `closingBalance`, `payments.amount`, `payments.paidAt`, `payments.createdBy`, `notes`, timestamps
  - Important semantic note: schema comments say the route/collection is named receivable, but the domain meaning is company payable to agent. Prompt41 evidence therefore remains settlement-pressure evidence, not proof of collectible cash-in or dealer fault.
- `backend/src/agent-receivable/agent-receivable.service.ts`
  - Functions found: `getAgentReceivableSummary`, `listStatements`, `calculateBalances`, `upsertStatement`, `addPayment`, `getCashflowSummary`
  - Existing logic includes agent summary, statement payments, due-date policy, and last-payment lookup.

Inspected order/invoice linkage:

- `backend/src/test-order2/schemas/test-order2.schema.ts`
  - Class: `TestOrder2`
  - Fields used: `_id`, `agentId`, `agentPaymentStatus`, `agentPaymentDueDate`, `agentPaidAt`, `agentPaidAmount`, `agentCommissionAmount`, `agentCommissionFinal`, `agentQuote`, `agentAppliedPrice`, `quantity`, `codAmount`, `orderDate`, `orderStatus`, `isActive`, timestamps
  - These provide order-level linkage and explicit due dates for safe overdue evidence.
- `backend/src/test-order2/services/order-payment.service.ts`
  - Existing payment ops summary computes aging buckets and agent payment breakdowns, but Prompt41 does not call mutation paths or service write methods.

Inspected customer/dealer/agent fields:

- `backend/src/user/user.schema.ts`
  - Class: `User`
  - Fields used: `_id`, `fullName`, `role`, `managerId`, `isActive`
  - Sensitive fields such as `password`, phone, email, token fields are not projected into Prompt41 evidence.

Inspected cashflow modules:

- `backend/src/finance/schemas/cashflow-entry.schema.ts`
  - Class: `CashflowEntry`
  - Fields found: direction, sourceType, amount, date, category, referenceId, description
  - Prompt41 did not use or mutate cashflow entries.
- `backend/src/finance/cashflow-safety.service.ts`
  - Existing finance logic reads agent statement balances for cashflow risk context.

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
  - Existing demo labels include `overdue_dealer_receivables_for_high_revenue_agent` and `late_payment_agent`.
  - Prompt41 did not add fake evidence or seed-only data.

