# Scope And Source Of Truth

Phase: PR-DEMO-1Q

Target:

`director_operational_risk_section_regression_guard`

Source of truth inspected:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
- `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`
- `backend/src/ai-data-pack/contracts/metadata.contract.ts`
- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`
- Prompt46 run folder and control-pack review notes
- Prior Prompt45/Prompt46 guard behavior carried forward in the spec

Scope honored:

- Focused ai-data-pack section assembly and test/contract guard only.
- No operational risk business finding logic changed.
- No real database or server MongoDB usage.
- Fake in-memory data only.
- No provider, action import, approval, export/download, or execution work.

Why `director-data-pack.service.ts` changed:

- The current Director section assembly only placed `operations.operation_capacity` at section `data`, so the required Prompt47 path did not exist.
- A single section assembly change now exposes the full operations payload under `data.operation_capacity`, enabling the required JSON section path while keeping query/business logic unchanged.
