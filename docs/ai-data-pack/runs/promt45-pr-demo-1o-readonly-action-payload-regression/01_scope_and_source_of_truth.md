# Scope And Source Of Truth

Source folders inspected:

- `docs/ai-data-pack/runs/promt44-pr-demo-1n-weak-evidence-closeout-regression/`
- `docs/ai-data-pack/runs/promt43-pr-demo-1m-slow-supplier-good-cost-readonly-slice/`
- `docs/ai-data-pack/runs/promt42-pr-demo-1l-labor-overtime-readonly-slice/`
- `docs/ai-data-pack/runs/promt41-pr-demo-1k-overdue-dealer-receivables-readonly-slice/`
- `docs/ai-data-pack/runs/promt40-pr-demo-1j-supplier-cost-up-readonly-slice/`
- `docs/ai-data-pack/runs/promt39-pr-demo-1i-low-inventory-reserved-incoming-upgrade/`
- `docs/ai-data-pack/runs/promt37-pr-demo-1g-low-inventory-readonly-slice/`
- `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/`

Current code surface inspected:

- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Scope decision:

- Add a test-only regression guard in `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`.
- Do not change `OperationsCapacityQuery` business logic.
- Do not touch production/server database.

Production DB used:

- No

