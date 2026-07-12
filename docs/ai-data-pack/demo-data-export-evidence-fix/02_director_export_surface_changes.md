# Director Export Surface Changes

The Prompt 32 surface change is intentionally narrow. It adds operational demo risk findings to the existing operations capacity query and keeps them inside Director section `16_operation_capacity`.

## Seed Change

File: `backend/src/ai-data-pack/demo-seed/director-demo-seed.fixtures.ts`

Every 41st inventory transaction now receives:

- A deterministic missing purchase-order id.
- The note `inventory_movement_without_matching_purchase_order`.

This creates a stable demo signal for the expected inventory movement gap finding.

## Query Change

File: `backend/src/ai-data-pack/queries/operations-capacity.query.ts`

`OperationsCapacityQuery` now reads and cross-checks:

- `ordertest2`
- `agentstatements`
- `returnrequests`
- `inventorytransactions`
- `purchaseorders`

The existing status-count rows are preserved. Additional operational risk findings are appended to `operation_capacity` and also returned as `operational_risk_findings`.

## New Finding Labels

The query now surfaces:

- `high_sales_late_payment_agent`
- `return_rate_above_policy_for_single_offer`
- `inventory_movement_without_matching_purchase_order`

Aliases are retained where useful:

- `return_rate_above_policy`
- `inventory_movement_gap`

## Test Coverage

File: `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Added unit coverage that creates fake collections and verifies the Director operations query output contains the three operational demo finding labels.

