# Overdue Dealer Receivables Design

Director JSON evidence surface:

```text
sections["16_operation_capacity"].data
operation_capacity
operational_risk_findings
```

Collection inputs:

- `ordertest2`
- `agentstatements`
- `users`

Canonical fields implemented where applicable:

- `finding_key`
- `finding_label`
- `evidence_strength`
- `source_domain`
- `source_collections_or_modules`
- `time_window`
- `affected_entity_type`
- `affected_entity_id`
- `affected_entity_name_or_alias`
- `metric_name`
- `metric_value`
- `threshold_value`
- `comparison_period`
- `calculation_method`
- `sample_size`
- `data_quality_status`
- `confidence`
- `blocking_reason_if_any`
- `recommended_advisory_language`
- `not_allowed_actions`

Domain fields implemented:

- `dealer_or_agent_id`
- `dealer_or_agent_alias`
- `outstanding_balance`
- `overdue_balance`
- `due_date`
- `days_overdue`
- `aging_bucket`
- `last_payment_date`
- `last_payment_amount`
- `original_invoice_or_order_amount`
- `paid_amount`
- `invoice_or_order_id`
- `collection_owner`
- `payment_terms_or_threshold_source`

Row creation logic:

1. Read active orders from `ordertest2`.
2. Skip paid and `n/a` agent payment statuses.
3. Require `agentId`.
4. Require explicit `agentPaymentDueDate`; missing due date blocks row emission.
5. Require positive outstanding amount from `agentPaidAmount`, `agentCommissionFinal`, `agentCommissionAmount`, or agent quote fallback; missing amount blocks row emission.
6. Require due date older than the as-of/report date.
7. Derive `days_overdue` and aging bucket.
8. Join agent/dealer alias and manager/owner hint from `users`.
9. Join statement/payment history from `agentstatements`.
10. Downgrade confidence when last payment, collection owner, or statement linkage is missing.

Action safety:

```text
not_allowed_actions = do_not_create_collection_action; do_not_block_agent; do_not_mutate_customer; do_not_mutate_invoice_or_order; do_not_mutate_cashflow; do_not_execute_ads_actions
```

