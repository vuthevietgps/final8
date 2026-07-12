# Future Tests

Prompt 38 adds no code. These tests are required for a later implementation prompt.

## Reserved Quantity Derivation

- Creates active non-final orders for one product and verifies `reserved_quantity_candidate` sums `quantity`.
- Excludes inactive orders.
- Excludes orders with missing `productId`.
- Excludes orders with zero or negative `quantity`.
- Excludes delivered/payment-trigger/final statuses.
- Excludes returned statuses.
- Excludes ambiguous raw statuses when no delivery-status metadata classifies them.

## Incoming Stock Derivation

- Counts `ordered` PO item unreceived quantity.
- Counts `partially_received` PO item unreceived quantity.
- Excludes `draft` POs.
- Excludes `cancelled` POs.
- Excludes `received` POs.
- Excludes PO items missing product mapping.
- Verifies `inventorybatches.quantityRemaining` is not counted as incoming stock.

## Available Quantity Calculation

- Verifies `available_quantity = max(0, onHand - reserved_quantity_candidate)`.
- Verifies available quantity never becomes negative.
- Verifies missing inventory summary blocks upgraded row.

## Days Of Cover Calculation

- Verifies `days_of_cover = available_quantity / sales_velocity_per_day`.
- Verifies `projected_days_of_cover = projected_available_quantity / sales_velocity_per_day`.
- Verifies missing sales velocity emits no upgraded row.
- Verifies small sample size produces partial/low confidence.

## Safety And Static Checks

Future implementation prompt must run:

```text
npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand
npm run build
rg safety scans on changed files
```

Static safety scan must confirm no:

- OpenAI upload/call
- Action Draft Schema
- action import
- approval workflow
- provider validateOnly/mutation/live execution
- DB migration
- inventory mutation
- purchase/replenishment action

