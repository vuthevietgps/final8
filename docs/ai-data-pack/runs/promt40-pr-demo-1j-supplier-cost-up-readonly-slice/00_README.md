# Prompt 40 - PR-DEMO-1J

Status: `implemented_read_only_slice`

This run implements a read-only Director JSON evidence slice for:

```text
supplier_cost_up
```

Output root:

```text
docs/ai-data-pack/runs/promt40-pr-demo-1j-supplier-cost-up-readonly-slice/
```

Implemented:

- Reads existing `supplierquotes`, `products`, and `quotes` collections through `OperationsCapacityQuery`.
- Adds advisory-only `supplier_cost_up` rows to the Director `16_operation_capacity` evidence surface.
- Calculates supplier quote cost increase percent from current versus prior supplier quote.
- Adds dealer price lag/downgrade fields when dealer price history is older or missing.
- Keeps `data_quality_status: partial` and blocks mutation via `not_allowed_actions`.

No Action Draft Schema, action import, OpenAI API call, approval workflow, provider execution/mutation/validateOnly, DB migration, supplier mutation, dealer price mutation, purchase order mutation, ads mutation, or new export/download behavior was added.

