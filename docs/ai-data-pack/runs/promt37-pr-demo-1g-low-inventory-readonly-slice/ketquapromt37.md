# Ket Qua Prompt 37

Status:

```text
implemented_read_only_slice
```

Output root:

```text
docs/ai-data-pack/runs/promt37-pr-demo-1g-low-inventory-readonly-slice
```

Target finding:

```text
low_inventory_best_seller
```

Implementation summary:

- added read-only evidence row generation in `OperationsCapacityQuery`
- surfaces rows through existing Director section `16_operation_capacity`
- added positive and negative Jest coverage
- kept evidence advisory-only with `data_quality_status: partial`
- no action/provider/OpenAI/live execution branch opened

Verification:

- `npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand`: pass, 21/21 tests
- `npm run build`: pass
- static safety grep: no callable OpenAI/action/provider/live path added; `mutate` only appears inside safety strings

Blocker:

No blocker for partial read-only implementation.

Remaining blocker for strong conclusion:

- reserved quantity is not mapped
- incoming stock is not mapped

