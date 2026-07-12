# Scope And Source Of Truth

Phase: `PR-DEMO-1L`

Target finding:

```text
labor_overtime_high
```

Prompt42 is limited to structured read-only Director JSON evidence for labor overtime pressure. It does not open Action Draft Schema, action import, provider execution, provider validation, approval workflow, staffing/schedule/payroll/timesheet/order/revenue/cashflow mutation, or Phase 3.

Immediate source of truth:

- Prompt41 result: `docs/ai-data-pack/runs/promt41-pr-demo-1k-overdue-dealer-receivables-readonly-slice/`
- Prompt36 labor overtime spec: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/07_finding_labor_overtime_high.md`
- Prompt36 canonical evidence model: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/03_canonical_evidence_model.md`
- Prompt36 data quality gates: `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/10_data_quality_gates.md`

Preserved Prompt41 facts:

- `overdue_dealer_receivables` remains implemented as partial read-only evidence.
- Director section remains `16_operation_capacity`.
- Action Draft Schema remains parked.
- Provider execution/mutation remains parked.
- OpenAI API upload/call remains parked.
- Phase 3 remains parked.

