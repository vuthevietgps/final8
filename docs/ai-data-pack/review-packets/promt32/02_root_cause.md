# Root Cause

## `high_sales_late_payment_agent`

Seed data existed in `agentstatements`; the Director export did not surface the alias. This was fixed in `OperationsCapacityQuery`.

## `return_rate_above_policy`

Seed data existed in `returnrequests`; the Director export did not surface a return-rate policy risk alias. This was fixed in `OperationsCapacityQuery`.

## `inventory_movement_gap`

Seed inventory movement rows existed, but all referenced existing purchase orders. The seed was fixed to create deterministic dangling purchase-order references and the Director query now surfaces the matching risk label.

