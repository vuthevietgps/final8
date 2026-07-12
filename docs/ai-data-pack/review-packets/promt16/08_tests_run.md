# Tests Run

Build:

```powershell
npm run build
```

Result:

- Passed.

Focused endpoint tests:

```powershell
npm test -- --runInBand export-job-endpoint.controller.spec.ts
```

Result:

- Passed.
- 29 tests passed.

AI Data Pack suite:

```powershell
npm test -- --runInBand ai-data-pack
```

Result:

- Passed.
- 15 suites passed.
- 133 tests passed.

Documentation JSON validation:

```powershell
node -e "JSON.parse(require('fs').readFileSync('docs/ai-data-pack/ketquapromt16.json','utf8')); console.log('ketquapromt16.json ok')"
```

Result:

- Passed.
