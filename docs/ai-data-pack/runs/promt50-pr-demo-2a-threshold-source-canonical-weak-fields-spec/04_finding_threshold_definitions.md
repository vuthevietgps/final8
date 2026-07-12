# Finding Threshold Definitions

## `low_inventory_best_seller`

Current known sources:

- Bestseller rank and sales velocity are derived from `ordertest2` order quantity over the observed order window.
- Reorder threshold currently uses `products.minStock`.
- Current stock uses `inventorysummaries.onHand`.
- Reserved quantity is derived from active non-final/non-payment/non-return `ordertest2.orderStatus` using `deliverystatuses` metadata or fallback statuses.
- Incoming stock is derived from `purchaseorders` with included statuses `ordered` and `partially_received`.
- Available stock formula currently documented as `max(0, inventorysummaries.onHand - reserved_quantity_candidate)`.
- Projected available stock formula currently documented as `max(0, onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)`.

Canonical threshold sources needed:

| Threshold key | Proposed source | Required semantics |
|---|---|---|
| `low_inventory.bestseller_rank_window` | future threshold registry or Director policy config | Window and rank cutoff, e.g. top N products over last N days. |
| `low_inventory.sales_velocity_window` | future threshold registry | Order quantity window, exclusion rules, minimum sample size. |
| `low_inventory.reorder_point` | `products.minStock` now; future versioned inventory policy | Product/SKU reorder point, effective date, owner review. |
| `low_inventory.days_of_cover_threshold` | future inventory policy config | Current implicit `7` should become configured. |
| `low_inventory.reserved_quantity_semantics` | future reservation ledger or status policy registry | Which order statuses reserve stock, quantity basis, cancellation/return handling. |
| `low_inventory.incoming_stock_semantics` | PO status policy registry | Which PO statuses are confirmed incoming and how partial receipts count. |
| `low_inventory.confirmed_incoming_po_status` | purchase policy config | Status set for confirmed incoming, not merely candidate. |
| `low_inventory.available_projected_stock_formula` | inventory policy config | Versioned formula and whether to include reserved/incoming candidates. |

Emission boundary:

- Missing product mapping, inventory mapping, sales velocity, or threshold should prevent row emission.
- Derived reserved/incoming semantics should emit with downgrade, not block emission if all hard row fields exist.

## `supplier_cost_up`

Current known sources:

- Supplier cost increase threshold is implicit `15` percent in query logic.
- Current/prior supplier cost uses `supplierquotes.price`.
- Quote effective date uses `supplierquotes.effectiveAt`, `createdAt`, or `updatedAt` candidate ordering.
- Product cost uses `products.suppliers.appliedPrice`, `products.importPrice`, or `products.totalCost`.
- Dealer/customer price history uses `quotes.unitPrice`, status, `validFrom`, `createdAt`, or `updatedAt`.
- Dealer price lag is derived from latest dealer quote date versus current supplier quote date.

Canonical threshold sources needed:

| Threshold key | Proposed source | Required semantics |
|---|---|---|
| `supplier_cost.cost_increase_percent_threshold` | future pricing/procurement threshold registry | Replace implicit `15_percent`. |
| `supplier_cost.supplier_quote_acceptance_status` | supplier quote schema/policy | Approved/accepted status set. Current schema lacks formal `status` and `approvalStatus`. |
| `supplier_cost.supplier_quote_effective_date` | `supplierquotes.effectiveAt` plus version rules | Required ordering basis for current/prior cost. |
| `supplier_cost.product_cost_history` | future product cost ledger | Historical costs, not only current product fields. |
| `supplier_cost.dealer_price_history` | quotes/dealer price ledger | Approved customer/dealer price periods and active status. |
| `supplier_cost.dealer_price_lag_threshold` | pricing policy config | Maximum allowed lag in days after supplier cost change. |
| `supplier_cost.margin_cogs_impact_threshold` | finance/pricing policy config | Margin/COGS impact needed before confidence can rise. |

Emission boundary:

- Missing current/prior supplier cost, product mapping, supplier mapping, or cost increase below threshold should prevent row emission.
- Missing approval status, dealer price history, effective dates, or margin impact should downgrade confidence.

## `overdue_dealer_receivables`

Current known sources:

- Due date uses `ordertest2.agentPaymentDueDate`.
- Outstanding balance is derived from order-level agent payment fields.
- Paid amount uses `agentPaidAmount` and payment status.
- Aging bucket is derived from days overdue.
- Last payment date can come from `agentstatements.payments`.
- Collection owner currently derives from `users.managerId` or payment creator candidate.
- Statement linkage uses `agentstatements`.
- Repo terminology is settlement/payable-oriented; it is not clean proof of collectible dealer cash-in.

Canonical threshold sources needed:

