# Tests Run

Run from `backend` on 2026-06-13:

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm test -- --runInBand google-ads-readonly` | PASS - 5 suites, 30 tests |
| `npm test -- --runInBand source-registry` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand export-job` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand ai-data-pack` | PASS - 8 suites, 67 tests |
| `npx prettier --check "src/ai-data-pack/provider-adapters/**/*.ts"` | PASS |

The focused tests use mocked ports and perform no provider API call.
