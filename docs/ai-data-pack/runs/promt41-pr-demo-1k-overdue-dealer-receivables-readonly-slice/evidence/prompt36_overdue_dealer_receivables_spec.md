# Finding Spec - `overdue_dealer_receivables`

## Current Evidence

- Classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts + 16_operation_capacity`
- Related signal: `high_sales_late_payment_agent`

## Why Evidence Is Weak

The current evidence includes an operational late-payment signal, but does not expose enough dealer/agent receivable aging, invoice/order linkage, due date, last payment date, outstanding balance, collection owner, or aging buckets.

## Business Meaning For Director

Dealer or agent receivables may pressure cashflow. The Director can prioritize collection review, but should not conclude fault or approve collection actions without aging and payment detail.

## Minimum ERP Fields/Tables Needed

- dealer/agent receivable aging
- invoice id or order id
- due date
- last payment date
- outstanding balance
- collection owner
- aging buckets
- original invoice amount
- paid amount
- payment terms

## Likely Current ERP Collections/Modules To Inspect Later

- `agentstatements`
- `ordertest2`
- `customers`
- `cashflowentries`
- finance receivable modules if present

## Proposed Director JSON Read-Only Evidence Rows

| field | proposed value |
|---|---|
| `finding_key` | `overdue_dealer_receivables` |
| `finding_label` | `Overdue dealer receivables pressure cash collection` |
| `source_domain` | `receivables` |
| `source_collections_or_modules` | `agentstatements, ordertest2, cashflowentries` |
| `affected_entity_type` | `dealer_or_agent` |
| `metric_name` | `overdue_balance_by_aging_bucket` |
| `threshold_value` | `policy aging threshold` |
| `comparison_period` | `as_of_report_date` |
| `calculation_method` | `sum outstanding balances grouped by aging bucket` |
| `data_quality_status` | `partial until invoices/orders map to statements` |
| `not_allowed_actions` | `do_not_create_collection_action; do_not_block_agent` |

## Data Quality Gates

- Receivable row must map to dealer/agent.
- Invoice/order linkage must exist.
- Due date must exist.
- Last payment date must be known or explicitly missing.
- Outstanding balance must be non-negative.
- Aging bucket must be derived from due date and report date.
- If due date is missing, ChatGPT Web must refuse strong overdue conclusion.

## Example Advisory-Only Wording

"Receivables show possible overdue collection pressure. Review aging buckets and owner follow-up before making collection or sales policy decisions."

## Future Implementation Acceptance Criteria

- Director JSON includes aging buckets.
- Director JSON includes outstanding balance and due date.
- Director JSON includes collection owner and last payment date where available.
- ChatGPT Web can cite dealer/agent evidence rows.

## Future Tests

- Unit test for aging bucket calculation.
- Fixture test for overdue receivable with partial payment.
- Negative test for missing due date.
- Data quality downgrade test for missing order linkage.

## must_not_do_now

- Do not implement receivable query changes in Prompt 36.
- Do not add DB migrations.
- Do not create collection actions.
- Do not open approval workflow.
- Do not open Action Draft Schema.