| Threshold key | Proposed source | Required semantics |
|---|---|---|
| `dealer_receivable.settlement_due_date_source` | order/settlement policy config | Official due-date field and status conditions. |
| `dealer_receivable.outstanding_balance_formula` | finance policy config | Formula for outstanding balance by order/statement. |
| `dealer_receivable.paid_amount_formula` | finance policy config | Which payment fields count as paid. |
| `dealer_receivable.overdue_aging_buckets` | finance collection policy | Bucket cutoffs and labels. |
| `dealer_receivable.last_payment_date_source` | statement/payment ledger | Latest payment event semantics. |
| `dealer_receivable.collection_owner_source` | CRM/finance ownership mapping | Responsible owner, fallback, and required freshness. |
| `dealer_receivable.statement_linkage` | statement/order mapping policy | Required linkage between statement and order/invoice. |
| `dealer_receivable.terminology_boundary` | finance glossary/policy | Receivable/payable/settlement/collectible cash-in definitions. |

Emission boundary:

- Missing due date, dealer/agent id, or positive outstanding balance should prevent row emission.
- Missing last payment date, collection owner, or statement linkage should downgrade confidence.

## `labor_overtime_high`

Current known sources:

- Current/prior windows are adjacent 7-day periods.
- Overtime candidate is derived from `laborcost1.workHours` above `8` hours per employee/day.
- Revenue/workload comparison uses `ordertest2` deposit/COD/manual payment and order quantity/count.
- Labor cost uses `laborcost1.cost`.
- Labor statements are counted for context.
- SLA pressure, staff capacity, and team mapping are not mapped.

Canonical threshold sources needed:

| Threshold key | Proposed source | Required semantics |
|---|---|---|
| `labor.overtime_hours_threshold` | HR/labor policy registry | Hours/day or hours/week threshold; replace implicit `8h/day`. |
| `labor.work_hour_source_hierarchy` | labor policy config | Priority among labor cost rows, timesheets, statements, manual overrides. |
| `labor.revenue_workload_window` | operations policy config | Current/prior windows and workload metric. |
| `labor.overtime_growth_threshold` | operations policy config | Difference or ratio threshold versus revenue/workload growth. |
| `labor.sla_deadline_pressure_source` | operations SLA source | Link backlog/deadline pressure to labor row. |
| `labor.staff_capacity_source` | HR capacity roster | Planned capacity, absence, shift capacity. |
| `labor.team_group_mapping` | user/team registry | Labor group/team mapping instead of employee-as-group candidate. |
| `labor.cost_attribution_policy` | finance/labor config | How labor cost is attributed to team, order, product, or period. |

Emission boundary:

- Missing comparable revenue/workload period or overtime hours should prevent row emission.
- Missing policy threshold, SLA pressure, staff capacity, or team mapping should downgrade confidence; current confidence should remain low.

## `slow_supplier_good_cost`

Current known sources:

- Supplier cost advantage threshold is implicit `5` percent below peer median.
- Peer comparison uses latest `supplierquotes` for same product and currency.
- Accepted quote count is derived from `approvalStatus` or `status` when present; current schema does not guarantee those fields.
- Slow signal uses fulfilled POs with `receivedDate > expectedDeliveryDate`.
- Expected lead time can use `products.estimatedDeliveryDays`.
- Supplier reliability score, delivery quality notes, variant grouping, and margin/COGS impact are missing/weak.

Canonical threshold sources needed:

| Threshold key | Proposed source | Required semantics |
|---|---|---|
| `slow_supplier.cost_advantage_threshold` | procurement threshold registry | Replace implicit `5_percent`. |
| `slow_supplier.peer_quote_comparison_method` | procurement pricing policy | Median/mean/min comparison, currency handling, outlier policy. |
| `slow_supplier.accepted_quote_status` | supplier quote policy/schema | Approved/accepted status set. |
| `slow_supplier.delivery_delay_threshold` | procurement SLA policy | Delay days or delayed-PO count threshold. |
| `slow_supplier.expected_lead_time_source` | product/SKU/supplier lead-time policy | Use product-level or supplier-product lead time. |
| `slow_supplier.reliability_score` | supplier scorecard | Score formula and freshness. |
| `slow_supplier.delivery_quality_notes` | receiving/QA notes | Quality issue taxonomy and owner. |
| `slow_supplier.variant_product_grouping` | product variant registry | Product/SKU/variant grouping. |
| `slow_supplier.margin_cogs_impact` | finance policy/COGS ledger | How cost advantage and delay affect margin/COGS. |

Emission boundary:

- Missing product/supplier mapping, peer cost source, or slow delivery signal should prevent row emission.
- Missing configured threshold, accepted quote status, prior PO sample, quality notes, reliability score, or margin impact should downgrade confidence.

