# Scope And Source Of Truth

Phase: `PR-DEMO-1K`

Target finding:

```text
overdue_dealer_receivables
```

Prompt41 is limited to structured read-only Director JSON evidence for overdue dealer/agent settlement pressure. It does not open Action Draft Schema, action import, provider execution, provider validation, approval workflow, payment mutation, cashflow mutation, collection action, or agent blocking.

Immediate source of truth:

- Prompt40 result: `docs/ai-data-pack/runs/promt40-pr-demo-1j-supplier-cost-up-readonly-slice/`
- Prompt36 overdue dealer receivables spec: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/05_finding_overdue_dealer_receivables.md`
- Prompt36 canonical evidence model: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/03_canonical_evidence_model.md`
- Prompt36 data quality gates: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/10_data_quality_gates.md`

Preserved Prompt40 facts:

- `supplier_cost_up` remains implemented as partial read-only evidence.
- Director section remains `16_operation_capacity`.
- Action Draft Schema remains parked.
- Provider execution/mutation remains parked.
- OpenAI API upload/call remains parked.
- Phase 3 remains parked.

