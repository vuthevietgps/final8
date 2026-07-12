# Files Changed

| Path | Change | Reason |
|---|---|---|
| `backend/src/ai-data-pack/export/json-exporter.service.ts` | Typed checksum metadata/return contract | Restore compile health without weakening checksum behavior |
| `backend/src/ai-data-pack/export/xlsx-exporter.service.ts` | Emit empty-sheet `value_state` with quality columns | Preserve complete empty-sheet quality metadata |
| `backend/src/ai-data-pack/data-pack-metadata.service.ts` | Normalize actor IDs and reject unsafe/raw actor values | Prevent ObjectId buffer, PII, and credential-like metadata |
| `backend/src/ai-data-pack/queries/finance-data.query.ts` | Split cautious finance dimensions and states | Separate cash/debt/loan/forecast/overall quality |
| `backend/src/ai-data-pack/queries/order-profit.query.ts` | Add estimated/realized profit value states | Distinguish no-record, estimated, and realized values |
| `backend/src/ai-data-pack/director-data-pack.service.ts` | Mark manual inputs `not_configured`; mark static sections available | Make section state explicit |
| `backend/src/ai-data-pack/data-quality-report.service.ts` | Mark weak report state | Preserve safe decision interpretation |
| `backend/src/ai-data-pack/mapping-report.service.ts` | Mark weak mapping state | Make attribution weakness explicit |
| `backend/src/ai-data-pack/ai-data-pack.service.spec.ts` | Expand focused acceptance coverage and repair stale calls | Prove all PR-2.2 acceptance conditions |
| `docs/ai-data-pack/sample-exports/20260612-v2/` | Add 7 endpoint artifacts, checksums, and verification | Required sample-v2 evidence |
| `docs/ai-data-pack/ketquapromt2.md` and `.json` | Add main result reports | Required Prompt 2 outcome |
| `docs/ai-data-pack/review-packets/promt2/` | Add review packet | Required reviewer handoff |

