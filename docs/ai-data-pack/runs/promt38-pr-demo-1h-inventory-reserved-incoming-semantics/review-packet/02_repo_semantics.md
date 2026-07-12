# Repo Semantics

Inspected exact areas:

- `TestOrder2` schema and service
- `OrderStatus`, `ProductionStatus`, and payment/return status constants
- `DeliveryStatus` schema/service flags
- `InventorySummary`, `InventoryTransaction`, and `InventoryBatch`
- `InventoryService` receive/issue/return paths
- `PurchaseStatus`, `PurchaseOrder`, and PO receive service
- Prompt37 run folder evidence

Key findings:

- no canonical reserved field exists
- no order reservation event/table exists
- delivery status has final/payment/return flags, but no reserve flag
- inventory batch remaining quantity is already received on-hand batch stock, not incoming stock
- purchase order items have enough fields to derive unreceived incoming candidates

