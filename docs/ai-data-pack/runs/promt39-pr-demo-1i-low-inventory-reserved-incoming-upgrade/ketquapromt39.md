# Ket Qua Prompt 39

Status:

```text
implemented_partial_read_only_upgrade
```

Output root:

```text
docs/ai-data-pack/runs/promt39-pr-demo-1i-low-inventory-reserved-incoming-upgrade
```

Target finding:

```text
low_inventory_best_seller
```

Implementation summary:

- added `reserved_quantity_candidate`
- added `incoming_stock_quantity_candidate`
- updated `available_quantity` formula to subtract reserved candidate
- added `projected_available_quantity`
- added `projected_days_of_cover`
- added status inclusion/exclusion evidence and inventory semantics quality notes

Verification:

- `npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand`: pass, 22/22 tests
- `npm run build`: pass
- static safety scans: no callable OpenAI/action/provider/live/destructive DB path added; `mutate` appears only in safety strings

Safety:

The row remains read-only, advisory-only, `data_quality_status: partial`, and `confidence: medium`.

