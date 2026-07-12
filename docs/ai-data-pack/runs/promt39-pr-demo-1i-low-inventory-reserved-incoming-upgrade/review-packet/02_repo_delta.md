# Repo Delta

Prompt 37 had a partial `low_inventory_best_seller` row with on-hand inventory only.

Prompt 39 added:

- delivery status metadata read from `deliverystatuses`
- detailed purchase order read from `purchaseorders`
- `reservedQuantityCandidate`
- `incomingStockQuantityCandidate`
- updated available/projected calculations

No schema or migration was added.

