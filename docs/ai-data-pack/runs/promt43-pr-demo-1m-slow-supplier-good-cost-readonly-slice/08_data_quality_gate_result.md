# Data Quality Gate Result

Implemented gates:

- Supplier must map to product through existing `supplierquotes`, `products`, or `purchaseorders` fields.
- Supplier cost must have a current quote.
- Supplier cost must have a peer same-product/same-currency quote to support cost advantage.
- Slow supplier signal must be calculable from `purchaseorders.expectedDeliveryDate` and `purchaseorders.receivedDate`.
- Currency is explicit on quote comparison.
- Product variant/SKU is exposed if available.
- Inventory/on-hand/average cost/incoming quantity are read-only context only.
- Sales/revenue/COGS/margin impact remains optional and is marked missing/weak when not safely mapped.
- Missing product estimated delivery days downgrades confidence.
- Missing supplier quote approval/accepted status downgrades confidence.
- Missing prior-period PO sample downgrades confidence.
- Missing supplier-good mapping blocks row emission.
- Missing peer supplier cost source blocks row emission.
- Missing slow delivery signal blocks row emission.
- No purchase/supplier/order/inventory/stock/cost/price/COGS/cashflow action is allowed.

Data quality status:

- `partial`

Confidence behavior:

- `medium` only when current fulfilled PO sample is at least 2, product estimated delivery days exists, and accepted quote status exists.
- Otherwise `low`.

Known weak fields:

- Delivery quality notes are not modeled.
- Supplier reliability score is not modeled.
- Variant-level supplier grouping is incomplete.
- Reserved quantity is not a canonical supplier reliability field here.
- Margin/COGS impact is not safely attributed to this supplier-good row.

