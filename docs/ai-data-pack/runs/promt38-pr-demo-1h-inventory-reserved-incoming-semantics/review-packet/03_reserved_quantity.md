# Reserved Quantity

Decision:

```text
reserved_quantity_derivable_with_caution
```

Future derivation:

```text
sum(ordertest2.quantity)
where isActive != false
  and productId exists
  and quantity > 0
  and orderStatus is active / non-final / non-payment-trigger / non-return
```

Include statuses through dynamic delivery-status flags:

- `isActive=true`
- `isFinal=false`
- `isPaymentTrigger=false`
- `isReturnStatus=false`

Exclude:

- final statuses
- payment-trigger statuses
- return statuses
- inactive statuses
- ambiguous statuses

Quality:

```text
partial, medium at most
```

Reason:

There is no canonical reservation field or order-to-inventory reservation linkage.

