# Tests Run

```text
cd backend
npm run build
```

Passed.

```text
npm test -- --runInBand source-registry
```

Passed: 1 suite / 10 tests.

```text
npm test -- --runInBand export-job
```

Passed: 1 suite / 10 tests.

```text
npm test -- --runInBand ai-data-pack
```

Passed: 4 suites / 40 tests.

```text
npx prettier --check "src/ai-data-pack/source-registry/*.ts" "src/ai-data-pack/ai-data-pack.module.ts"
```

Passed.

Full repository tests and live/local database assessment were not run.
