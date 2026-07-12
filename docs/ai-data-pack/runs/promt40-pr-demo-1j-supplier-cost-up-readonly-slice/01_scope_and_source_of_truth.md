# Scope And Source Of Truth

Phase: `PR-DEMO-1J`

Target finding:

```text
supplier_cost_up
```

Prompt 40 is limited to structured read-only Director JSON evidence for supplier cost increases. It does not open Action Draft Schema, action import, provider execution, provider validation, approval workflow, or any price/supplier/purchase mutation branch.

Immediate source of truth:

- Prompt 39 result: `docs/ai-data-pack/runs/promt39-pr-demo-1i-low-inventory-reserved-incoming-upgrade/`
- Prompt 36 supplier spec: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/04_finding_supplier_cost_up.md`
- Prompt 36 canonical evidence model: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/03_canonical_evidence_model.md`
- Prompt 36 data quality gates: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/10_data_quality_gates.md`

Preserved Prompt 39 facts:

- `low_inventory_best_seller` remains implemented as partial read-only evidence.
- Action Draft Schema remains parked.
- Provider execution/mutation remains parked.
- OpenAI API upload/call remains parked.
- Phase 3 remains parked.

