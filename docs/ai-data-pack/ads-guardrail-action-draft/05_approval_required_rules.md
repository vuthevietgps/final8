# Approval Required Rules

Approval requirement is advisory in this phase. No approval workflow is implemented.

## Required Approval Triggers

| Rule ID | Trigger | Expected recommendation behavior |
| --- | --- | --- |
| APR-001 | Budget increase exceeds `per_campaign_increase_max_pct_without_approval`. | Mark `approval_required=true`; include exceeded percent. |
| APR-002 | Total budget after recommendation exceeds daily cap. | Mark approval required or recommend lower cap-compliant budget. |
| APR-003 | Total budget after recommendation exceeds weekly cap. | Mark approval required. |
| APR-004 | Total budget after recommendation exceeds monthly cap. | Mark approval required. |
| APR-005 | Pause/large decrease for campaign materially contributing revenue or profit. | Mark approval required and recommend manual review. |
| APR-006 | Shift budget to product with high cash lag. | Mark approval required or recommend test/investigate. |
| APR-007 | Increase ads while free cash or ads fund is low. | Mark approval required; finance mode should be cash-preserve/cautious. |
| APR-008 | Increase ads for product with high return rate. | Mark approval required; consider investigate or supplier/product fix. |
| APR-009 | Increase ads for product with high cancel rate. | Mark approval required; consider funnel/order quality review. |
| APR-010 | Data maturity is not `ready`. | Mark approval required for any budget increase; lower confidence. |
| APR-011 | Recommendation suggests borrowing more or using reserve funds. | Mark approval required; finance owner review needed. |
| APR-012 | Product/supplier/dealer has risk flag. | Mark approval required if recommendation increases exposure. |
| APR-013 | Product group would exceed max budget share. | Mark approval required or recommend diversified allocation. |
| APR-014 | Campaign guardrail says protected or pause not allowed without approval. | Mark approval required for pause/decrease. |
| APR-015 | Supplier settlement quality is weak/stale. | Mark approval required for scale tied to that supplier. |
| APR-016 | Ads attribution is weak or stale. | Mark approval required for numeric scale; prefer investigate. |
| APR-017 | Recommendation depends on estimated profit only, with realized profit absent. | Mark approval required for scale beyond small test. |
| APR-018 | Cash lag exceeds threshold even though ROAS is high. | Mark approval required; do not present as safe scale. |

## Approval Reason Format

```json
{
  "approval_required": true,
  "approval_reason": "Budget increase 35% exceeds allowed 20%; finance_mode=cash_preserve; data_maturity=partial_ready.",
  "approval_rule_ids": ["APR-001", "APR-007", "APR-010"]
}
```

## No Approval Means No Execution

Even when `approval_required=false`, the recommendation remains:

```text
advisory_only
non_executable
not_import_ready
not_provider_mutation
```
