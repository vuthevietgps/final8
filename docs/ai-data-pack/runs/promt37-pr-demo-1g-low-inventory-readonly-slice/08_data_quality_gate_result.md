# Data Quality Gate Result

Implemented gate behavior:

| Gate | Result |
|---|---|
| Product/SKU maps to inventory summary | Required; otherwise no row is emitted. |
| Current inventory exists | Required via `inventorysummaries.onHand`; otherwise no row is emitted. |
| Reorder threshold has a source | Required via `products.minStock`; otherwise no row is emitted. |
| Sales velocity exists | Required via dated order rows; otherwise no row is emitted. |
| Incoming stock missing | Row is downgraded to `data_quality_status: partial`. |
| Reserved quantity missing | Row is downgraded to `data_quality_status: partial`. |
| Available quantity strong enough for action | No; available quantity uses `onHand` with explicit assumption. |

Confidence decision:

```text
confidence: medium
data_quality_status: partial
```

Refusal of strong conclusion:

- If dated sales velocity is missing, the implementation emits no `low_inventory_best_seller` row.
- If product mapping, inventory summary, current inventory, or reorder threshold is missing, the implementation emits no row.
- Even when a row is emitted, missing reserved and incoming stock block purchase/replenishment action claims.

Threshold source:

```text
products.minStock
```

Advisory-only boundary:

The row may support Director review wording, but it may not support purchase order creation, inventory mutation, replenishment execution, or ads-provider mutation.

