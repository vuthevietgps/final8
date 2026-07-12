# Tests Run

Run from `backend` on 2026-06-13:

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm test -- --runInBand google-ads-readonly` | PASS - 7 suites, 41 tests |
| `npm test -- --runInBand source-sync` | PASS - 1 suite, 5 tests |
| `npm test -- --runInBand source-registry` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand export-job` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand ai-data-pack` | PASS - 11 suites, 81 tests |
| `npm test -- --runInBand google-ads` | PASS - 19 suites, 119 tests |
| `npx prettier --check scoped Prompt 9 TypeScript` | PASS |

No real provider API call was made in tests. Transport tests use mocked HTTP clients.
