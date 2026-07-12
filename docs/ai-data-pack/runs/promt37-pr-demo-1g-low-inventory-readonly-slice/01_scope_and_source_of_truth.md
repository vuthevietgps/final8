# Scope And Source Of Truth

Prompt 37 targets only:

```text
low_inventory_best_seller
```

Immediate source of truth:

```text
docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/
```

Prompt 36 facts preserved:

- `phase`: `PR-DEMO-1F-A`
- `status`: `weak_evidence_hardening_spec_completed`
- all 5 weak findings specified
- recommended first slice: `low_inventory_best_seller`
- Action Draft Schema remains parked
- action import remains parked
- OpenAI API upload remains parked
- provider execution/mutation remains parked
- Phase 3 remains parked

Prompt 37 implementation scope:

- inspect existing Director JSON/query structure
- inspect existing inventory/product/order models
- add read-only evidence rows only where existing fields support them
- add focused tests
- document downgraded data quality where reserved quantity and incoming stock are not available

