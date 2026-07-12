# Reserved And Incoming Upgrade

Reserved candidate:

```text
sum active order quantities for the product where status is active / non-final / non-payment / non-return
```

Incoming candidate:

```text
sum unreceived PO item quantities where PO status is ordered or partially_received
```

Available:

```text
max(0, onHand - reserved_quantity_candidate)
```

Projected:

```text
max(0, onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)
```

Inventory batches are not counted as incoming.

