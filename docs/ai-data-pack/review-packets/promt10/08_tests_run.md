# Tests Run

Run from `backend`:

| Command | Result |
|---|---|
| `npm run build` | PASS |
| `npm test -- --runInBand google-ads-readonly` | PASS - 7 suites, 41 tests |
| `npm test -- --runInBand source-sync` | PASS - 2 suites, 13 tests |
| `npm test -- --runInBand source-registry` | PASS - 1 suite, 10 tests |
| `npm test -- --runInBand export-job` | PASS - 1 suite, 12 tests |
| `npm test -- --runInBand ai-data-pack` | PASS - 12 suites, 91 tests |
| `npm test -- --runInBand google-ads` | PASS - 19 suites, 119 tests |
| `npx prettier --check "backend/src/ai-data-pack/source-sync/**/*.ts" "backend/src/ai-data-pack/export-jobs/*.ts"` | PASS |

No test performs a real Google Ads provider call.
