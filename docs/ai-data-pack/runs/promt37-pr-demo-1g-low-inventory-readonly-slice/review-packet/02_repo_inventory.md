# Repo Inventory

Key inspected files:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
- `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`
- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/inventory/schemas/inventory-summary.schema.ts`
- `backend/src/inventory/schemas/inventory-transaction.schema.ts`
- `backend/src/inventory/schemas/inventory-batch.schema.ts`
- `backend/src/product/schemas/product.schema.ts`
- `backend/src/test-order2/schemas/test-order2.schema.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Supported existing fields:

- product id
- SKU/name
- quantity sold
- dated order window
- current on-hand inventory
- reorder threshold

Unsupported for strong conclusion:

- reserved quantity
- incoming stock

