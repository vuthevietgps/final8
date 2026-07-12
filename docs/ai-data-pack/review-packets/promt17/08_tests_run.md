# Tests Run

Focused endpoint spec:

```powershell
npm test -- --runInBand export-job-endpoint.controller.spec.ts
```

Result:

- Passed.
- 32 tests passed.

AI Data Pack suite:

```powershell
npm test -- --runInBand ai-data-pack
```

Result:

- Passed.
- 15 suites passed.
- 136 tests passed.

Backend build:

```powershell
npm run build
```

Result:

- Passed.

Documentation JSON validation:

```powershell
node -e "JSON.parse(require('fs').readFileSync('docs/ai-data-pack/ketquapromt17.json','utf8')); console.log('ketquapromt17.json ok')"
```

Result:

- Passed.
