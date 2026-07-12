# Tests Run

| Command/check | Status | Summary |
|---|---|---|
| `cd backend; npm test -- --runInBand ai-data-pack` before repair | Failed | Stale test calls and checksum generic prevented test execution |
| `cd backend; npm run build` before repair | Failed | 8 checksum generic/type errors |
| `cd backend; npm run build` after repair | Passed | NestJS backend compiled |
| `cd backend; npm test -- --runInBand ai-data-pack` after repair | Passed | 2 suites, 20 tests |
| 7 required local read-only endpoint calls | Passed | All returned HTTP 200 |
| Repeated Director JSON content checksum check | Passed | Content checksum stable; runtime checksum changed |
| XLSX parse/empty-sheet quality check | Passed | 25 Director/14 Marketer sheets; 16/16 empty sheets complete |
| Recursive JSON secret/PII/actor scan | Passed | 0 findings |
| `checksums.json` re-verification | Passed | 7/7 artifacts matched |

