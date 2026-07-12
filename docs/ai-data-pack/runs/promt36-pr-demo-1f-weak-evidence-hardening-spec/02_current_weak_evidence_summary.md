# Current Weak Evidence Summary

| finding_key | current classification | current evidence location | why weak | risk if ChatGPT Web over-interprets it |
|---|---|---|---|---|
| `supplier_cost_up` | `detected_but_weak_evidence` | `18_alerts` | Evidence is currently an alert label without full supplier quote, product cost, and dealer price update detail. | ChatGPT Web may infer a pricing action or supplier issue without enough proof of cost increase timing, approval, or dealer price lag. |
| `overdue_dealer_receivables` | `detected_but_weak_evidence` | `18_alerts + 16_operation_capacity` | Agent late-payment signal exists, but dealer/receivable aging detail is not independently surfaced. | ChatGPT Web may overstate collection risk or blame a dealer/agent without due date, invoice, balance, and payment history. |
| `low_inventory_best_seller` | `detected_but_weak_evidence` | `18_alerts` | Alert label exists, but bestseller rank, available quantity, reorder threshold, incoming stock, and velocity are not shown together. | ChatGPT Web may recommend purchase/replenishment without knowing actual available stock or days of cover. |
| `labor_overtime_high` | `detected_but_weak_evidence` | `18_alerts` | Alert label exists, but timesheets, overtime hours, labor cost, workload, and revenue comparison rows are not surfaced. | ChatGPT Web may infer staffing inefficiency without workload/SLA context or comparable revenue period. |
| `slow_supplier_good_cost` | `detected_but_weak_evidence` | `18_alerts` | Alert label exists, but supplier lead time, late delivery, quote/cost comparison, and reliability score rows are not surfaced. | ChatGPT Web may recommend replacing or prioritizing a supplier without enough cost/reliability tradeoff evidence. |

