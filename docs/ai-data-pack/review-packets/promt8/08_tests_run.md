# Tests Run

Run from `backend` on 2026-06-13:

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm test -- --runInBand google-ads-readonly` | PASS - 8 suites, 38 tests |
| `npm test -- --runInBand source-sync` | PASS - 1 suite, 5 tests |
| `npm test -- --runInBand source-registry` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand export-job` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand ai-data-pack` | PASS - 12 suites, 80 tests |
| Scoped Prettier check | PASS |

All transport tests use mocked HTTP. No provider API call or real sync occurred.

