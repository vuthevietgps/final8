# Scope And Source Of Truth

Phase: PR-DEMO-1R

Target:

`readonly_evidence_ba_qa_handoff_closeout`

Source folders inspected:

- `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/`
- `docs/ai-data-pack/runs/promt37-pr-demo-1g-low-inventory-readonly-slice/`
- `docs/ai-data-pack/runs/promt39-pr-demo-1i-low-inventory-reserved-incoming-upgrade/`
- `docs/ai-data-pack/runs/promt40-pr-demo-1j-supplier-cost-up-readonly-slice/`
- `docs/ai-data-pack/runs/promt41-pr-demo-1k-overdue-dealer-receivables-readonly-slice/`
- `docs/ai-data-pack/runs/promt42-pr-demo-1l-labor-overtime-readonly-slice/`
- `docs/ai-data-pack/runs/promt43-pr-demo-1m-slow-supplier-good-cost-readonly-slice/`
- `docs/ai-data-pack/runs/promt44-pr-demo-1n-weak-evidence-closeout-regression/`
- `docs/ai-data-pack/runs/promt45-pr-demo-1o-readonly-action-payload-regression/`
- `docs/ai-data-pack/runs/promt46-pr-demo-1p-operational-risk-evidence-schema-regression/`
- `docs/ai-data-pack/runs/promt47-pr-demo-1q-director-operational-risk-section-regression/`

Current code references inspected by read-only search:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
- `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`
- `backend/src/ai-data-pack/contracts/metadata.contract.ts`
- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Prompt48 output mode:

- No code changes.
- No production DB/server MongoDB.
- No test rerun required; inherited verification from Prompt45-Prompt47 is recorded.
- Output files created only under this run folder.
