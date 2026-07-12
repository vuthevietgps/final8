# Incoming Stock

Decision:

```text
incoming_stock_derivable_with_caution
```

Future derivation:

```text
sum(max(0, purchaseorders.items.quantity - purchaseorders.items.quantityReceived))
where purchaseorders.status in ['ordered', 'partially_received']
```

Include PO statuses:

- `ordered`
- `partially_received`

Exclude PO statuses:

- `draft`
- `cancelled`
- `received`
- missing/unknown

Important:

`inventorybatches.quantityRemaining` must not be counted as incoming stock. It is received batch remaining quantity.

Quality:

```text
partial, medium at most
```

