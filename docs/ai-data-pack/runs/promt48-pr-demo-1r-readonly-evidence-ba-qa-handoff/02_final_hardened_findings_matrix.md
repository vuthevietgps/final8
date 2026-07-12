# Final Hardened Findings Matrix

Director section/path for every finding:

`sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

## low_inventory_best_seller

- Latest slice prompt: Prompt39 reserved/incoming upgrade; base read-only slice began in Prompt37.
- Latest accepted guard: Prompt47 section guard.
- Implementation status: read-only advisory evidence implemented and guarded.
- Source collections/modules: `inventorysummaries, products, ordertest2, purchaseorders, deliverystatuses`.
- Required field groups: product identity; current inventory/on-hand; sales velocity or bestseller rank; available or projected stock context.
- Data-quality behavior: `partial`.
- Confidence behavior: `medium` in current guarded fixture.
- Row blockers: reserved quantity and incoming stock are derived candidates, not canonical reservation/confirmed incoming.
- Remaining weak fields: canonical reservation, confirmed incoming stock status, reorder semantics, inventory policy context.
- Not-allowed action class: no purchase order creation, inventory mutation, or replenishment execution.
- Action payloads absent: yes, guarded by Prompt45.

## supplier_cost_up

- Latest slice prompt: Prompt40.
- Latest accepted guard: Prompt47 section guard.
- Implementation status: read-only advisory margin-pressure evidence implemented and guarded.
- Source collections/modules: `supplierquotes, products, quotes`.
- Required field groups: supplier identity; product identity; current supplier cost; prior supplier cost; cost growth metric.
- Data-quality behavior: `partial`.
- Confidence behavior: `medium` when dealer price history is approved and older than supplier quote; otherwise `low`.
- Row blockers: supplier/dealer quote approval status, product cost history, and dealer price effective date may be incomplete.
- Remaining weak fields: supplier quote approval/effective dates, product cost history, dealer price history linkage.
- Not-allowed action class: no price changes, supplier actions, dealer price mutation, purchase order creation, or ads execution.
- Action payloads absent: yes, guarded by Prompt45.

## overdue_dealer_receivables

- Latest slice prompt: Prompt41.
- Latest accepted guard: Prompt47 section guard.
- Implementation status: read-only advisory receivable/settlement-pressure evidence implemented and guarded.
- Source collections/modules: `ordertest2, agentstatements, users`.
- Required field groups: dealer/agent identity; due date; days overdue or aging bucket; overdue/outstanding balance.
- Data-quality behavior: `partial`.
- Confidence behavior: `medium` when last payment date and collection owner exist; otherwise `low`.
- Row blockers: current ERP agent receivable/payable semantics are settlement-oriented and not proof of collectible cash-in or dealer fault.
- Remaining weak fields: last payment date, collection owner, agent statement linkage, receivable terminology semantics.
- Not-allowed action class: no collection action, agent blocking, customer mutation, invoice/order mutation, cashflow mutation, or ads execution.
- Action payloads absent: yes, guarded by Prompt45.

## labor_overtime_high

- Latest slice prompt: Prompt42.
- Latest accepted guard: Prompt47 section guard.
- Implementation status: read-only advisory labor cost/capacity signal implemented and guarded.
- Source collections/modules: `laborcost1, laborstatements, ordertest2, users`.
- Required field groups: team/labor group identity; current overtime; prior overtime; revenue growth; labor or overtime growth.
- Data-quality behavior: `partial`.
- Confidence behavior: `low`.
- Row blockers: overtime is derived from laborcost1 work hours; canonical overtime policy, SLA pressure, and staff capacity are not mapped.
- Remaining weak fields: overtime policy threshold, SLA/deadline pressure, staff capacity, team mapping.
- Not-allowed action class: no staffing change, schedule action, payroll mutation, timesheet mutation, order/revenue mutation, cashflow mutation, or ads execution.
- Action payloads absent: yes, guarded by Prompt45.

## slow_supplier_good_cost

- Latest slice prompt: Prompt43.
- Latest accepted guard: Prompt47 section guard.
- Implementation status: read-only advisory supplier reliability/cost tradeoff evidence implemented and guarded.
- Source collections/modules: `supplierquotes, purchaseorders, products, inventorysummaries, users`.
- Required field groups: supplier id; product id; current supplier cost; peer median/comparison cost; supplier cost advantage percent; delay days or delayed purchase order count.
- Data-quality behavior: `partial`.
- Confidence behavior: `medium` when there are enough fulfilled POs, accepted quote count, and delivery threshold; otherwise `low`.
- Row blockers: supplier delivery quality notes, reliability score, reserved quantity, margin/COGS impact, and variant-level mapping are incomplete.
- Remaining weak fields: prior supplier cost, supplier quote approval, accepted quote count, estimated delivery threshold, prior fulfillment sample, PO created date, delivery quality, reliability score, variant mapping, reserved quantity, sales/usage, margin/COGS impact.
- Not-allowed action class: no purchase order creation, supplier order change, inventory/stock mutation, supplier cost mutation, price/COGS mutation, order/revenue mutation, cashflow mutation, or ads execution.
- Action payloads absent: yes, guarded by Prompt45.
