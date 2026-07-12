# Code Changes

Changed:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Business query logic changed: no.

Reason for service change:

- The required Prompt47 path did not exist when section `16_operation_capacity` exposed only the rows array at `data`.
- Section assembly now exposes full operations payload under `data.operation_capacity`.
