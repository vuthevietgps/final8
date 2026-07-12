# Prompt 33 ChatGPT Web Input

Use this prompt in ChatGPT Web after uploading or pasting the redacted Director JSON artifact:

`tmp/ai-data-pack-prompt32-exports/AIDP-20260614045658-a295d333/director_data_pack.json`

## Prompt To Paste Into ChatGPT Web

You are reviewing a redacted ERP Director Data Pack JSON as a director/executive analysis packet, not as source code.

Analyze only the uploaded JSON unless I explicitly provide more data. Do not invent data. If a finding is not supported by the JSON, mark it as missing. Use exact JSON section names, labels, finding keys, messages, or field paths wherever possible.

Hard limits:

- Do not create executable action files.
- Do not create an `ads_execution_plan.zip`.
- Do not create provider/API mutation instructions.
- Do not ask for OpenAI API upload.
- Do not call or suggest calling OpenAI API from ERP/operator.
- Do not open or design Action Draft Schema.
- Do not propose action import.
- Do not propose approval workflow implementation.
- Do not propose dry-run/live provider execution.
- Do not propose provider validateOnly or provider mutation.
- Do not start Phase 3.
- Keep all recommendations advisory only.

Return the analysis in this exact structure:

1. Executive summary
   - Summarize the business state using the uploaded Director JSON.
   - Separate facts from inferences.

2. Top risks / abnormalities
   - List the most material abnormalities.
   - Include exact JSON evidence locations or labels.

3. Cash / receivable / payment pressure
   - Discuss cash gap, receivables, supplier/agent payment pressure, and finance warnings.
   - Include exact JSON evidence locations or labels.

4. Ads / campaign efficiency signals
   - Discuss ad spend, lead volume, mapping confidence, attribution limits, and campaign efficiency.
   - Include exact JSON evidence locations or labels.
   - Do not recommend any live ads mutation.

5. Product / offer / inventory issues
   - Discuss product profitability, low inventory, returns, supplier cost, and inventory movement gaps.
   - Include exact JSON evidence locations or labels.

6. Dealer / agent / sales collection issues
   - Discuss dealer/agent performance, late payment, overdue receivables, and sales collection risk.
   - Include exact JSON evidence locations or labels.

7. Operations capacity issues
   - Discuss operational capacity, labor overtime, return workload, and inventory movement quality.
   - Include exact JSON evidence locations or labels.

8. Expected demo findings detected
   - Classify each expected finding as `detected_with_evidence`, `detected_but_weak_evidence`, or `missing`.
   - Include exact JSON evidence locations or labels for every detected finding.
   - Do not mark a finding detected unless the uploaded JSON supports it.

Expected findings:

| Expected key | Expected JSON label or evidence pattern |
|---|---|
| `supplier_cost_up` | `supplier_cost_up_15_percent_without_matching_dealer_price_update` |
| `ad_spend_spike` | `ad_spend_spike_with_lower_lead_volume` |
| `cash_gap` | `cash_gap_next_7_days_from_agent_receivable_delay` |
| `overdue_dealer_receivables` | `overdue_dealer_receivables_for_high_revenue_agent` |
| `low_inventory_best_seller` | `best_selling_product_low_inventory` |
| `labor_overtime_high` | `labor_overtime_high_without_matching_revenue_growth` |
| `negative_margin_product_group` | `negative_margin_product_group` |
| `slow_supplier_good_cost` | `slow_reliability_supplier_with_good_cost` |
| `high_sales_late_payment_agent` | `high_sales_late_payment_agent` |
| `return_rate_above_policy` | `return_rate_above_policy_for_single_offer` |
| `google_ads_mapping_gap` | `ads_account_to_campaign` or mapping gap/attribution warning labels |
| `inventory_movement_gap` | `inventory_movement_without_matching_purchase_order` |

9. Recommendations, advisory only
   - Provide director-level recommendations.
   - Keep recommendations non-executable and review-only.
   - Include dependencies and missing data checks.

10. No action execution statement
   - Explicitly state: "This analysis is advisory only. It does not execute actions, import actions, call provider APIs, mutate ads platforms, or authorize live changes."

