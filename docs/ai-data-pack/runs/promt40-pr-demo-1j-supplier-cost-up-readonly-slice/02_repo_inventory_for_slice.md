# Repo Inventory For Slice

Inspected supplier quote model and service:

- `backend/src/supplier-quote/schemas/supplier-quote.schema.ts`
  - Class: `SupplierQuote`
  - Fields used: `productId`, `supplierId`, `price`, `currency`, `effectiveAt`, `createdAt`, `updatedAt`
  - Index found: `{ productId: 1, supplierId: 1, effectiveAt: -1, createdAt: -1 }`
  - Gap: no canonical approval status field in the schema.
- `backend/src/supplier-quote/supplier-quote.service.ts`
  - Functions found: `create`, `findAll`, `getLatest`, `getEffectiveAt`, `getPriceHistory`, `getSupplierQuotes`
- `backend/src/supplier-quote/dto/create-supplier-quote.dto.ts`
  - DTO fields include product/supplier ids, price, currency, effective date, note, shipping/return fee overrides.

Inspected dealer price / quote model and service:

- `backend/src/quote/schemas/quote.schema.ts`
  - Class: `Quote`
  - Fields used: `productId`, `agentId`, `agentName`, `unitPrice`, `status`, `validFrom`, `validUntil`, `isActive`, `createdAt`, `updatedAt`
- `backend/src/quote/quote.enum.ts`
  - `QuoteStatus` includes pending/approved/rejected/expired states.
- `backend/src/quote/quote.service.ts`
  - Functions found: `create`, `findAll`, `findOne`, `update`, `remove`, `findByAgent`, `findByProduct`, `getStats`, diagnostics/migration helpers.
  - Prompt40 implementation does not call these mutation-capable methods; it reads the collection through the AI Data Pack query.

Inspected product and product cost fields:

- `backend/src/product/schemas/product.schema.ts`
  - Class: `Product`
  - Fields used: `_id`, `name`, `sku`, `importPrice`, `totalCost`, `suppliers.appliedPrice`, `suppliers.appliedAt`, `updatedAt`
  - Gap: no durable product cost history table was found for this slice.
- `backend/src/product-category/schemas/product-category.schema.ts`
  - Product categories exist, but the implemented row does not require category join.

Inspected purchase and supplier statement modules:

- `backend/src/purchase/schemas/purchase-order.schema.ts`
  - Class: `PurchaseOrder`
  - Relevant fields found: `supplierId`, `items`, `unitPrice`, `status`, `expectedDeliveryDate`, `receivedDate`
  - Not used for Prompt40 implementation because supplier quote history was sufficient and purchase-order mutation is banned.
- `backend/src/supplier-payable/schemas/supplier-statement.schema.ts`
- `backend/src/supplier-payable/schemas/supplier-payable.schema.ts`
  - Supplier statement/payable data exists but is settlement-oriented, not dealer price history.

Inspected Director JSON / AI Data Pack surface:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
  - Director section `16_operation_capacity` receives `operations.operation_capacity`.
- `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`
  - `DIRECTOR_XLSX_SHEETS` includes `16_operation_capacity`.
- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
  - Existing operational risk evidence pattern reused.
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`
  - Existing focused service tests extended.

Demo seed fixture inspected by search:

- `backend/src/ai-data-pack/demo-seed/director-demo-seed.fixtures.ts`
  - Existing demo labels include `supplier_cost_up_15_percent_without_matching_dealer_price_update`.
  - Prompt40 did not add fake evidence or seed-only data.

