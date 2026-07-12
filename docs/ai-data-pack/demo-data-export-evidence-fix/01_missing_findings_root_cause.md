# Missing Findings Root Cause

Prompt 31 reached `9/12` expected findings. Prompt 32 inspected each remaining gap against the local Docker demo database and Director export surfaces.

## `high_sales_late_payment_agent`

Classification: `seed_exists_but_no_export_query`

Source collection: `agentstatements`

Local demo signal count: `62`

Rows with late-payment agent notes existed in the demo seed, but the Director JSON did not emit an operational risk alias for this signal. The fix surfaces a Director operational risk finding keyed by `high_sales_late_payment_agent`.

## `return_rate_above_policy`

Classification: `seed_exists_but_no_export_query`

Source collection: `returnrequests`

Local demo signal count: `17`

Rows with high-return product reasons existed in the demo seed, but the Director JSON did not emit a return-rate policy risk alias. The fix surfaces `return_rate_above_policy_for_single_offer` with alias `return_rate_above_policy`.

## `inventory_movement_gap`

Classification: `seed_mapping_fix_required`

Source collection: `inventorytransactions`

Before the fix:

- `inventory_movement` rows existed: `2140`
- Dangling purchase-order references: `0`

All inventory movement rows referenced existing purchase orders, so the expected finding `inventory_movement_without_matching_purchase_order` could not be proven from the demo data.

After the fix:

- `inventory_movement_without_matching_purchase_order` rows: `54`
- Dangling purchase-order references: `54`

The seed now creates deterministic dangling purchase-order references for every 41st inventory transaction, using the exact note `inventory_movement_without_matching_purchase_order`.

