# Scope

Target:

```text
low_inventory_best_seller
```

Prompt 39 only modifies the read-only Director JSON evidence path in:

```text
backend/src/ai-data-pack/queries/operations-capacity.query.ts
```

Focused tests were updated in:

```text
backend/src/ai-data-pack/ai-data-pack.service.spec.ts
```

Out of scope and not done:

- Action Draft Schema
- action import
- OpenAI API upload/call
- provider validateOnly/execution/mutation
- approval workflow
- inventory mutation
- purchase/replenishment action
- DB migration
- new export/download behavior

