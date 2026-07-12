# Director JSON Evidence Result

Implemented evidence surface:

```text
sections["16_operation_capacity"].data
operation_capacity
operational_risk_findings
```

The row shape includes:

```json
{
  "status": "risk_signal",
  "finding_key": "overdue_dealer_receivables",
  "finding_label": "overdue_dealer_receivables_for_high_revenue_agent",
  "source_domain": "receivables",
  "source_collections_or_modules": "ordertest2, agentstatements, users",
  "affected_entity_type": "dealer_or_agent",
  "metric_name": "overdue_balance_by_aging_bucket",
  "threshold_value": "due_date_before_as_of_report_date",
  "data_quality_status": "partial",
  "not_allowed_actions": "do_not_create_collection_action; do_not_block_agent; do_not_mutate_customer; do_not_mutate_invoice_or_order; do_not_mutate_cashflow; do_not_execute_ads_actions"
}
```

Test-proven sample facts:

- `dealer_or_agent_id: agent-1`
- `outstanding_balance: 1000000`
- `overdue_balance: 1000000`
- `due_date: 2026-06-01`
- `days_overdue: 13`
- `aging_bucket: 8_14`
- `last_payment_date: 2026-06-05`
- `last_payment_amount: 200000`
- `original_invoice_or_order_amount: 1200000`
- `invoice_or_order_id: order-1`
- `collection_owner: collector-1`
- `confidence: medium`

No action payloads are present. The row is advisory-only evidence for Director/ChatGPT Web reading.

