# Files Changed

## Code

| File | Reason |
|---|---|
| `backend/src/ai-data-pack/export-jobs/export-job.types.ts` | Cached-only request, status, pack, format and artifact contracts |
| `backend/src/ai-data-pack/export-jobs/export-job.schema.ts` | ExportJob/artifact Mongoose persistence and active idempotency index |
| `backend/src/ai-data-pack/export-jobs/export-job.service.ts` | Internal cached export wrapper/lifecycle |
| `backend/src/ai-data-pack/export-jobs/export-job-artifact.service.ts` | Safe immutable local artifact writer |
| `backend/src/ai-data-pack/export-jobs/export-job-error.util.ts` | Sanitized failure category/message |
| `backend/src/ai-data-pack/export-jobs/export-job.service.spec.ts` | Focused acceptance/security tests |
| `backend/src/ai-data-pack/ai-data-pack.module.ts` | Mongoose and internal-service DI wiring |
| `backend/src/ai-data-pack/contracts/metadata.contract.ts` | Optional minimal cached-job metadata fields |
| `backend/src/ai-data-pack/data-pack-metadata.service.ts` | Reuse existing safe actor normalization |
| `backend/src/ai-data-pack/export/json-exporter.service.ts` | Keep data-content checksum independent from cached runtime/job metadata |

`backend/src/ai-data-pack/ai-data-pack.controller.ts` was not changed by Prompt 4.

## Docs

- `docs/ai-data-pack/ketquapromt4.md`
- `docs/ai-data-pack/ketquapromt4.json`
- `docs/ai-data-pack/review-packets/promt4/00_summary.md` through `09_next_recommendation.md`
